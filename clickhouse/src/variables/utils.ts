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

import {
  datasourceSelectValueToSelector,
  GetVariableOptionsContext,
  replaceVariables,
  VariableOption,
} from '@perses-dev/plugin-system';

import { ClickHouseDatasourceClient } from '../datasources';
import { formatClickHouseDateTime, replaceTimeRangePlaceholders } from '../model/click-house-client';
import { DATASOURCE_KIND, DEFAULT_DATASOURCE } from '../queries/constants';
import { ClickHouseVariableOptionsBase } from './types';

type ClickHouseRow = Record<string, unknown>;

function isClickHouseRow(value: unknown): value is ClickHouseRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toOptionValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return undefined;
}

function uniqueOptions(options: VariableOption[]): VariableOption[] {
  const values = new Set<string>();
  return options.filter((option) => {
    if (values.has(option.value)) return false;
    values.add(option.value);
    return true;
  });
}

function getRows(data: unknown): ClickHouseRow[] {
  return Array.isArray(data) ? data.filter(isClickHouseRow) : [];
}

export function queryDataToVariableOptions(data: unknown): VariableOption[] {
  const options = getRows(data).flatMap((row): VariableOption[] => {
    const entries = Object.entries(row);
    const value = toOptionValue(row['__value'] ?? entries[0]?.[1]);
    if (value === undefined) return [];

    return [
      {
        value,
        label: toOptionValue(row['__text']) ?? value,
      },
    ];
  });
  return uniqueOptions(options);
}

export function queryDataToLabelNames(data: unknown): VariableOption[] {
  const names = new Set<string>();
  for (const row of getRows(data)) {
    const values = Object.values(row);
    const singleValue = values.length === 1 ? values[0] : undefined;
    if (isClickHouseRow(singleValue)) {
      Object.keys(singleValue).forEach((name) => names.add(name));
    } else {
      Object.keys(row).forEach((name) => names.add(name));
    }
  }

  return Array.from(names, (name) => ({ value: name, label: name }));
}

export function queryDataToLabelValues(data: unknown, labelName: string): VariableOption[] {
  const options = getRows(data).flatMap((row): VariableOption[] => {
    let labelValue = row[labelName];
    if (labelValue === undefined) {
      for (const value of Object.values(row)) {
        if (isClickHouseRow(value) && value[labelName] !== undefined) {
          labelValue = value[labelName];
          break;
        }
      }
    }

    const value = toOptionValue(labelValue);
    return value === undefined ? [] : [{ value, label: value }];
  });
  return uniqueOptions(options);
}

export async function executeVariableQuery(
  spec: ClickHouseVariableOptionsBase & { query: string },
  context: GetVariableOptionsContext,
): Promise<unknown> {
  const interpolatedQuery = replaceVariables(spec.query, context.variables);
  if (!interpolatedQuery.trim()) return [];

  const datasourceSelector =
    datasourceSelectValueToSelector(
      spec.datasource ?? DEFAULT_DATASOURCE,
      context.variables,
      await context.datasourceStore.listDatasourceSelectItems(DATASOURCE_KIND),
    ) ?? DEFAULT_DATASOURCE;
  const client = await context.datasourceStore.getDatasourceClient<ClickHouseDatasourceClient>(datasourceSelector);
  const start = formatClickHouseDateTime(context.timeRange.start);
  const end = formatClickHouseDateTime(context.timeRange.end);
  const query = replaceTimeRangePlaceholders(interpolatedQuery, start, end);
  const response = await client.query({ query, start, end });
  return response.status === 'success' ? response.data : [];
}
