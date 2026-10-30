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

import type { TimeSeriesQueryPlugin } from '@perses-dev/plugin-system';
import type { TimeSeries } from '@perses-dev/spec';

import type { ClickHouseColumn } from '../../model/click-house-client';
import { executeQuery } from '../../model/query';
import { labelsFromRecord, numericValue, timestampMs } from '../../model/rows';
import type { ClickHouseTimeSeriesQuerySpec } from './click-house-query-types';
import { buildOpenTelemetryMetrics, isOpenTelemetryMetric } from './otel-metrics';

const TIME_COLUMNS = new Set(['time', 'Timestamp', 'TimeUnix']);

function buildTimeSeries(rows: Array<Record<string, unknown>>, columns?: ClickHouseColumn[]): TimeSeries[] {
  const names = [...new Set(rows.flatMap(Object.keys))].filter((name) => !TIME_COLUMNS.has(name) && name !== 'labels');
  const metadata = new Map(columns?.map((column) => [column.name, column.type]));
  const metricNames = names.filter((name) => {
    const type = metadata.get(name);
    return type
      ? /^(?:(?:Nullable|LowCardinality)\()*(?:U?Int\d+|Float\d+|Decimal(?:\d+)?\()/.test(type)
      : rows.some((row) => numericValue(row[name]) !== null);
  });
  const labelNames = names.filter((name) => !metricNames.includes(name));
  const series = new Map<string, TimeSeries>();
  for (const row of rows) {
    const timestamp = timestampMs(row.time ?? row.Timestamp ?? row.TimeUnix);
    const labels = {
      ...labelsFromRecord(Object.fromEntries(labelNames.map((name) => [name, row[name]]))),
      ...labelsFromRecord(row.labels),
    };
    const labelEntries = Object.entries(labels).toSorted(([a], [b]) => a.localeCompare(b));
    for (const name of metricNames) {
      const key = JSON.stringify([name, labelEntries]);
      let entry = series.get(key);
      if (!entry) {
        entry = { name, values: [], ...(labelEntries.length ? { labels } : {}) };
        series.set(key, entry);
      }
      entry.values.push([timestamp, numericValue(row[name])]);
    }
  }
  for (const entry of series.values()) entry.values = entry.values.toSorted(([a], [b]) => a - b);
  return [...series.values()];
}

function inferStepMs(series: TimeSeries[], fallback: number): number {
  const counts = new Map<number, number>();
  // Infer intervals within each series so staggered label values do not shrink the step.
  for (const entry of series) {
    for (let i = 1; i < entry.values.length; i++) {
      const previous = entry.values[i - 1];
      const current = entry.values[i];
      if (previous && current && current[0] > previous[0]) {
        const delta = current[0] - previous[0];
        counts.set(delta, (counts.get(delta) ?? 0) + 1);
      }
    }
  }
  return [...counts].toSorted(([a, countA], [b, countB]) => countB - countA || b - a)[0]?.[0] ?? fallback;
}

export const getTimeSeriesData: TimeSeriesQueryPlugin<ClickHouseTimeSeriesQuerySpec>['getTimeSeriesData'] = async (
  spec,
  context,
  signal,
) => {
  if (!spec.query?.trim()) return { series: [] };
  const { response, rows, executedQueryString } = await executeQuery(spec, context, signal);
  const result =
    rows[0] && isOpenTelemetryMetric(rows[0])
      ? buildOpenTelemetryMetrics(rows, context.mode === 'instant')
      : { series: buildTimeSeries(rows, response.meta) };
  return {
    ...result,
    timeRange: context.absoluteTimeRange,
    stepMs: inferStepMs(result.series, context.suggestedStepMs ?? 30_000),
    metadata: { executedQueryString },
  };
};
