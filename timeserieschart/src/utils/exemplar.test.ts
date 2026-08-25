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

import { buildExemplarSeries, getTimeSeriesExemplars, loadTraceSummary } from './exemplar';

describe('exemplars', () => {
  it('extracts valid Prometheus exemplars from query metadata', () => {
    const exemplars = getTimeSeriesExemplars([
      {
        data: {
          series: [],
          metadata: {
            tracingDatasource: { kind: 'TempoDatasource', name: 'tempo' },
            exemplars: [
              {
                seriesLabels: { service: 'api' },
                exemplars: [{ labels: { trace_id: 'abc' }, value: '42.5', timestamp: 123.25 }],
              },
            ],
          },
        },
      },
    ]);

    expect(exemplars).toEqual([
      {
        labels: { trace_id: 'abc' },
        seriesLabels: { service: 'api' },
        timestamp: 123250,
        tracingDatasource: { kind: 'TempoDatasource', name: 'tempo' },
        value: 42.5,
      },
    ]);
  });

  it('extracts exemplars without a tracing datasource', () => {
    const exemplars = getTimeSeriesExemplars([
      {
        data: {
          series: [],
          metadata: {
            exemplars: [
              {
                seriesLabels: { service: 'api' },
                exemplars: [{ labels: { trace_id: 'abc', span_id: 'def' }, value: '42.5', timestamp: 123.25 }],
              },
            ],
          },
        },
      },
    ]);

    expect(exemplars).toEqual([
      {
        labels: { trace_id: 'abc', span_id: 'def' },
        seriesLabels: { service: 'api' },
        timestamp: 123250,
        value: 42.5,
      },
    ]);
  });

  it('builds an interactive diamond marker for each exemplar', () => {
    const exemplar = {
      labels: { trace_id: 'abc' },
      seriesLabels: { service: 'api' },
      timestamp: 123250,
      tracingDatasource: { kind: 'TempoDatasource', name: 'tempo' },
      value: 42.5,
    };

    const series = buildExemplarSeries([exemplar], '#ff0000');

    expect(series[0]?.markPoint).toMatchObject({
      symbol: 'diamond',
      data: [{ coord: [123250, 42.5], exemplarIndex: 0, itemStyle: { color: '#ff0000' } }],
    });
  });

  it('loads a Tempo trace summary through the query client method', async () => {
    const summary = await loadTraceSummary(
      {
        query: vi.fn(async () => ({
          trace: {
            resourceSpans: [
              {
                resource: { attributes: [{ key: 'service.name', value: { stringValue: 'checkout' } }] },
                scopeSpans: [
                  {
                    spans: [
                      {
                        name: 'POST /orders',
                        parentSpanId: '',
                        startTimeUnixNano: '1000000',
                        endTimeUnixNano: '6000000',
                      },
                      { name: 'db', parentSpanId: 'root', startTimeUnixNano: '2000000', endTimeUnixNano: '3000000' },
                    ],
                  },
                ],
              },
            ],
          },
        })),
      },
      'abc',
    );

    expect(summary).toEqual({ serviceName: 'checkout', operationName: 'POST /orders', durationMs: 5, spanCount: 2 });
  });

  it('loads a Jaeger trace summary through the getTrace client method', async () => {
    const summary = await loadTraceSummary(
      {
        getTrace: vi.fn(async () => ({
          data: [
            {
              processes: { p1: { serviceName: 'checkout' } },
              spans: [{ operationName: 'POST /orders', processID: 'p1', references: [], duration: 5000 }],
            },
          ],
        })),
      },
      'abc',
    );

    expect(summary).toEqual({ serviceName: 'checkout', operationName: 'POST /orders', durationMs: 5, spanCount: 1 });
  });
});
