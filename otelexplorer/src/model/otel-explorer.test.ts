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

import { DatasourcePlugin } from '@perses-dev/plugin-system';

import {
  createOTelAttributeFilter,
  isValidOTelDuration,
  isOTelExplorerDatasourcePlugin,
  OTelExplorerDatasourcePlugin,
  validAttributeFilters,
} from './otel-explorer';

const datasource: DatasourcePlugin = {
  createClient: () => ({}),
  createInitialOptions: () => ({}),
};

describe('OTel explorer model', () => {
  it('recognizes a datasource with at least one OTel signal capability', () => {
    const otelDatasource: OTelExplorerDatasourcePlugin = {
      ...datasource,
      otelExplorer: {
        traces: {
          createQuery: ({ datasource: selectedDatasource }) => ({
            kind: 'TraceQuery',
            spec: { plugin: { kind: 'ExampleTraceQuery', spec: { datasource: selectedDatasource } } },
          }),
        },
      },
    };
    expect(isOTelExplorerDatasourcePlugin(otelDatasource)).toBe(true);
    expect(isOTelExplorerDatasourcePlugin(datasource)).toBe(false);
    expect(isOTelExplorerDatasourcePlugin({ ...datasource, otelExplorer: { metrics: {} } } as DatasourcePlugin)).toBe(
      false,
    );
    expect(
      isOTelExplorerDatasourcePlugin({
        ...otelDatasource,
        otelExplorer: { metrics: { createQuery: () => ({}), getMetricNames: [] } },
      } as unknown as DatasourcePlugin),
    ).toBe(false);
    expect(
      isOTelExplorerDatasourcePlugin({
        ...otelDatasource,
        otelExplorer: { logs: { createQuery: () => ({}), getSignalFieldValues: 'invalid' } },
      } as unknown as DatasourcePlugin),
    ).toBe(false);
  });

  it('creates an empty equality filter and removes incomplete filters', () => {
    const filter = createOTelAttributeFilter('one');
    expect(filter).toEqual({ id: 'one', key: '', operator: '=', value: '' });
    expect(validAttributeFilters([filter, { ...filter, id: 'two', key: 'service.name', value: 'checkout' }])).toEqual([
      { id: 'two', key: 'service.name', operator: '=', value: 'checkout' },
    ]);
  });

  it('validates trace duration inputs', () => {
    expect(isValidOTelDuration('')).toBe(true);
    expect(isValidOTelDuration('100ms')).toBe(true);
    expect(isValidOTelDuration('1.5s')).toBe(true);
    expect(isValidOTelDuration('100')).toBe(false);
  });
});
