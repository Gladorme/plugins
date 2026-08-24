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

function createExplorerQuery({ datasource, filters }: ExplorerFilterArgs): QueryDefinition {
  return {
    kind: 'TraceQuery',
    spec: {
      plugin: {
        kind: 'TempoTraceQuery',
        spec: {
          datasource,
          query: applyTempoAttributeFilters('', filters, []),
          limit: 20,
        },
      },
    },
  };
}

export const TEMPO_OTEL_EXPLORER = {
  traces: {
    createQuery: createExplorerQuery,
  },
} as const;
