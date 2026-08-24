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
          queryType: 'TraceQuery',
          queryPluginKind: 'ExampleTraceQuery',
          applyAttributeFilters: ({ query }) => query,
        },
      },
    };
    expect(isOTelExplorerDatasourcePlugin(otelDatasource)).toBe(true);
    expect(isOTelExplorerDatasourcePlugin(datasource)).toBe(false);
    expect(isOTelExplorerDatasourcePlugin({ ...datasource, otelExplorer: { metrics: {} } } as DatasourcePlugin)).toBe(
      false,
    );
  });

  it('creates an empty equality filter and removes incomplete filters', () => {
    const filter = createOTelAttributeFilter('one');
    expect(filter).toEqual({ id: 'one', key: '', operator: '=', value: '' });
    expect(validAttributeFilters([filter, { ...filter, id: 'two', key: 'service.name', value: 'checkout' }])).toEqual([
      { id: 'two', key: 'service.name', operator: '=', value: 'checkout' },
    ]);
  });
});
