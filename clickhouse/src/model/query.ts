// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { DatasourceSelectValue, DatasourceStore, VariableStateMap } from '@perses-dev/plugin-system';
import {
  datasourceSelectValueToSelector,
  isVariableDatasource,
  parseVariables,
  replaceVariables,
} from '@perses-dev/plugin-system';
import type { AbsoluteTimeRange } from '@perses-dev/spec';

import { DATASOURCE_KIND, DEFAULT_DATASOURCE } from '../queries/constants';
import type { ClickHouseClient, ClickHouseQueryResponse } from './click-house-client';
import { formatClickHouseDateTime, getRows, replaceTimeRangePlaceholders } from './click-house-client';

export interface ClickHouseQuerySpec {
  query: string;
  datasource?: DatasourceSelectValue;
}

export interface ClickHouseQueryContext {
  datasourceStore: DatasourceStore;
  variableState: VariableStateMap;
  timeRange?: AbsoluteTimeRange;
  suggestedStepMs?: number;
}

export function queryDependencies(spec: ClickHouseQuerySpec): { variables: string[] } {
  return {
    variables: [
      ...new Set([
        ...parseVariables(spec.query),
        ...(typeof spec.datasource === 'string' ? parseVariables(spec.datasource) : []),
      ]),
    ],
  };
}

/** sqlstring must escape backslashes as well as quotes for ClickHouse string literals. */
export function interpolateQuery(query: string, variables: VariableStateMap): string {
  return query.replace(/\$(?:\w+|\{\w+(?::\w+)?\})/g, (token) => {
    const name = parseVariables(token)[0];
    const state = name ? variables[name] : undefined;
    if (token.endsWith(':sqlstring}') && state?.value !== undefined) {
      const values = Array.isArray(state.value) ? state.value : [state.value];
      return values
        .map((value) => (value === null ? 'NULL' : "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "''") + "'"))
        .join(',');
    }
    return replaceVariables(token, variables);
  });
}

export async function executeQuery(
  spec: ClickHouseQuerySpec,
  context: ClickHouseQueryContext,
  signal?: AbortSignal,
): Promise<{ response: ClickHouseQueryResponse; rows: Array<Record<string, unknown>>; executedQueryString: string }> {
  const { datasourceStore, variableState, timeRange } = context;
  let selector = spec.datasource ?? DEFAULT_DATASOURCE;
  if (isVariableDatasource(selector)) {
    const resolved = datasourceSelectValueToSelector(
      selector,
      variableState,
      await datasourceStore.listDatasourceSelectItems(DATASOURCE_KIND),
    );
    if (!resolved || resolved.kind !== DATASOURCE_KIND) {
      throw new Error('The ClickHouse datasource variable must select one ClickHouse datasource');
    }
    selector = resolved;
  }
  if (selector.kind !== DATASOURCE_KIND) throw new Error('Expected a ClickHouse datasource');
  const client: ClickHouseClient = await datasourceStore.getDatasourceClient(selector);
  const start = timeRange ? formatClickHouseDateTime(timeRange.start) : undefined;
  const end = timeRange ? formatClickHouseDateTime(timeRange.end) : undefined;
  const step = Math.max(1, Math.ceil((context.suggestedStepMs ?? 30_000) / 1000));
  const timedQuery = replaceTimeRangePlaceholders(spec.query, start, end).replaceAll('{step}', String(step));
  if (/\{(?:start|end)\}/.test(timedQuery)) {
    throw new Error('This ClickHouse query requires a time range');
  }
  const executedQueryString = interpolateQuery(timedQuery, variableState);
  // The SQL is fully prepared: do not let the HTTP client expand placeholders inside variable values again.
  const params = { query: executedQueryString };
  const response = signal ? await client.query(params, undefined, signal) : await client.query(params);
  return { response, rows: getRows(response), executedQueryString };
}
