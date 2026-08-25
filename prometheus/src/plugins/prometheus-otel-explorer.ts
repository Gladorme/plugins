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

import type { PrometheusClient } from '../model';

export interface ExplorerAttributeFilter {
  key: string;
  operator: '=' | '!=' | '=~' | '!~';
  value: string;
}

export interface ExplorerFilterArgs {
  datasource: DatasourceSelector;
  filters: ExplorerAttributeFilter[];
  metricName?: string;
  metricsQueryMode?: 'range' | 'instant';
}

export interface ExplorerSuggestionArgs extends ExplorerFilterArgs {
  abortSignal?: AbortSignal;
  client: PrometheusClient;
  end: Date;
  start: Date;
}

export interface ExplorerAttributeValueSuggestionArgs extends ExplorerSuggestionArgs {
  attribute: string;
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

export function applyPrometheusAttributeFilters(
  expression: string,
  filters: ExplorerAttributeFilter[],
  previousFilters: ExplorerAttributeFilter[],
): string {
  const previousMatchers = new Set(previousFilters.map(attributeMatcher));
  const nextMatchers = filters.map(attributeMatcher);
  const selector = /^(\s*[a-zA-Z_:][a-zA-Z0-9_:]*)?\s*\{([^}]*)\}/.exec(expression);

  if (selector) {
    const manualMatchers = splitMatchers(selector[2] ?? '').filter((matcher) => !previousMatchers.has(matcher));
    const nextSelector = `${selector[1] ?? ''}{${[...manualMatchers, ...nextMatchers].join(',')}}`;
    return nextSelector + expression.slice(selector[0].length);
  }

  if (/^\s*[a-zA-Z_:][a-zA-Z0-9_:]*\s*$/.test(expression)) {
    return `${expression.trim()}{${nextMatchers.join(',')}}`;
  }

  if (expression.trim() === '') {
    return nextMatchers.length > 0 ? `{${nextMatchers.join(',')}}` : '';
  }

  if (nextMatchers.length > 0) {
    throw new Error('Attribute filters can only be applied to a Prometheus vector selector.');
  }
  return expression;
}

function createSelector(metricName: string | undefined, filters: ExplorerAttributeFilter[]): string {
  return applyPrometheusAttributeFilters(metricName?.trim() ?? '', filters, []) || '{__name__=~".+"}';
}

function createExplorerQuery({
  datasource,
  filters,
  metricName,
  metricsQueryMode,
}: ExplorerFilterArgs): QueryDefinition {
  const query = createSelector(metricName, filters);

  return {
    kind: 'TimeSeriesQuery',
    spec: {
      plugin: {
        kind: 'PrometheusTimeSeriesQuery',
        spec: {
          datasource,
          instant: metricsQueryMode === 'instant',
          query,
        },
      },
    },
  };
}

function toUnixSeconds(value: Date): number {
  return value.getTime() / 1000;
}

async function getAttributeNames({
  abortSignal,
  client,
  end,
  filters,
  metricName,
  start,
}: ExplorerSuggestionArgs): Promise<string[]> {
  const response = await client.labelNames(
    {
      'match[]': [createSelector(metricName, filters)],
      end: toUnixSeconds(end),
      start: toUnixSeconds(start),
    },
    { signal: abortSignal },
  );
  return (response.data ?? []).filter((name) => name !== '__name__');
}

async function getAttributeValues({
  abortSignal,
  attribute,
  client,
  end,
  filters,
  metricName,
  start,
}: ExplorerAttributeValueSuggestionArgs): Promise<string[]> {
  const response = await client.labelValues(
    {
      'match[]': [createSelector(metricName, filters)],
      end: toUnixSeconds(end),
      labelName: attribute,
      start: toUnixSeconds(start),
    },
    { signal: abortSignal },
  );
  return response.data ?? [];
}

async function getMetricNames({ abortSignal, client, end, filters, start }: ExplorerSuggestionArgs): Promise<string[]> {
  const response = await client.labelValues(
    {
      ...(filters.length > 0 ? { 'match[]': [createSelector(undefined, filters)] } : {}),
      end: toUnixSeconds(end),
      labelName: '__name__',
      start: toUnixSeconds(start),
    },
    { signal: abortSignal },
  );
  return response.data ?? [];
}

export const PROMETHEUS_OTEL_EXPLORER = {
  metrics: {
    createQuery: createExplorerQuery,
    getAttributeNames,
    getAttributeValues,
    getMetricNames,
  },
} as const;
