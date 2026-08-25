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

import type { TempoClient } from '../model';

const SIGNAL_FIELD_TAGS: Record<string, string> = {
  'trace.service.name': 'resource.service.name',
  'trace.span.name': 'name',
};

export interface ExplorerAttributeFilter {
  key: string;
  operator: '=' | '!=' | '=~' | '!~';
  value: string;
}

export interface ExplorerFilterArgs {
  datasource: DatasourceSelector;
  filters: ExplorerAttributeFilter[];
  traceMaxDuration?: string;
  traceMinDuration?: string;
  traceServiceName?: string;
  traceSpanName?: string;
  traceStatus?: '' | 'unset' | 'ok' | 'error';
}

export interface ExplorerSuggestionArgs extends ExplorerFilterArgs {
  abortSignal?: AbortSignal;
  client: TempoClient;
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
  return `${filter.key} ${filter.operator} "${escapeMatcherValue(filter.value)}"`;
}

function splitMatchers(value: string): string[] {
  const matchers: string[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < value.length - 1; index++) {
    if (value[index] === '"' && value[index - 1] !== '\\') {
      quoted = !quoted;
    } else if (value[index] === '&' && value[index + 1] === '&' && !quoted) {
      matchers.push(value.slice(start, index).trim());
      start = index + 2;
      index += 1;
    }
  }
  matchers.push(value.slice(start).trim());
  return matchers.filter(Boolean);
}

export function applyTempoAttributeFilters(
  expression: string,
  filters: ExplorerAttributeFilter[],
  previousFilters: ExplorerAttributeFilter[],
): string {
  const previousMatchers = new Set(previousFilters.map(attributeMatcher));
  const nextMatchers = filters.map(attributeMatcher);
  const selector = /^\s*\{([^}]*)\}/.exec(expression);

  if (selector) {
    const manualMatchers = splitMatchers(selector[1] ?? '').filter((matcher) => !previousMatchers.has(matcher));
    const nextSelector = `{ ${[...manualMatchers, ...nextMatchers].join(' && ')} }`;
    return nextSelector + expression.slice(selector[0].length);
  }

  if (expression.trim() === '') {
    return nextMatchers.length > 0 ? `{ ${nextMatchers.join(' && ')} }` : '{}';
  }

  throw new Error('Attribute filters require a TraceQL query that starts with a spanset selector.');
}

const DURATION_PATTERN = /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:ns|us|ms|s|m|h)$/;

function createTraceQuery(args: ExplorerFilterArgs, excludedField?: string): string {
  const matchers = args.filters
    .filter(
      (filter) =>
        !(args.traceServiceName?.trim() && filter.key === 'resource.service.name') &&
        !(args.traceSpanName?.trim() && filter.key === 'name'),
    )
    .map(attributeMatcher);
  if (excludedField !== 'trace.service.name' && args.traceServiceName?.trim()) {
    matchers.push(`resource.service.name = "${escapeMatcherValue(args.traceServiceName.trim())}"`);
  }
  if (excludedField !== 'trace.span.name' && args.traceSpanName?.trim()) {
    matchers.push(`name = "${escapeMatcherValue(args.traceSpanName.trim())}"`);
  }
  if (args.traceStatus) {
    matchers.push(`status = ${args.traceStatus}`);
  }
  if (args.traceMinDuration?.trim()) {
    if (!DURATION_PATTERN.test(args.traceMinDuration.trim())) {
      throw new Error('Minimum trace duration must use a value such as 100ms, 1.5s, or 2m.');
    }
    matchers.push(`duration >= ${args.traceMinDuration.trim()}`);
  }
  if (args.traceMaxDuration?.trim()) {
    if (!DURATION_PATTERN.test(args.traceMaxDuration.trim())) {
      throw new Error('Maximum trace duration must use a value such as 100ms, 1.5s, or 2m.');
    }
    matchers.push(`duration <= ${args.traceMaxDuration.trim()}`);
  }
  return matchers.length > 0 ? `{ ${matchers.join(' && ')} }` : '{}';
}

function createExplorerQuery(args: ExplorerFilterArgs): QueryDefinition {
  return {
    kind: 'TraceQuery',
    spec: {
      plugin: {
        kind: 'TempoTraceQuery',
        spec: {
          datasource: args.datasource,
          query: createTraceQuery(args),
          limit: 20,
        },
      },
    },
  };
}

function toUnixSeconds(value: Date): number {
  return value.getTime() / 1000;
}

function createSuggestionQuery(args: ExplorerSuggestionArgs, excludedField?: string): string {
  return createTraceQuery(args, excludedField);
}

async function getAttributeNames(args: ExplorerSuggestionArgs): Promise<string[]> {
  const { client, end, start } = args;
  const response = await client.searchTags({
    end: toUnixSeconds(end),
    q: createSuggestionQuery(args),
    start: toUnixSeconds(start),
  });
  const dedicatedFields = new Set(['resource.service.name', 'name', 'status', 'duration']);
  return [...new Set(response.scopes.flatMap((scope) => scope.tags))]
    .filter((tag) => !dedicatedFields.has(tag))
    .toSorted();
}

async function getAttributeValues(args: ExplorerAttributeValueSuggestionArgs): Promise<string[]> {
  const { attribute, client, end, start } = args;
  const response = await client.searchTagValues({
    end: toUnixSeconds(end),
    q: createSuggestionQuery(args),
    start: toUnixSeconds(start),
    tag: attribute,
  });
  return response.tagValues.flatMap(({ value }) => (value === undefined ? [] : [value])).toSorted();
}

async function getSignalFieldValues(args: ExplorerSignalFieldSuggestionArgs): Promise<string[]> {
  const tag = SIGNAL_FIELD_TAGS[args.field];
  if (!tag) {
    return [];
  }
  const response = await args.client.searchTagValues({
    end: toUnixSeconds(args.end),
    q: createSuggestionQuery(args, args.field),
    start: toUnixSeconds(args.start),
    tag,
  });
  return response.tagValues.flatMap(({ value }) => (value === undefined ? [] : [value])).toSorted();
}

export const TEMPO_OTEL_EXPLORER = {
  traces: {
    createQuery: createExplorerQuery,
    getAttributeNames,
    getAttributeValues,
    getSignalFieldValues,
  },
} as const;
