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
import { getTraceData } from './get-trace-data';
import { traceDetail, traceSearch } from './trace-data';

const TRACE = '0123456789abcdef0123456789abcdef';
const ROOT = '0000000000000001';
const CHILD = '0000000000000002';
const root = {
  TraceId: TRACE,
  TraceState: 'vendor=state',
  SpanId: ROOT,
  ParentSpanId: '',
  ServiceName: 'api',
  SpanName: 'GET /',
  SpanKind: 'Server',
  Timestamp: '2025-01-01 00:00:00.123456789',
  Duration: '1000000000',
  ResourceAttributes: { 'host.name': 'api-1' },
  ScopeName: 'http',
  ScopeVersion: '1',
};
const child = {
  ...root,
  SpanId: CHILD,
  ParentSpanId: ROOT,
  ServiceName: 'db',
  SpanName: 'SELECT',
  Timestamp: '2025-01-01 00:00:00.223456789',
  Duration: '250000000',
  StatusCode: 'Error',
  StatusMessage: 'timeout',
  SpanAttributes: { 'db.system': 'clickhouse' },
  'Events.Timestamp': ['2025-01-01 00:00:00.223456799'],
  'Events.Name': ['exception'],
  'Events.Attributes': [{ 'exception.message': 'timeout' }],
  'Links.TraceId': [TRACE],
  'Links.SpanId': [ROOT],
  'Links.TraceState': ['vendor=linked'],
  'Links.Attributes': [{ retry: true }],
};

describe('ClickHouse traces', () => {
  it('aggregates spans into root names, complete duration and service error counts', () => {
    expect(traceSearch([child, root])).toEqual([
      {
        traceId: TRACE,
        rootServiceName: 'api',
        rootTraceName: 'GET /',
        startTimeUnixMs: Number(1735689600123456789n) / 1_000_000,
        durationMs: 1000,
        serviceStats: { api: { spanCount: 1 }, db: { spanCount: 1, errorCount: 1 } },
      },
    ]);
  });

  it('preserves nanoseconds, parent IDs, resources, events, links and status in OTLP detail', () => {
    const result = traceDetail([child, root]);
    const spans = result.resourceSpans.flatMap((resource) => resource.scopeSpans.flatMap((scope) => scope.spans));
    expect(spans[0]).toMatchObject({
      spanId: ROOT,
      traceState: 'vendor=state',
      kind: 'SPAN_KIND_SERVER',
      startTimeUnixNano: '1735689600123456789',
      endTimeUnixNano: '1735689601123456789',
    });
    expect(spans[1]).toMatchObject({
      spanId: CHILD,
      parentSpanId: ROOT,
      status: { code: 'STATUS_CODE_ERROR', message: 'timeout' },
      attributes: [{ key: 'db.system', value: { stringValue: 'clickhouse' } }],
      events: [{ name: 'exception', timeUnixNano: '1735689600223456799' }],
      links: [
        {
          traceId: TRACE,
          spanId: ROOT,
          traceState: 'vendor=linked',
          attributes: [{ key: 'retry', value: { boolValue: true } }],
        },
      ],
    });
    expect(result.resourceSpans[0]?.resource?.attributes).toContainEqual({
      key: 'service.name',
      value: { stringValue: 'api' },
    });
  });

  it('keeps separate resource attributes for multiple instances of the same service', () => {
    expect(
      traceDetail([root, { ...child, ServiceName: 'api', ResourceAttributes: { 'host.name': 'api-2' } }]).resourceSpans,
    ).toHaveLength(2);
  });

  it('rejects malformed IDs, durations and mixed traces in detail mode', () => {
    expect(() => traceDetail([{ ...root, TraceId: 'bad' }])).toThrow('TraceId');
    expect(() => traceDetail([{ ...root, Duration: '-1' }])).toThrow('Duration');
    expect(() => traceDetail([root, { ...child, TraceId: 'f'.repeat(32) }])).toThrow('one trace');
    expect(traceDetail([])).toEqual({ resourceSpans: [] });
  });

  it('looks up a trace ID in the configured table without clipping it to the dashboard range', async () => {
    const context = createContext([root, child]);
    const result = await getTraceData({ query: TRACE.toUpperCase(), table: 'observability.otel_traces' }, context);
    expect(result.trace?.resourceSpans).toHaveLength(2);
    expect(context.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'SELECT * FROM "observability"."otel_traces" WHERE TraceId = \'' + TRACE + "' ORDER BY Timestamp",
      }),
    );
    expect(result.metadata?.executedQueryString).not.toContain('BETWEEN');
  });

  it('uses explicit result modes and supports SQL variables and cancellation', async () => {
    const ctx = createContext([root]);
    ctx.variableState.id = { value: TRACE, loading: false };
    const signal = new AbortController().signal;
    const spec = { query: 'SELECT * FROM custom WHERE TraceId = ${id:sqlstring}' };
    expect((await getTraceData(spec, ctx)).searchResult).toHaveLength(1);
    expect((await getTraceData({ ...spec, mode: 'trace' }, ctx, signal)).trace).toBeDefined();
    expect(ctx.query).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: "SELECT * FROM custom WHERE TraceId = '" + TRACE + "'",
      }),
      undefined,
      signal,
    );
  });
});
