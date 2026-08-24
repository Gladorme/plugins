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

import { LabelFilter } from '../utils/types';

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

function toPyroscopeFilter(filter: ExplorerAttributeFilter): LabelFilter {
  return { labelName: filter.key, labelValue: filter.value, operator: filter.operator };
}

function sameFilter(left: LabelFilter, right: LabelFilter): boolean {
  return left.labelName === right.labelName && left.labelValue === right.labelValue && left.operator === right.operator;
}

function isLabelFilter(value: unknown): value is LabelFilter {
  return (
    typeof value === 'object' &&
    value !== null &&
    'labelName' in value &&
    typeof value.labelName === 'string' &&
    'labelValue' in value &&
    typeof value.labelValue === 'string' &&
    'operator' in value &&
    (value.operator === '=' || value.operator === '!=' || value.operator === '=~' || value.operator === '!~')
  );
}

export function applyPyroscopeAttributeFilters(
  currentFilters: LabelFilter[] | undefined,
  filters: ExplorerAttributeFilter[],
  previousFilters: ExplorerAttributeFilter[],
): LabelFilter[] {
  const previous = previousFilters.map(toPyroscopeFilter);
  const manualFilters = (currentFilters ?? []).filter(
    (filter) => !previous.some((previousFilter) => sameFilter(filter, previousFilter)),
  );
  return [...manualFilters, ...filters.map(toPyroscopeFilter)];
}

function applyExplorerFilters({ datasource, filters, previousFilters, query }: ExplorerFilterArgs): QueryDefinition {
  if (query.kind !== 'ProfileQuery' || query.spec.plugin.kind !== 'PyroscopeProfileQuery') {
    throw new Error('The selected datasource requires a Pyroscope profile query.');
  }
  const spec: unknown = query.spec.plugin.spec;
  if (typeof spec !== 'object' || spec === null) {
    throw new Error('The Pyroscope profile query is missing its profile type.');
  }
  const profileType = 'profileType' in spec ? spec.profileType : undefined;
  if (typeof profileType !== 'string') {
    throw new Error('The Pyroscope profile query is missing its profile type.');
  }
  const currentFilters =
    'filters' in spec && Array.isArray(spec.filters) ? spec.filters.filter(isLabelFilter) : undefined;
  return {
    ...query,
    spec: {
      ...query.spec,
      plugin: {
        ...query.spec.plugin,
        spec: {
          ...spec,
          datasource,
          filters: applyPyroscopeAttributeFilters(currentFilters, filters, previousFilters),
        },
      },
    },
  };
}

export const PYROSCOPE_OTEL_EXPLORER = {
  profiles: {
    queryType: 'ProfileQuery',
    queryPluginKind: 'PyroscopeProfileQuery',
    applyAttributeFilters: applyExplorerFilters,
  },
} as const;
