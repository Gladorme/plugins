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

import { createContext } from '../../../test/context';
import { getTimeSeriesData } from './get-click-house-data';
import { buildOpenTelemetryMetrics } from './otel-metrics';

const time = '2025-01-01 00:00:00';
const ms = 1735689600000;
const base = {
  TimeUnix: time,
  MetricName: 'latency',
  ServiceName: 'api',
  ResourceAttributes: { 'service.instance.id': 'one' },
  Attributes: { method: 'GET' },
  ScopeName: 'http',
  ScopeVersion: '1',
  MetricUnit: 's',
  Flags: 0,
};
const explicit = { ...base, Count: '6', Sum: 12, ExplicitBounds: [1, 2], BucketCounts: ['1', '2', '3'] };

describe('OpenTelemetry metrics', () => {
  it('uses the latest native sample for instant panels and does not revive stale histograms', async () => {
    const rows = [explicit, { ...explicit, TimeUnix: '2025-01-01 00:01:00', Sum: 20 }];
    const result = await getTimeSeriesData(
      { query: 'SELECT * FROM otel_metrics_histogram' },
      { ...createContext(rows), mode: 'instant' },
    );
    expect(result.series[0]?.values).toEqual([[ms + 60000, 20]]);
    expect(result.series[0]?.histograms).toHaveLength(1);
    expect(result.series[0]?.histograms?.[0]?.[0]).toBe((ms + 60000) / 1000);
    expect(
      buildOpenTelemetryMetrics([...rows, { ...explicit, TimeUnix: '2025-01-01 00:02:00', Flags: 1 }], true).series[0]
        ?.histograms,
    ).toEqual([]);
  });

  it('recognizes Collector gauge and sum rows without turning flags and start times into metrics', async () => {
    const ctx = createContext([
      { ...base, Value: 7, StartTimeUnix: '2024-12-31 00:00:00', IsMonotonic: true, AggregationTemporality: 2 },
      {
        ...base,
        Value: 8,
        StartTimeUnix: time,
        IsMonotonic: true,
        AggregationTemporality: 2,
        TimeUnix: '2025-01-01 00:01:00',
      },
    ]);
    const result = await getTimeSeriesData({ query: 'SELECT * FROM otel_metrics_sum' }, ctx);
    expect(result.series).toHaveLength(1);
    expect(result.series[0]).toMatchObject({
      name: 'latency',
      values: [
        [ms, 7],
        [ms + 60000, 8],
      ],
      labels: {
        __name__: 'latency',
        'Attributes.method': 'GET',
        'ResourceAttributes.service.instance.id': 'one',
        IsMonotonic: 'true',
      },
    });
    expect(result.stepMs).toBe(60000);
  });

  it('keeps metric names, resources, and instrumentation scopes distinct', () => {
    expect(
      buildOpenTelemetryMetrics([
        { ...base, Value: 1 },
        { ...base, Value: 2, MetricName: 'requests' },
        { ...base, Value: 3, ResourceAttributes: { 'service.instance.id': 'two' } },
        { ...base, Value: 4, ScopeName: 'rpc' },
      ]).series,
    ).toHaveLength(4);
  });

  it('preserves noncumulative explicit buckets, unbounded tails and count precision', () => {
    const result = buildOpenTelemetryMetrics([explicit]);
    expect(result.series[0]).toMatchObject({
      values: [[ms, 12]],
      histograms: [
        [
          ms / 1000,
          {
            count: 6,
            sum: '12',
            buckets: [
              [0, '-Infinity', '1', '1'],
              [0, '1', '2', '2'],
              [0, '2', 'Infinity', '3'],
            ],
          },
        ],
      ],
    });
    const big = '9007199254740993';
    const precision = buildOpenTelemetryMetrics([{ ...explicit, Count: big, BucketCounts: [big, '0', '0'] }]);
    expect(precision.series[0]?.histograms?.[0]?.[1].buckets?.[0]?.[3]).toBe(big);
  });

  it('reconstructs negative, positive and zero exponential buckets with their boundary rules', () => {
    const result = buildOpenTelemetryMetrics([
      {
        ...base,
        Count: '15',
        Sum: 8,
        Scale: 0,
        ZeroCount: '5',
        ZeroThreshold: 0.25,
        PositiveOffset: -1,
        PositiveBucketCounts: ['1', '2'],
        NegativeOffset: -1,
        NegativeBucketCounts: ['3', '4'],
      },
    ]);
    expect(result.series[0]?.histograms?.[0]?.[1].buckets).toEqual([
      [1, '-2', '-1', '4'],
      [1, '-1', '-0.5', '3'],
      [3, '-0.25', '0.25', '5'],
      [0, '0.5', '1', '1'],
      [0, '1', '2', '2'],
    ]);
  });

  it('handles positive and negative exponential scales', () => {
    const row = {
      ...base,
      Count: '1',
      Sum: 3,
      ZeroCount: 0,
      PositiveOffset: 1,
      PositiveBucketCounts: [1],
      NegativeOffset: 0,
      NegativeBucketCounts: [],
    };
    expect(buildOpenTelemetryMetrics([{ ...row, Scale: -1 }]).series[0]?.histograms?.[0]?.[1].buckets).toEqual([
      [0, '4', '16', '1'],
    ]);
    expect(buildOpenTelemetryMetrics([{ ...row, Scale: 1 }]).series[0]?.histograms?.[0]?.[1].buckets).toEqual([
      [0, String(Math.SQRT2), '2', '1'],
    ]);
  });

  it('converts summary quantiles, counts and sums into separate series', () => {
    const result = buildOpenTelemetryMetrics([
      {
        ...base,
        Count: '4',
        Sum: 10,
        'ValueAtQuantiles.Quantile': [0.5, 0.99],
        'ValueAtQuantiles.Value': [2, 7],
      },
    ]);
    expect(result.series.map(({ name, values, labels }) => [name, labels?.quantile, values])).toEqual([
      ['latency_count', undefined, [[ms, 4]]],
      ['latency_sum', undefined, [[ms, 10]]],
      ['latency', '0.5', [[ms, 2]]],
      ['latency', '0.99', [[ms, 7]]],
    ]);
  });

  it('attaches timestamped exemplars to the matching metric with trace and span IDs', () => {
    const result = buildOpenTelemetryMetrics([
      {
        ...base,
        Value: 7,
        'Exemplars.Value': [2],
        'Exemplars.TimeUnix': ['2025-01-01 00:00:00.123'],
        'Exemplars.TraceId': ['0123456789abcdef0123456789abcdef'],
        'Exemplars.SpanId': ['0000000000000001'],
        'Exemplars.FilteredAttributes': [{ env: 'prod' }],
      },
    ]);
    expect(result.exemplars).toEqual([
      {
        seriesLabels: result.series[0]?.labels,
        exemplars: [
          {
            value: 2,
            timestamp: ms + 123,
            labels: {
              env: 'prod',
              trace_id: '0123456789abcdef0123456789abcdef',
              span_id: '0000000000000001',
            },
          },
        ],
      },
    ]);
  });

  it('supports nested JSON arrays and omits no-recorded-value samples and exemplars', () => {
    const result = buildOpenTelemetryMetrics([
      { ...base, Value: 12, Flags: 1, Exemplars: { Value: [2], TimeUnix: [time] } },
      { ...base, Value: 10, TimeUnix: '2025-01-01 00:01:00', Exemplars: { Value: [10], TimeUnix: [time] } },
    ]);
    expect(result.series[0]?.values).toEqual([
      [ms, null],
      [ms + 60000, 10],
    ]);
    expect(result.exemplars?.[0]?.exemplars).toHaveLength(1);
    expect(buildOpenTelemetryMetrics([{ ...explicit, Flags: 1 }]).series[0]?.histograms).toBeUndefined();
  });

  it('rejects malformed histogram, summary and exemplar arrays instead of displaying wrong data', () => {
    expect(() => buildOpenTelemetryMetrics([{ ...explicit, BucketCounts: [1, 2] }])).toThrow('one more entry');
    expect(() => buildOpenTelemetryMetrics([{ ...explicit, ExplicitBounds: [2, 1] }])).toThrow('strictly increasing');
    expect(() => buildOpenTelemetryMetrics([{ ...explicit, Count: 5 }])).toThrow('do not match');
    expect(() =>
      buildOpenTelemetryMetrics([{ ...base, Value: 1, Exemplars: { Value: [1, 2], TimeUnix: [time] } }]),
    ).toThrow('matching lengths');
    expect(() =>
      buildOpenTelemetryMetrics([{ ...base, Count: 1, Sum: 1, ValueAtQuantiles: { Quantile: [2], Value: [1] } }]),
    ).toThrow('between 0 and 1');
  });
});
