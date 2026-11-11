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

import type { VariableStateMap } from '@perses-dev/components';
import type { GetVariableOptionsContext } from '@perses-dev/plugin-system';
import type { DatasourceSpec } from '@perses-dev/spec';
import type { Mock } from 'vitest';

import { PrometheusDatasource } from './prometheus-datasource';
import { PrometheusPromQLVariable } from './PrometheusPromQLVariable';
import type { PrometheusDatasourceSpec } from './types';

const datasource: PrometheusDatasourceSpec = { directUrl: 'http://localhost:9090' };

const fetchJson = vi.fn();
const client = PrometheusDatasource.createClient(datasource, { fetchJson });

const getDatasource: Mock = vi.fn(async (): Promise<DatasourceSpec<PrometheusDatasourceSpec>> => {
  return {
    default: false,
    plugin: { kind: 'PrometheusDatasource', spec: datasource },
  };
});
const getDatasourceClient: Mock = vi.fn(async () => client);

function createContext(variables: VariableStateMap = {}): GetVariableOptionsContext {
  return {
    datasourceStore: {
      getDatasource,
      getDatasourceClient,
      listDatasourceSelectItems: vi.fn(async () => []),
      getLocalDatasources: vi.fn(),
      setLocalDatasources: vi.fn(),
      getSavedDatasources: vi.fn(),
      setSavedDatasources: vi.fn(),
    },
    variables,
    timeRange: { start: new Date('2023-01-01T00:00:00Z'), end: new Date('2023-01-01T01:00:00Z') },
  };
}

describe('PrometheusPromQLVariable', () => {
  beforeEach(() => {
    fetchJson.mockReset();
  });

  it('should return the values of the label found in the result of the query', async () => {
    fetchJson.mockResolvedValue({
      status: 'success',
      data: {
        resultType: 'vector',
        result: [
          { metric: { job: 'node' }, value: [1672531200, '1'] },
          { metric: { job: 'prometheus' }, value: [1672531200, '1'] },
          { metric: { job: 'node' }, value: [1672531200, '1'] },
        ],
      },
    });

    const { data } = await PrometheusPromQLVariable.getVariableOptions(
      { expr: 'up', labelName: 'job' },
      createContext(),
    );

    expect(data).toEqual([
      { value: 'node', label: 'node' },
      { value: 'prometheus', label: 'prometheus' },
    ]);
  });

  it('should throw the error of a query answered with an error body', async () => {
    fetchJson.mockResolvedValue({
      status: 'error',
      errorType: 'bad_data',
      error: 'parse error: unexpected end of input',
    });

    await expect(
      PrometheusPromQLVariable.getVariableOptions({ expr: 'sum(', labelName: 'job' }, createContext()),
    ).rejects.toThrow('parse error: unexpected end of input');
  });
});
