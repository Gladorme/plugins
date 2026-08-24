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

import { GetVariableOptionsContext } from '@perses-dev/plugin-system';

import { ClickHouseDatasourceClient } from '../datasources';
import { getPluginModule } from '../getPluginModule';
import { ClickHouseLabelNamesVariable } from './ClickHouseLabelNamesVariable';
import { ClickHouseLabelValuesVariable } from './ClickHouseLabelValuesVariable';
import { ClickHouseQueryVariable } from './ClickHouseQueryVariable';
import { queryDataToLabelNames, queryDataToLabelValues, queryDataToVariableOptions } from './utils';

function createContext(data: unknown): {
  context: GetVariableOptionsContext;
  query: jest.Mock;
} {
  const query = jest.fn(async () => ({ status: 'success', data }));
  const client: ClickHouseDatasourceClient = {
    options: { datasourceUrl: '/clickhouse' },
    query,
  };
  const context = {
    datasourceStore: {
      getDatasourceClient: jest.fn(async () => client),
      listDatasourceSelectItems: jest.fn(async () => []),
    },
    timeRange: {
      start: new Date('2026-08-24T10:00:00.000Z'),
      end: new Date('2026-08-24T11:00:00.000Z'),
    },
    variables: {
      environment: { value: 'production', loading: false },
      label: { value: 'service.name', loading: false },
    },
  } as unknown as GetVariableOptionsContext;
  return { context, query };
}

describe('ClickHouse variable result mapping', () => {
  it('uses the first column for regular query results and supports __text/__value aliases', () => {
    expect(
      queryDataToVariableOptions([
        { service: 'api' },
        { __text: 'Worker service', __value: 'worker' },
        { service: 'api' },
      ]),
    ).toEqual([
      { label: 'api', value: 'api' },
      { label: 'Worker service', value: 'worker' },
    ]);
  });

  it('returns top-level columns as label names', () => {
    expect(queryDataToLabelNames([{ service: 'api', environment: 'production' }])).toEqual([
      { label: 'service', value: 'service' },
      { label: 'environment', value: 'environment' },
    ]);
  });

  it('returns keys from a single ClickHouse Map/object column as label names', () => {
    expect(
      queryDataToLabelNames([
        { ResourceAttributes: { 'service.name': 'api', 'deployment.environment': 'production' } },
      ]),
    ).toEqual([
      { label: 'service.name', value: 'service.name' },
      { label: 'deployment.environment', value: 'deployment.environment' },
    ]);
  });

  it('returns unique values from both columns and ClickHouse Map/object keys', () => {
    expect(queryDataToLabelValues([{ service: 'api' }, { service: 'worker' }, { service: 'api' }], 'service')).toEqual([
      { label: 'api', value: 'api' },
      { label: 'worker', value: 'worker' },
    ]);
    expect(
      queryDataToLabelValues(
        [{ ResourceAttributes: { 'service.name': 'api' } }, { ResourceAttributes: { 'service.name': 'worker' } }],
        'service.name',
      ),
    ).toEqual([
      { label: 'api', value: 'api' },
      { label: 'worker', value: 'worker' },
    ]);
  });
});

describe('ClickHouse variable plugins', () => {
  it('registers every ClickHouse variable plugin in the module manifest', () => {
    const pluginNames = getPluginModule().spec.plugins.map((plugin) => plugin.spec.name);
    expect(pluginNames).toEqual(
      expect.arrayContaining([
        'ClickHouseQueryVariable',
        'ClickHouseLabelNamesVariable',
        'ClickHouseLabelValuesVariable',
      ]),
    );
  });

  it('interpolates chained variables and time placeholders before executing a query variable', async () => {
    const { context, query } = createContext([{ __text: 'Production', __value: 'production' }]);

    const result = await ClickHouseQueryVariable.getVariableOptions(
      {
        query:
          "SELECT environment AS __value FROM deployments WHERE environment = '$environment' AND time BETWEEN '{start}' AND '{end}'",
      },
      context,
    );

    expect(query).toHaveBeenCalledWith({
      query:
        "SELECT environment AS __value FROM deployments WHERE environment = 'production' AND time BETWEEN '2026-08-24 10:00:00' AND '2026-08-24 11:00:00'",
      start: '2026-08-24 10:00:00',
      end: '2026-08-24 11:00:00',
    });
    expect(result.data).toEqual([{ label: 'Production', value: 'production' }]);
  });

  it('creates label name options from query results', async () => {
    const { context } = createContext([{ service: 'api', environment: 'production' }]);
    const result = await ClickHouseLabelNamesVariable.getVariableOptions({ query: 'SELECT * FROM logs' }, context);
    expect(result.data).toEqual([
      { label: 'service', value: 'service' },
      { label: 'environment', value: 'environment' },
    ]);
  });

  it('does not contact ClickHouse for an empty variable query', async () => {
    const { context, query } = createContext([{ service: 'api' }]);
    const result = await ClickHouseQueryVariable.getVariableOptions({ query: '  ' }, context);
    expect(query).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
  });

  it('interpolates the label name when creating label value options', async () => {
    const { context } = createContext([
      { ResourceAttributes: { 'service.name': 'api' } },
      { ResourceAttributes: { 'service.name': 'worker' } },
    ]);
    const result = await ClickHouseLabelValuesVariable.getVariableOptions(
      { query: 'SELECT ResourceAttributes FROM logs', labelName: '$label' },
      context,
    );
    expect(result.data).toEqual([
      { label: 'api', value: 'api' },
      { label: 'worker', value: 'worker' },
    ]);
  });

  it('reports query, label, and datasource variable dependencies without duplicates', () => {
    expect(
      ClickHouseLabelValuesVariable.dependsOn?.(
        {
          query: "SELECT * FROM logs WHERE environment = '$environment' AND service = '$label'",
          labelName: '$label',
          datasource: '$clickhouseDatasource',
        },
        createContext([]).context,
      ),
    ).toEqual({ variables: ['environment', 'label', 'clickhouseDatasource'] });
  });

  it('creates empty initial specs for all ClickHouse variable types', () => {
    expect(ClickHouseQueryVariable.createInitialOptions()).toEqual({ query: '' });
    expect(ClickHouseLabelNamesVariable.createInitialOptions()).toEqual({ query: '' });
    expect(ClickHouseLabelValuesVariable.createInitialOptions()).toEqual({ query: '', labelName: '' });
  });
});
