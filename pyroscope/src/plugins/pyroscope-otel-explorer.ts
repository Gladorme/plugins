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

import type { PyroscopeClient } from '../model';
import { LabelFilter } from '../utils/types';

export interface ExplorerAttributeFilter {
  key: string;
  operator: '=' | '!=' | '=~' | '!~';
  value: string;
}

export interface ExplorerFilterArgs {
  datasource: DatasourceSelector;
  filters: ExplorerAttributeFilter[];
  profileServiceName?: string;
  profileType?: string;
}

export interface ExplorerSuggestionArgs extends ExplorerFilterArgs {
  abortSignal?: AbortSignal;
  client: PyroscopeClient;
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

const JSON_HEADERS = { 'content-type': 'application/json' };

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

function createExplorerQuery({
  datasource,
  filters,
  profileServiceName,
  profileType,
}: ExplorerFilterArgs): QueryDefinition {
  const profileTypeFilter = filters.find((filter) => filter.key === 'profile.type' && filter.operator === '=');
  const selectedProfileType = profileType?.trim() || profileTypeFilter?.value;
  if (!selectedProfileType) {
    throw new Error('Select a profile type before running a profiles query.');
  }

  const serviceFilter = filters.find((filter) => filter.key === 'service_name' && filter.operator === '=');
  const selectedService = profileServiceName?.trim() || '';
  const attributeFilters = filters.filter(
    (filter) => filter !== profileTypeFilter && (!selectedService || filter !== serviceFilter),
  );
  return {
    kind: 'ProfileQuery',
    spec: {
      plugin: {
        kind: 'PyroscopeProfileQuery',
        spec: {
          datasource,
          profileType: selectedProfileType,
          service: selectedService,
          maxNodes: 0,
          filters: applyPyroscopeAttributeFilters(undefined, attributeFilters, []),
        },
      },
    },
  };
}

function createSuggestionBody(start: Date, end: Date): Record<string, string | number> {
  return { start: start.getTime(), end: end.getTime() };
}

async function getAttributeNames({ client, end, start }: ExplorerSuggestionArgs): Promise<string[]> {
  const response = await client.searchLabelNames({}, JSON_HEADERS, createSuggestionBody(start, end));
  return response.names.filter((name) => name !== 'profile.type' && name !== 'service_name');
}

async function getAttributeValues({
  attribute,
  client,
  end,
  start,
}: ExplorerAttributeValueSuggestionArgs): Promise<string[]> {
  if (attribute === 'profile.type') {
    const response = await client.searchProfileTypes({}, JSON_HEADERS, createSuggestionBody(start, end));
    return response.profileTypes.map((profileType) => profileType.ID);
  }

  const response = await client.searchLabelValues({}, JSON_HEADERS, {
    name: attribute,
    ...createSuggestionBody(start, end),
  });
  return response.names;
}

async function getSignalFieldValues({
  client,
  end,
  field,
  start,
}: ExplorerSignalFieldSuggestionArgs): Promise<string[]> {
  if (field === 'profile.type') {
    const response = await client.searchProfileTypes({}, JSON_HEADERS, createSuggestionBody(start, end));
    return response.profileTypes.map((profileType) => profileType.ID);
  }
  if (field === 'profile.service.name') {
    const response = await client.searchServices({}, JSON_HEADERS, createSuggestionBody(start, end));
    return response.names;
  }
  return [];
}

export const PYROSCOPE_OTEL_EXPLORER = {
  profiles: {
    createQuery: createExplorerQuery,
    getAttributeNames,
    getAttributeValues,
    getSignalFieldValues,
  },
} as const;
