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

import type { DatasourceStore, VariableStateMap } from '@perses-dev/plugin-system';

import type { ClickHouseColumn, ClickHouseQueryResponse } from '../src/model/click-house-client';

export function createContext(
  data: unknown = [],
  meta?: ClickHouseColumn[],
): {
  query: ReturnType<
    typeof vi.fn<(params: unknown, headers?: unknown, signal?: AbortSignal) => Promise<ClickHouseQueryResponse>>
  >;
  datasourceStore: DatasourceStore;
  variableState: VariableStateMap;
  variables: VariableStateMap;
  absoluteTimeRange: { start: Date; end: Date };
} {
  const query = vi
    .fn<(params: unknown, headers?: unknown, signal?: AbortSignal) => Promise<ClickHouseQueryResponse>>()
    .mockResolvedValue({ status: 'success', data, meta });
  const timeRange = { start: new Date('2025-01-01T00:00:00Z'), end: new Date('2025-01-01T01:00:00Z') };
  const variables: VariableStateMap = {};
  return {
    query,
    datasourceStore: {
      getDatasourceClient: vi.fn().mockResolvedValue({ query }),
      getDatasource: vi.fn(),
      listDatasourceSelectItems: vi.fn().mockResolvedValue([]),
      getLocalDatasources: vi.fn(),
      setLocalDatasources: vi.fn(),
      getSavedDatasources: vi.fn(),
      setSavedDatasources: vi.fn(),
    },
    absoluteTimeRange: timeRange,
    variableState: variables,
    variables,
  };
}
