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

import type {
  BucketTuple,
  Exemplar,
  HistogramValue,
  TimeSeries,
  TimeSeriesData,
  TimeSeriesExemplars,
} from '@perses-dev/spec';

import { isRecord } from '../../model/click-house-client';
import { labelsFromRecord, numericValue, stringValue, timestampMs } from '../../model/rows';

type Row = Record<string, unknown>;

function field(row: Row, group: string, key: string): unknown {
  const nested = row[group];
  return row[group + '.' + key] ?? (isRecord(nested) ? nested[key] : undefined);
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error('ClickHouse OpenTelemetry metrics require an array for ' + name);
  return value;
}

function number(value: unknown, name: string): number {
  const result = numericValue(value);
  if (result === null) throw new Error('ClickHouse OpenTelemetry metrics require a finite number for ' + name);
  return result;
}

function integer(value: unknown, name: string): number {
  const result = number(value, name);
  if (!Number.isSafeInteger(result)) throw new Error('Invalid OpenTelemetry integer: ' + name);
  return result;
}

function count(value: unknown, name: string): bigint {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) {
    throw new Error('ClickHouse OpenTelemetry metrics require a nonnegative integer for ' + name);
  }
  return BigInt(value);
}

function counts(value: unknown, name: string): bigint[] {
  return array(value, name).map((item) => count(item, name));
}

function explicitBuckets(row: Row): BucketTuple[] {
  const bounds = array(row.ExplicitBounds, 'ExplicitBounds').map((value) => number(value, 'ExplicitBounds'));
  const values = counts(row.BucketCounts, 'BucketCounts');
  if (bounds.some((value, index) => value <= (bounds[index - 1] ?? -Infinity))) {
    throw new Error('OpenTelemetry ExplicitBounds must be strictly increasing');
  }
  if (values.length === 0 && bounds.length === 0) return [];
  if (values.length !== bounds.length + 1) {
    throw new Error('OpenTelemetry BucketCounts must have one more entry than ExplicitBounds');
  }
  return values.flatMap((value, index): BucketTuple[] =>
    value === 0n ? [] : [[0, String(bounds[index - 1] ?? -Infinity), String(bounds[index] ?? Infinity), String(value)]],
  );
}

function exponentialBuckets(row: Row): BucketTuple[] {
  const scale = integer(row.Scale, 'Scale');
  const threshold = number(row.ZeroThreshold ?? 0, 'ZeroThreshold');
  if (threshold < 0) throw new Error('OpenTelemetry ZeroThreshold must be nonnegative');
  const buckets: BucketTuple[] = [];
  for (const side of ['Negative', 'Positive']) {
    const values = counts(row[side + 'BucketCounts'], side + 'BucketCounts');
    const offset = integer(row[side + 'Offset'], side + 'Offset');
    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      if (value === undefined || value === 0n) continue;
      const lower = Math.max(threshold, 2 ** ((offset + index) * 2 ** -scale));
      const upper = 2 ** ((offset + index + 1) * 2 ** -scale);
      if (!(upper > lower)) throw new Error('OpenTelemetry exponential bucket cannot be represented at this scale');
      buckets.push(
        side === 'Negative'
          ? [1, String(-upper), String(-lower), String(value)]
          : [0, String(lower), String(upper), String(value)],
      );
    }
  }
  const zero = count(row.ZeroCount, 'ZeroCount');
  if (zero > 0n) buckets.push([3, String(-threshold), String(threshold), String(zero)]);
  return buckets.toSorted((a, b) => Number(a[1]) - Number(b[1]));
}

function histogram(row: Row): HistogramValue {
  const buckets = Object.hasOwn(row, 'ExplicitBounds') ? explicitBuckets(row) : exponentialBuckets(row);
  const total = count(row.Count, 'Count');
  if (buckets.reduce((sum, bucket) => sum + BigInt(bucket[3]), 0n) !== total) {
    throw new Error('OpenTelemetry histogram bucket counts do not match Count');
  }
  return { count: Number(total), sum: String(numericValue(row.Sum) ?? 'NaN'), buckets };
}

function metricLabels(row: Row): Record<string, string> {
  const labels = {
    ...labelsFromRecord(row.ResourceAttributes, 'ResourceAttributes.'),
    ...labelsFromRecord(row.ScopeAttributes, 'ScopeAttributes.'),
    ...labelsFromRecord(row.Attributes, 'Attributes.'),
  };
  for (const name of [
    'ServiceName',
    'ScopeName',
    'ScopeVersion',
    'MetricUnit',
    'AggregationTemporality',
    'IsMonotonic',
  ]) {
    if (row[name] !== undefined) labels[name] = stringValue(row[name]);
  }
  return labels;
}

function exemplars(row: Row): Exemplar[] {
  const rawValues = field(row, 'Exemplars', 'Value');
  if (rawValues === undefined) return [];
  const values = array(rawValues, 'Exemplars.Value');
  const times = array(field(row, 'Exemplars', 'TimeUnix'), 'Exemplars.TimeUnix');
  const traces = array(field(row, 'Exemplars', 'TraceId') ?? [], 'Exemplars.TraceId');
  const spans = array(field(row, 'Exemplars', 'SpanId') ?? [], 'Exemplars.SpanId');
  const attributes = array(field(row, 'Exemplars', 'FilteredAttributes') ?? [], 'Exemplars.FilteredAttributes');
  if (
    times.length !== values.length ||
    [traces, spans, attributes].some((items) => items.length && items.length !== values.length)
  ) {
    throw new Error('OpenTelemetry exemplar arrays must have matching lengths');
  }
  return values.flatMap((raw, index) => {
    const value = numericValue(raw);
    if (value === null) return [];
    const labels = labelsFromRecord(attributes[index]);
    if (traces[index]) labels.trace_id = stringValue(traces[index]);
    if (spans[index]) labels.span_id = stringValue(spans[index]);
    return [{ value, timestamp: timestampMs(times[index]), labels }];
  });
}

/** Reserved Collector columns opt in to native conversion; aliased numeric SQL results keep the generic contract. */
export function isOpenTelemetryMetric(row: Row): boolean {
  return (
    typeof row.MetricName === 'string' &&
    Object.hasOwn(row, 'TimeUnix') &&
    (Object.hasOwn(row, 'Value') ||
      Object.hasOwn(row, 'BucketCounts') ||
      Object.hasOwn(row, 'PositiveBucketCounts') ||
      field(row, 'ValueAtQuantiles', 'Quantile') !== undefined)
  );
}

export function buildOpenTelemetryMetrics(rows: Row[], instant = false): Pick<TimeSeriesData, 'series' | 'exemplars'> {
  const series = new Map<string, TimeSeries>();
  const exemplarGroups = new Map<string, TimeSeriesExemplars>();
  function getSeries(name: string, labels: Record<string, string>): { key: string; entry: TimeSeries } {
    const identity = { ...labels, __name__: name };
    const key = JSON.stringify(Object.entries(identity).toSorted(([a], [b]) => a.localeCompare(b)));
    let entry = series.get(key);
    if (!entry) {
      entry = { name, labels: identity, values: [] };
      series.set(key, entry);
    }
    return { key, entry };
  }
  for (const row of rows) {
    if (!isOpenTelemetryMetric(row))
      throw new Error('All OpenTelemetry metric rows must include MetricName, TimeUnix and their value fields');
    const name = stringValue(row.MetricName);
    const labels = metricLabels(row);
    const time = timestampMs(row.TimeUnix);
    const missing = (integer(row.Flags ?? 0, 'Flags') & 1) !== 0;
    const quantiles = field(row, 'ValueAtQuantiles', 'Quantile');
    if (quantiles !== undefined) {
      const qs = array(quantiles, 'ValueAtQuantiles.Quantile');
      const values = array(field(row, 'ValueAtQuantiles', 'Value'), 'ValueAtQuantiles.Value');
      if (qs.length !== values.length)
        throw new Error('OpenTelemetry summary quantile arrays must have matching lengths');
      getSeries(name + '_count', labels).entry.values.push([time, missing ? null : Number(count(row.Count, 'Count'))]);
      getSeries(name + '_sum', labels).entry.values.push([time, missing ? null : numericValue(row.Sum)]);
      for (let i = 0; i < qs.length; i++) {
        const q = number(qs[i], 'ValueAtQuantiles.Quantile');
        if (q < 0 || q > 1) throw new Error('OpenTelemetry summary quantiles must be between 0 and 1');
        getSeries(name, { ...labels, quantile: String(q) }).entry.values.push([
          time,
          missing ? null : numericValue(values[i]),
        ]);
      }
      continue;
    }
    const { key, entry } = getSeries(name, labels);
    const hasHistogram = Object.hasOwn(row, 'BucketCounts') || Object.hasOwn(row, 'PositiveBucketCounts');
    const h = !missing && hasHistogram ? histogram(row) : undefined;
    const sample = h ? numericValue(h.sum) : numericValue(row.Value);
    entry.values.push([time, missing ? null : sample]);
    if (h) {
      // Perses histogram panels consume seconds, like the Prometheus histogram API. Scalar samples use milliseconds.
      (entry.histograms ??= []).push([time / 1000, h]);
    }
    const points = missing ? [] : exemplars(row);
    if (points.length) {
      let group = exemplarGroups.get(key);
      if (!group) {
        group = { seriesLabels: entry.labels ?? {}, exemplars: [] };
        exemplarGroups.set(key, group);
      }
      group.exemplars.push(...points);
    }
  }
  for (const entry of series.values()) {
    entry.values.sort(([a], [b]) => a - b);
    entry.histograms?.sort(([a], [b]) => a - b);
    if (instant) {
      entry.values = entry.values.slice(-1);
      const latest = entry.values[0];
      if (entry.histograms) {
        entry.histograms =
          latest && entry.histograms.at(-1)?.[0] === latest[0] / 1000 ? entry.histograms.slice(-1) : [];
      }
    }
  }
  for (const group of exemplarGroups.values()) {
    group.exemplars.sort((a, b) => a.timestamp - b.timestamp);
  }
  return {
    series: [...series.values()],
    ...(!instant && exemplarGroups.size ? { exemplars: [...exemplarGroups.values()] } : {}),
  };
}
