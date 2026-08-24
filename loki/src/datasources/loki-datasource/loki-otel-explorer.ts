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

import { DatasourceSelector, QueryDefinition } from '@perses-dev/spec';

export interface ExplorerAttributeFilter {
  key: string;
  operator: '=' | '!=' | '=~' | '!~';
  value: string;
}

export interface ExplorerFilterArgs {
  datasource: DatasourceSelector;
  filters: ExplorerAttributeFilter[];
  previousFilters: ExplorerAttributeFilter[];
  query: QueryDefinition;
}

function escapeMatcherValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function attributeMatcher(filter: ExplorerAttributeFilter): string {
  return `${filter.key}${filter.operator}"${escapeMatcherValue(filter.value)}"`;
}

function splitMatchers(value: string): string[] {
  const matchers: string[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '"' && value[index - 1] !== '\\') {
      quoted = !quoted;
    } else if (value[index] === ',' && !quoted) {
      matchers.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  matchers.push(value.slice(start).trim());
  return matchers.filter(Boolean);
}

export function applyLokiAttributeFilters(
  expression: string,
  filters: ExplorerAttributeFilter[],
  previousFilters: ExplorerAttributeFilter[],
): string {
  const previousMatchers = new Set(previousFilters.map(attributeMatcher));
  const nextMatchers = filters.map(attributeMatcher);
  const selector = /^\s*\{([^}]*)\}/.exec(expression);

  if (selector) {
    const manualMatchers = splitMatchers(selector[1] ?? '').filter((matcher) => !previousMatchers.has(matcher));
    const matchers = [...manualMatchers, ...nextMatchers];
    const nextSelector = matchers.length > 0 ? `{${matchers.join(',')}}` : '';
    return nextSelector + expression.slice(selector[0].length);
  }

  if (expression.trim() === '') {
    return nextMatchers.length > 0 ? `{${nextMatchers.join(',')}}` : '';
  }

  throw new Error('Attribute filters require a Loki query that starts with a stream selector.');
}

function applyExplorerFilters({
  datasource,
  filters,
  previousFilters,
  query: queryDefinition,
}: ExplorerFilterArgs): QueryDefinition {
  if (queryDefinition.kind !== 'LogQuery' || queryDefinition.spec.plugin.kind !== 'LokiLogQuery') {
    throw new Error('The selected datasource requires a Loki log query.');
  }
  const spec: unknown = queryDefinition.spec.plugin.spec;
  if (typeof spec !== 'object' || spec === null) {
    throw new Error('The Loki log query is missing its query expression.');
  }
  const queryExpression = 'query' in spec ? spec.query : undefined;
  if (typeof queryExpression !== 'string') {
    throw new Error('The Loki log query is missing its query expression.');
  }
  return {
    ...queryDefinition,
    spec: {
      ...queryDefinition.spec,
      plugin: {
        ...queryDefinition.spec.plugin,
        spec: {
          ...spec,
          datasource,
          query: applyLokiAttributeFilters(queryExpression, filters, previousFilters),
        },
      },
    },
  };
}

export const LOKI_OTEL_EXPLORER = {
  logs: {
    queryType: 'LogQuery',
    queryPluginKind: 'LokiLogQuery',
    applyAttributeFilters: applyExplorerFilters,
  },
} as const;
