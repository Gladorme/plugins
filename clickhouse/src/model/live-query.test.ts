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

import { createContext } from '../../test/context';
import { getAnnotationData } from '../annotations/get-annotation-data';
import {
  ANNOTATION_EXAMPLE,
  LOGS_EXAMPLE,
  METRICS_EXAMPLE,
  OTEL_GAUGE_EXAMPLE,
  OTEL_SUM_EXAMPLE,
  OTEL_HISTOGRAM_EXAMPLE,
  OTEL_EXP_HISTOGRAM_EXAMPLE,
  OTEL_SUMMARY_EXAMPLE,
  PROFILE_EXAMPLE,
  TRACE_SEARCH_EXAMPLE,
  VARIABLE_EXAMPLE,
} from '../components/query-examples';
import { ClickHouseLogQuery } from '../queries/click-house-log-query/ClickHouseLogQuery';
import { getClickHouseLogData } from '../queries/click-house-log-query/get-click-house-log-data';
import { getProfileData } from '../queries/click-house-profile-query/get-profile-data';
import { getTimeSeriesData } from '../queries/click-house-time-series-query/get-click-house-data';
import { getTraceData } from '../queries/click-house-trace-query/get-trace-data';
import { getVariableOptions } from '../variables/get-variable-options';
import type { ClickHouseClient } from './click-house-client';
import { query } from './click-house-client';
import { interpolateQuery } from './query';

const url = process.env.CLICKHOUSE_TEST_URL;

function context(): ReturnType<typeof createContext> {
  const ctx = createContext();
  const client: ClickHouseClient = {
    query: (params, headers, signal) => query(params, { datasourceUrl: url ?? '', headers, signal }),
  };
  vi.mocked(ctx.datasourceStore.getDatasourceClient).mockResolvedValue(client);
  return ctx;
}

describe.skipIf(!url)('live ClickHouse (load dev/fixture.sql first)', () => {
  it('converts all Collector metric tables and their nested arrays', async () => {
    const ctx = context();
    const gauge = await getTimeSeriesData({ query: OTEL_GAUGE_EXAMPLE }, ctx);
    expect(gauge.series).toHaveLength(2);
    expect(gauge.exemplars?.[0]?.exemplars[0]).toMatchObject({
      value: 10,
      labels: { trace_id: '0123456789abcdef0123456789abcdef' },
    });
    const sum = await getTimeSeriesData({ query: OTEL_SUM_EXAMPLE }, ctx);
    expect(sum.series[0]?.values).toEqual([
      [1735689600000, 12],
      [1735689660000, 15],
    ]);
    const histogram = await getTimeSeriesData({ query: OTEL_HISTOGRAM_EXAMPLE }, ctx);
    expect(histogram.series[0]?.histograms?.[0]).toEqual([
      1735689600,
      {
        count: 8,
        sum: '14',
        buckets: [
          [0, '-Infinity', '1', '1'],
          [0, '1', '2', '2'],
          [0, '2', '4', '4'],
          [0, '4', 'Infinity', '1'],
        ],
      },
    ]);
    expect(histogram.exemplars?.[0]?.exemplars).toHaveLength(1);
    const exponential = await getTimeSeriesData({ query: OTEL_EXP_HISTOGRAM_EXAMPLE }, ctx);
    expect(exponential.series[0]?.histograms?.[0]?.[1].buckets).toEqual([
      [1, '-2', '-1', '1'],
      [1, '-1', '-0.5', '2'],
      [3, '0', '0', '3'],
      [0, '0.5', '1', '1'],
      [0, '1', '2', '2'],
    ]);
    const summary = await getTimeSeriesData({ query: OTEL_SUMMARY_EXAMPLE }, ctx);
    expect(summary.series.map(({ name, values }) => [name, values])).toEqual([
      ['latency_count', [[1735689600000, 4]]],
      ['latency_sum', [[1735689600000, 10]]],
      ['latency', [[1735689600000, 2]]],
      ['latency', [[1735689600000, 7]]],
    ]);
  });

  it('executes the shipped metrics, logs, annotations and variable examples', async () => {
    const ctx = context();
    const metrics = await getTimeSeriesData({ query: METRICS_EXAMPLE }, ctx);
    expect(metrics.series).toHaveLength(2);
    expect(metrics.series.find((series) => series.labels?.service === 'api')?.values).toEqual([
      [1735689600000, 10],
      [1735689660000, 20],
    ]);
    const logs = await getClickHouseLogData({ query: LOGS_EXAMPLE }, ctx);
    expect(logs.logs.entries).toHaveLength(2);
    expect(logs.logs.entries[1]).toMatchObject({ line: 'request failed', timestamp: 1735689600.1234567 });
    const annotations = await getAnnotationData({ query: ANNOTATION_EXAMPLE }, ctx);
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatchObject({ title: 'request failed', tags: { 'http.status_code': '503' } });
    expect(await getVariableOptions({ query: VARIABLE_EXAMPLE }, ctx)).toEqual({
      data: [
        { value: 'api', label: 'api' },
        { value: 'worker', label: 'worker' },
      ],
    });
  });

  it('executes trace search and retrieves a full trace with nanosecond events', async () => {
    const ctx = context();
    const search = await getTraceData({ query: TRACE_SEARCH_EXAMPLE }, ctx);
    expect(search.searchResult).toHaveLength(1);
    expect(search.searchResult?.[0]).toMatchObject({ rootServiceName: 'api', durationMs: 1000 });
    const detail = await getTraceData({ query: '0123456789abcdef0123456789abcdef' }, ctx);
    const spans = detail.trace?.resourceSpans.flatMap((resource) =>
      resource.scopeSpans.flatMap((scope) => scope.spans),
    );
    expect(spans).toHaveLength(2);
    expect(spans?.[1]?.events?.[0]?.timeUnixNano).toBe('1735689600223456799');
    expect(spans?.[1]).toMatchObject({ traceState: 'vendor=state', links: [{ traceState: 'vendor=linked' }] });
  });

  it('executes Collector profiles, clips individual observations, and filters by variables and trace ID', async () => {
    const ctx = context();
    const profile = await getProfileData({ query: PROFILE_EXAMPLE }, ctx);
    expect(profile.profile.stackTrace).toMatchObject({ name: 'total', total: 42000000 });
    expect(profile.profile.stackTrace.children[0]).toMatchObject({ name: 'main (main.go:10)', total: 42000000 });
    expect(profile.timeline?.samples.reduce((a, b) => a + b, 0)).toBe(42000000);
    expect(profile.metadata?.units).toBe('nanoseconds');
    ctx.variableState.service = { value: 'api', loading: false };
    ctx.variableState.trace_id = { value: '0123456789abcdef0123456789abcdef', loading: false };
    ctx.absoluteTimeRange = { ...ctx.absoluteTimeRange, start: new Date('2025-01-01T00:00:01Z') };
    const filtered = await getProfileData(
      {
        query: PROFILE_EXAMPLE.replace(
          'ORDER BY',
          'AND ServiceName IN (${service:sqlstring}) AND TraceId = ${trace_id:sqlstring} ORDER BY',
        ),
      },
      ctx,
    );
    expect(filtered.profile.stackTrace.total).toBe(25000000);
    expect(filtered.profile.stackTrace.children[0]?.children[0]).toMatchObject({ self: 5000000, total: 25000000 });
    const counts = await getProfileData(
      { query: PROFILE_EXAMPLE.replace("'cpu' AND SampleUnit = 'nanoseconds'", "'samples' AND SampleUnit = 'count'") },
      context(),
    );
    expect(counts.profile.stackTrace.total).toBe(2);
  });

  it('accepts custom root-first stack aliases and byte weights', async () => {
    const result = await getProfileData(
      {
        query:
          "SELECT arrayReverse(FunctionNames) AS stack, arraySum(Values) AS value, Timestamp AS time, SampleType AS sampleType, SampleUnit AS unit FROM otel_profiles WHERE SampleUnit = 'bytes'",
      },
      context(),
    );
    expect(result.profile.stackTrace).toMatchObject({
      total: 4096,
      children: [
        { name: 'main', children: [{ name: 'api.handle', children: [{ name: 'runtime.malloc', self: 4096 }] }] },
      ],
    });
    expect(result.metadata?.units).toBe('bytes');
  });

  it('runs volume SQL and SQL string escaping against the server', async () => {
    const ctx = context();
    const volume = ClickHouseLogQuery.createVolumeQuery?.({ query: LOGS_EXAMPLE }, ctx);
    const spec = volume?.spec.plugin.spec;
    if (!spec || typeof spec.query !== 'string') throw new Error('missing volume query');
    expect((await getTimeSeriesData({ query: spec.query }, ctx)).series[0]?.values).toEqual([
      [1735689600000, 1],
      [1735689660000, 1],
    ]);
    const value = String.raw`it's a \path with '$variable'`;
    const response = await query(
      {
        query: interpolateQuery('SELECT ${value:sqlstring} AS value', { value: { value, loading: false } }),
      },
      { datasourceUrl: url ?? '' },
    );
    expect(response.data).toEqual([{ value }]);
  });
});
