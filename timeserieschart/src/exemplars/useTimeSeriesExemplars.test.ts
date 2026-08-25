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

import type { DatasourceStore, PanelData } from '@perses-dev/plugin-system';
import type { TimeSeriesData } from '@perses-dev/spec';

import { fetchTimeSeriesExemplars, getExemplarQueryDescriptors } from './useTimeSeriesExemplars';

const QUERY_RESULTS = [
  {
    definition: {
      kind: 'TimeSeriesQuery',
      spec: { plugin: { kind: 'PrometheusTimeSeriesQuery', spec: { query: 'up' } } },
    },
    data: {
      series: [],
      metadata: {
        exemplarQuery: {
          datasource: { kind: 'PrometheusDatasource', name: 'prometheus' },
          query: 'up',
          requestOptions: { headers: { 'X-Scope-OrgID': 'tenant-a' } },
          start: 100,
          end: 200,
        },
        tracingDatasource: { kind: 'TempoDatasource', name: 'tempo' },
      },
    },
  },
] satisfies Array<PanelData<TimeSeriesData>>;

describe('useTimeSeriesExemplars helpers', () => {
  it('extracts panel-controlled exemplar request descriptors', () => {
    expect(getExemplarQueryDescriptors(QUERY_RESULTS)).toEqual([
      {
        datasource: { kind: 'PrometheusDatasource', name: 'prometheus' },
        query: 'up',
        requestOptions: { headers: { 'X-Scope-OrgID': 'tenant-a' } },
        start: 100,
        end: 200,
        tracingDatasource: { kind: 'TempoDatasource', name: 'tempo' },
      },
    ]);
  });

  it('fetches and parses exemplars through the query datasource', async () => {
    const exemplarQuery = vi.fn(async () => ({
      status: 'success',
      data: [
        {
          seriesLabels: { service: 'api' },
          exemplars: [{ labels: { trace_id: 'trace-123', span_id: 'span-456' }, value: '0.123', timestamp: 150 }],
        },
      ],
    }));
    const datasourceStore = {
      getDatasourceClient: vi.fn(async () => ({ exemplarQuery })),
    } as unknown as DatasourceStore;

    const exemplars = await fetchTimeSeriesExemplars(
      getExemplarQueryDescriptors(QUERY_RESULTS),
      datasourceStore,
      new AbortController().signal,
    );

    expect(exemplarQuery).toHaveBeenCalledWith(
      { query: 'up', start: 100, end: 200 },
      { headers: { 'X-Scope-OrgID': 'tenant-a' }, signal: expect.any(AbortSignal) },
    );
    expect(exemplars).toEqual([
      {
        labels: { trace_id: 'trace-123', span_id: 'span-456' },
        seriesLabels: { service: 'api' },
        timestamp: 150000,
        tracingDatasource: { kind: 'TempoDatasource', name: 'tempo' },
        value: 0.123,
      },
    ]);
  });
});
