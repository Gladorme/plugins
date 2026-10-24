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
import { getVariableOptions } from '../variables/get-variable-options';
import { ClickHouseLogQuery } from './click-house-log-query/ClickHouseLogQuery';
import { getClickHouseLogData } from './click-house-log-query/get-click-house-log-data';
import { getTimeSeriesData } from './click-house-time-series-query/get-click-house-data';

describe('ClickHouse metrics and logs', () => {
  it('groups labels, preserves null gaps, uses metadata for numeric-looking labels, and sorts points', async () => {
    const context = createContext(
      [
        { time: '2025-01-01 00:01:00', value: '2.5', code: '200', labels: { service: 'api' } },
        { time: '2025-01-01 00:00:00', value: null, code: '200', labels: { service: 'api' } },
        { time: '2025-01-01 00:00:30', value: 8, code: '500', labels: { service: 'worker' } },
        { time: '2025-01-01 00:01:30', value: 9, code: '500', labels: { service: 'worker' } },
      ],
      [
        { name: 'value', type: 'Nullable(Float64)' },
        { name: 'code', type: 'String' },
      ],
    );
    const result = await getTimeSeriesData({ query: 'SELECT metrics' }, context);
    expect(result.series).toEqual([
      {
        name: 'value',
        labels: { code: '200', service: 'api' },
        values: [
          [1735689600000, null],
          [1735689660000, 2.5],
        ],
      },
      {
        name: 'value',
        labels: { code: '500', service: 'worker' },
        values: [
          [1735689630000, 8],
          [1735689690000, 9],
        ],
      },
    ]);
    expect(result.stepMs).toBe(60000);
  });

  it('preserves all-null metric columns when ClickHouse metadata identifies them', async () => {
    const result = await getTimeSeriesData(
      { query: 'SELECT metrics' },
      createContext([{ time: 0, value: null }], [{ name: 'value', type: 'Nullable(Float64)' }]),
    );
    expect(result.series).toEqual([{ name: 'value', values: [[0, null]] }]);
  });

  it('maps OTel logs to seconds, body and string labels with correlation IDs', async () => {
    const result = await getClickHouseLogData(
      { query: 'SELECT logs' },
      createContext([
        {
          Timestamp: '2025-01-01 00:00:00.123456789',
          Body: 'request failed',
          SeverityText: 'ERROR',
          TraceId: 'abc',
          SpanId: 'def',
          LogAttributes: { status: 503, retry: false },
        },
      ]),
    );
    expect(result.logs.entries[0]).toMatchObject({
      timestamp: 1735689600.1234567,
      line: 'request failed',
      labels: {
        TraceId: 'abc',
        SpanId: 'def',
        SeverityText: 'ERROR',
        'LogAttributes.status': '503',
        'LogAttributes.retry': 'false',
      },
    });
  });

  it('supports legacy log_time, custom timestamp columns, empty bodies and zero timestamps', async () => {
    const legacy = await getClickHouseLogData({ query: 'SELECT logs' }, createContext([{ log_time: 0, message: '' }]));
    expect(legacy.logs.entries[0]).toMatchObject({ timestamp: 0, line: '' });
    const custom = await getClickHouseLogData(
      { query: 'SELECT logs', timeColumn: 'created' },
      createContext([{ created: '2025-01-01T01:00:00+01:00', message: 'hello' }]),
    );
    expect(custom.logs.entries[0]).toMatchObject({ timestamp: 1735689600, line: 'hello' });
  });

  it('produces a volume query over the selected result and handles trailing FORMAT JSON', () => {
    const result = ClickHouseLogQuery.createVolumeQuery?.(
      {
        query: 'SELECT event_time FROM logs WHERE level = 3 FORMAT JSON;',
        timeColumn: 'event_time',
        datasource: '$source',
      },
      createContext(),
    );
    expect(result).toMatchObject({
      kind: 'TimeSeriesQuery',
      spec: {
        plugin: {
          kind: 'ClickHouseTimeSeriesQuery',
          spec: {
            datasource: '$source',
            query: expect.stringContaining('toStartOfInterval("event_time", INTERVAL {step} SECOND)'),
          },
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('FORMAT JSON');
  });

  it('does not query for empty editors', async () => {
    const ctx = createContext();
    expect((await getTimeSeriesData({ query: '  ' }, ctx)).series).toEqual([]);
    expect((await getClickHouseLogData({ query: '  ' }, ctx)).logs.entries).toEqual([]);
    expect(ctx.query).not.toHaveBeenCalled();
  });
});

describe('ClickHouse annotations and variables', () => {
  it('returns point and range annotations with millisecond times and tags', async () => {
    const ctx = createContext([
      { start: '2025-01-01 00:00:00', title: 'deploy', tags: { version: 2 } },
      { start: 10, end: 20, title: 'incident', legend: 'api', tags: { env: 'prod' } },
    ]);
    expect(await getAnnotationData({ query: 'SELECT events' }, ctx)).toEqual([
      { start: 1735689600000, title: 'deploy', tags: { version: '2' } },
      { start: 10, end: 20, title: 'incident', legend: 'api', tags: { env: 'prod' } },
    ]);
    await expect(
      getAnnotationData({ query: 'SELECT events' }, createContext([{ start: 20, end: 10 }])),
    ).rejects.toThrow('end precedes start');
  });

  it('returns unique variable values, preserves labels and skips SQL NULL', async () => {
    expect(
      await getVariableOptions(
        { query: 'SELECT services' },
        createContext([
          { value: 0, label: 'zero' },
          { value: 'api', label: 'API' },
          { value: 'api', label: 'duplicate' },
          { value: null },
          { value: false },
        ]),
      ),
    ).toEqual({
      data: [
        { value: '0', label: 'zero' },
        { value: 'api', label: 'API' },
        { value: 'false', label: 'false' },
      ],
    });
  });

  it('supports first-column and configurable columns for custom schemas', async () => {
    expect(
      await getVariableOptions({ query: 'SELECT DISTINCT service' }, createContext([{ ServiceName: 'api' }])),
    ).toEqual({ data: [{ value: 'api', label: 'api' }] });
    expect(
      await getVariableOptions(
        { query: 'SELECT services', valueColumn: 'id', labelColumn: 'name' },
        createContext([{ id: 42, name: 'production' }]),
      ),
    ).toEqual({ data: [{ value: '42', label: 'production' }] });
    await expect(
      getVariableOptions({ query: 'SELECT services', valueColumn: 'missing' }, createContext([{ id: 42 }])),
    ).rejects.toThrow('value column is missing');
  });

  it('interpolates chained variables and propagates cancellation', async () => {
    const ctx = createContext([{ value: 'api' }]);
    ctx.variables.env = { value: ['prod', 'staging'], loading: false };
    const signal = new AbortController().signal;
    await getVariableOptions({ query: 'SELECT value WHERE env IN (${env:sqlstring})' }, ctx, signal);
    expect(ctx.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "SELECT value WHERE env IN ('prod','staging')",
      }),
      undefined,
      signal,
    );
  });
});
