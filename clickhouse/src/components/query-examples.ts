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

export const METRICS_EXAMPLE = `SELECT toStartOfInterval(TimeUnix, INTERVAL {step} SECOND) AS time,
  avg(Value) AS value, MetricName AS metric, ResourceAttributes['service.name'] AS service
FROM otel_metrics_gauge
WHERE TimeUnix BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
GROUP BY time, metric, service ORDER BY time`;

export const LOGS_EXAMPLE = `SELECT Timestamp, Body, SeverityText, ServiceName, TraceId, SpanId,
  ResourceAttributes, LogAttributes
FROM otel_logs
WHERE Timestamp BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY Timestamp DESC LIMIT 1000`;

export const TRACE_SEARCH_EXAMPLE = `SELECT *
FROM otel_traces
WHERE TraceId IN (
  SELECT TraceId FROM otel_traces
  WHERE Timestamp BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
  GROUP BY TraceId ORDER BY max(Timestamp) DESC LIMIT 100
)
ORDER BY Timestamp`;

export const TRACE_DETAIL_EXAMPLE = `-- Select Trace detail mode, or enter a 32-character trace ID directly.
SELECT * FROM otel_traces
WHERE TraceId = \${trace_id:sqlstring}
ORDER BY Timestamp`;

export const ANNOTATION_EXAMPLE = `SELECT Timestamp AS start, Body AS title, ServiceName AS legend,
  LogAttributes AS tags
FROM otel_logs
WHERE Timestamp BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
  AND SeverityText = 'ERROR'
ORDER BY Timestamp LIMIT 1000`;

export const VARIABLE_EXAMPLE = `SELECT DISTINCT ServiceName AS value, ServiceName AS label
FROM otel_logs
WHERE Timestamp BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY value`;

export const OTEL_GAUGE_EXAMPLE = `SELECT * FROM otel_metrics_gauge
WHERE TimeUnix BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY TimeUnix LIMIT 10000`;

export const OTEL_SUM_EXAMPLE = `SELECT * FROM otel_metrics_sum
WHERE TimeUnix BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY TimeUnix LIMIT 10000`;

export const OTEL_HISTOGRAM_EXAMPLE = `SELECT * FROM otel_metrics_histogram
WHERE TimeUnix BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY TimeUnix LIMIT 10000`;

export const OTEL_EXP_HISTOGRAM_EXAMPLE = `SELECT * FROM otel_metrics_exponential_histogram
WHERE TimeUnix BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY TimeUnix LIMIT 10000`;

export const OTEL_SUMMARY_EXAMPLE = `SELECT * FROM otel_metrics_summary
WHERE TimeUnix BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY TimeUnix LIMIT 10000`;

export const METRICS_EXAMPLES = [
  '-- SQL aggregation',
  METRICS_EXAMPLE,
  '-- Native OpenTelemetry gauge and exemplars',
  OTEL_GAUGE_EXAMPLE,
  '-- Native OpenTelemetry sum (counter values; use SQL for rates)',
  OTEL_SUM_EXAMPLE,
  '-- Native histogram buckets',
  OTEL_HISTOGRAM_EXAMPLE,
  '-- Native exponential histogram buckets',
  OTEL_EXP_HISTOGRAM_EXAMPLE,
  '-- Summary quantiles, count and sum',
  OTEL_SUMMARY_EXAMPLE,
].join('\n\n');

export const PROFILE_EXAMPLE = `SELECT Timestamp, SampleType, SampleUnit,
  FunctionNames, FileNames, LineNumbers, MappingFileNames, Addresses,
  Values, TimestampsUnixNano
FROM otel_profiles
WHERE SampleType = 'samples' AND SampleUnit = 'count'
  AND Timestamp <= toDateTime64('{end}', 9, 'UTC')
  AND Timestamp + toIntervalNanosecond(DurationNano) >= toDateTime64('{start}', 9, 'UTC')
ORDER BY Timestamp LIMIT 10000`;

export const PROFILE_EXAMPLES =
  PROFILE_EXAMPLE +
  `

-- The OTel eBPF profiler emits samples/count. Select the SampleType and
-- SampleUnit stored by your profiler, for example cpu/nanoseconds.
-- Filter by a service or a trace using dashboard variables:
-- AND ServiceName IN (\${service:sqlstring})
-- AND TraceId = \${trace_id:sqlstring}

-- Custom schema: stack is an array ordered from root to leaf.
SELECT captured_at AS time, frames AS stack, weight AS value,
  'cpu' AS sampleType, 'nanoseconds' AS unit
FROM custom_profiles
WHERE captured_at BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY time LIMIT 10000`;
