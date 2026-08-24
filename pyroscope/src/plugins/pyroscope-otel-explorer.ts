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
}

function toPyroscopeFilter(filter: ExplorerAttributeFilter): LabelFilter {
  return { labelName: filter.key, labelValue: filter.value, operator: filter.operator };
}

function sameFilter(left: LabelFilter, right: LabelFilter): boolean {
  return left.labelName === right.labelName && left.labelValue === right.labelValue && left.operator === right.operator;
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

function createExplorerQuery({ datasource, filters }: ExplorerFilterArgs): QueryDefinition {
  const profileTypeFilter = filters.find((filter) => filter.key === 'profile.type' && filter.operator === '=');
  if (!profileTypeFilter) {
    throw new Error('Add a profile.type equality filter before running a profiles query.');
  }

  const attributeFilters = filters.filter((filter) => filter !== profileTypeFilter);
  return {
    kind: 'ProfileQuery',
    spec: {
      plugin: {
        kind: 'PyroscopeProfileQuery',
        spec: {
          datasource,
          profileType: profileTypeFilter.value,
          service: '',
          maxNodes: 0,
          filters: applyPyroscopeAttributeFilters(undefined, attributeFilters, []),
        },
      },
    },
  };
}

export const PYROSCOPE_OTEL_EXPLORER = {
  profiles: {
    createQuery: createExplorerQuery,
  },
} as const;
