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

import type { LokiClient } from '../../model';

const SIGNAL_FIELD_LABELS: Record<string, string> = {
  'log.service.name': 'service_name',
  'log.severity': 'detected_level',
};

export interface ExplorerAttributeFilter {
  key: string;
  operator: '=' | '!=' | '=~' | '!~';
  value: string;
}

export interface ExplorerFilterArgs {
  datasource: DatasourceSelector;
  filters: ExplorerAttributeFilter[];
  logSearch?: string;
  logServiceName?: string;
  logSeverity?: string;
}

export interface ExplorerSuggestionArgs extends ExplorerFilterArgs {
  abortSignal?: AbortSignal;
  client: LokiClient;
  end: Date;
  metricName?: string;
  metricsQueryMode?: 'range' | 'instant';
  start: Date;
}

export interface ExplorerAttributeValueSuggestionArgs extends ExplorerSuggestionArgs {
  attribute: string;
}

export interface ExplorerSignalFieldSuggestionArgs extends ExplorerSuggestionArgs {
  field: string;
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

function withServiceFilter(
  filters: ExplorerAttributeFilter[],
  serviceName: string | undefined,
): ExplorerAttributeFilter[] {
  if (!serviceName?.trim()) {
    return filters;
  }
  return [
    ...filters.filter((filter) => filter.key !== 'service_name'),
    { key: 'service_name', operator: '=', value: serviceName.trim() },
  ];
}

function createExplorerQuery({
  datasource,
  filters,
  logSearch,
  logServiceName,
  logSeverity,
}: ExplorerFilterArgs): QueryDefinition {
  const selector = applyLokiAttributeFilters('', withServiceFilter(filters, logServiceName), []);
  if (selector === '') {
    throw new Error('Select a service or add at least one attribute filter before running a logs query.');
  }
  const search = logSearch?.trim();
  const severity = logSeverity?.trim();
  const query = [
    selector,
    search ? `|= "${escapeMatcherValue(search)}"` : undefined,
    severity ? `| detected_level = "${escapeMatcherValue(severity)}"` : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    kind: 'LogQuery',
    spec: {
      plugin: {
        kind: 'LokiLogQuery',
        spec: {
          datasource,
          query,
        },
      },
    },
  };
}

function toUnixSeconds(value: Date): string {
  return Math.floor(value.getTime() / 1000).toString();
}

function createSuggestionQuery(filters: ExplorerAttributeFilter[]): string | undefined {
  return applyLokiAttributeFilters('', filters, []) || undefined;
}

function createExplorerSuggestionQuery(
  filters: ExplorerAttributeFilter[],
  logServiceName: string | undefined,
): string | undefined {
  return createSuggestionQuery(withServiceFilter(filters, logServiceName));
}

async function getAttributeNames({
  client,
  end,
  filters,
  logServiceName,
  start,
}: ExplorerSuggestionArgs): Promise<string[]> {
  const response = await client.labels({
    end: toUnixSeconds(end),
    query: createExplorerSuggestionQuery(filters, logServiceName),
    start: toUnixSeconds(start),
  });
  return response.data.filter((name) => name !== 'service_name' && name !== 'detected_level');
}

async function getAttributeValues({
  attribute,
  client,
  end,
  filters,
  logServiceName,
  start,
}: ExplorerAttributeValueSuggestionArgs): Promise<string[]> {
  const response = await client.labelValues({
    end: toUnixSeconds(end),
    labelName: attribute,
    query: createExplorerSuggestionQuery(filters, logServiceName),
    start: toUnixSeconds(start),
  });
  return response.data;
}

async function getSignalFieldValues({
  client,
  end,
  field,
  filters,
  logServiceName,
  start,
}: ExplorerSignalFieldSuggestionArgs): Promise<string[]> {
  const labelName = SIGNAL_FIELD_LABELS[field];
  if (!labelName) {
    return [];
  }
  const response = await client.labelValues({
    end: toUnixSeconds(end),
    labelName,
    query: createExplorerSuggestionQuery(filters, field === 'log.service.name' ? undefined : logServiceName),
    start: toUnixSeconds(start),
  });
  return response.data;
}

export const LOKI_OTEL_EXPLORER = {
  logs: {
    createQuery: createExplorerQuery,
    getAttributeNames,
    getAttributeValues,
    getSignalFieldValues,
  },
} as const;
