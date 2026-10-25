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
import { ClickHouseAnnotationQuery } from '../annotations/ClickHouseAnnotationQuery';
import { ClickHouseVariable } from '../variables/ClickHouseVariable';
import { ClickHouseLogQuery } from './click-house-log-query/ClickHouseLogQuery';
import { ClickHouseProfileQuery } from './click-house-profile-query/ClickHouseProfileQuery';
import type { ClickHouseTimeSeriesQuerySpec } from './click-house-time-series-query/click-house-query-types';
import { ClickHouseTimeSeriesQuery } from './click-house-time-series-query/ClickHouseQuery';
import { ClickHouseTraceQuery } from './click-house-trace-query/ClickHouseTraceQuery';

const queryTypes = [
  ['metrics', ClickHouseTimeSeriesQuery.dependsOn, ClickHouseTimeSeriesQuery.getTimeSeriesData],
  ['logs', ClickHouseLogQuery.dependsOn, ClickHouseLogQuery.getLogData],
  ['traces', ClickHouseTraceQuery.dependsOn, ClickHouseTraceQuery.getTraceData],
  ['profiles', ClickHouseProfileQuery.dependsOn, ClickHouseProfileQuery.getProfileData],
  ['annotations', ClickHouseAnnotationQuery.dependsOn, ClickHouseAnnotationQuery.getAnnotationData],
  ['variable options', ClickHouseVariable.dependsOn, ClickHouseVariable.getVariableOptions],
] as const;

it.each(queryTypes)(
  '%s interpolate query, built-in and datasource variables with the same SQL rules',
  async (_, dependsOn, execute) => {
    const context = createContext();
    context.variableState.service = { value: ["app'one", 'worker'], loading: false };
    context.variableState['__test'] = { value: 'builtin', loading: false };
    context.variableState.source = { value: 'selected', loading: false };
    vi.mocked(context.datasourceStore.listDatasourceSelectItems).mockResolvedValue([
      { items: [{ name: 'selected', selector: { kind: 'ClickHouseDatasource', name: 'selected' } }] },
    ]);
    const spec = {
      query:
        "SELECT * FROM events WHERE ServiceName IN (${service:sqlstring}) AND tag = '$__test' AND Timestamp >= '{start}'",
      datasource: '$source',
    };
    expect(dependsOn?.(spec, context).variables).toEqual(['service', '__test', 'source']);
    const signal = new AbortController().signal;
    await execute(spec, context, signal);
    expect(context.datasourceStore.getDatasourceClient).toHaveBeenCalledWith({
      kind: 'ClickHouseDatasource',
      name: 'selected',
    });
    expect(context.query).toHaveBeenCalledWith(
      {
        query:
          "SELECT * FROM events WHERE ServiceName IN ('app''one','worker') AND tag = 'builtin' AND Timestamp >= '2025-01-01 00:00:00'",
      },
      undefined,
      signal,
    );
  },
);

it('resolves a trace ID variable for trace detail queries', async () => {
  const context = createContext();
  const traceId = '0123456789abcdef0123456789abcdef';
  context.variableState.trace = { value: traceId, loading: false };
  const spec = { query: '$trace', mode: 'trace' as const };
  expect(ClickHouseTraceQuery.dependsOn?.(spec, context).variables).toEqual(['trace']);
  const data = await ClickHouseTraceQuery.getTraceData(spec, context);
  expect(data.trace?.resourceSpans).toEqual([]);
  expect(context.query).toHaveBeenCalledWith({
    query: 'SELECT * FROM "otel_traces" WHERE TraceId = \'' + traceId + "' ORDER BY Timestamp",
  });
});

it('retains query and datasource dependencies in generated log volume queries', async () => {
  const context = createContext();
  context.variableState.service = { value: 'api', loading: false };
  context.variableState.source = { value: 'selected', loading: false };
  vi.mocked(context.datasourceStore.listDatasourceSelectItems).mockResolvedValue([
    { items: [{ name: 'selected', selector: { kind: 'ClickHouseDatasource', name: 'selected' } }] },
  ]);
  const volume = ClickHouseLogQuery.createVolumeQuery?.(
    { query: 'SELECT Timestamp FROM otel_logs WHERE ServiceName IN (${service:sqlstring})', datasource: '$source' },
    context,
  );
  expect(volume?.spec.plugin.kind).toBe('ClickHouseTimeSeriesQuery');
  const volumeSpec = volume?.spec.plugin.spec as ClickHouseTimeSeriesQuerySpec | undefined;
  expect(volumeSpec).toBeDefined();
  if (!volumeSpec) throw new Error('Expected a volume query');
  expect(ClickHouseTimeSeriesQuery.dependsOn?.(volumeSpec, context).variables).toEqual(['service', 'source']);
  await ClickHouseTimeSeriesQuery.getTimeSeriesData(volumeSpec, context);
  expect(context.query).toHaveBeenCalledWith({
    query: expect.stringContaining("ServiceName IN ('api')"),
  });
});
