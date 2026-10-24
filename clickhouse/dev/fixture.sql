-- Copyright The Perses Authors
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
-- http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.

CREATE TABLE otel_metrics_gauge (
    TimeUnix DateTime64(9, 'UTC'), Value Float64, MetricName String,
    ResourceAttributes Map(String, String), Attributes Map(String, String), Flags UInt32,
    Exemplars Nested(FilteredAttributes Map(String, String), TimeUnix DateTime64(9, 'UTC'), Value Float64, SpanId String, TraceId String)
) ENGINE = Memory;

CREATE TABLE otel_logs (
    Timestamp DateTime64(9, 'UTC'), Body String, SeverityText String,
    ServiceName String, TraceId String, SpanId String,
    ResourceAttributes Map(String, String), LogAttributes Map(String, String)
) ENGINE = Memory;

CREATE TABLE otel_traces (
    Timestamp DateTime64(9, 'UTC'), TraceId String, SpanId String, ParentSpanId String, TraceState String,
    SpanName String, SpanKind String, ServiceName String, ResourceAttributes Map(String, String),
    ScopeName String, ScopeVersion String, SpanAttributes Map(String, String), Duration UInt64,
    StatusCode String, StatusMessage String,
    Events Nested(Timestamp DateTime64(9, 'UTC'), Name String, Attributes Map(String, String)),
    Links Nested(TraceId String, SpanId String, TraceState String, Attributes Map(String, String))
) ENGINE = Memory;

INSERT INTO otel_metrics_gauge VALUES
('2025-01-01 00:00:00', 10, 'cpu', {'service.name':'api'}, {}, 0,
 [{'env':'prod'}], ['2025-01-01 00:00:00.123456789'], [10], ['0000000000000001'], ['0123456789abcdef0123456789abcdef']),
('2025-01-01 00:01:00', 20, 'cpu', {'service.name':'api'}, {}, 0, [], [], [], [], []),
('2025-01-01 00:00:00', 30, 'cpu', {'service.name':'worker'}, {}, 0, [], [], [], [], []);

INSERT INTO otel_logs VALUES
('2025-01-01 00:00:00.123456789', 'request failed', 'ERROR', 'api',
 '0123456789abcdef0123456789abcdef', '0000000000000001',
 {'deployment.environment':'prod'}, {'http.status_code':'503'}),
('2025-01-01 00:01:00', 'ready', 'INFO', 'worker', '', '', {}, {});

INSERT INTO otel_traces VALUES
('2025-01-01 00:00:00.123456789', '0123456789abcdef0123456789abcdef', '0000000000000001', '', 'vendor=state',
 'GET /', 'Server', 'api', {'service.name':'api'}, 'http', '1', {}, 1000000000, 'Ok', '',
 [], [], [], [], [], [], []),
('2025-01-01 00:00:00.223456789', '0123456789abcdef0123456789abcdef', '0000000000000002', '0000000000000001', 'vendor=state',
 'SELECT', 'Client', 'db', {'service.name':'db'}, 'sql', '1', {'db.system':'clickhouse'}, 250000000, 'Error', 'timeout',
 ['2025-01-01 00:00:00.223456799'], ['exception'], [{'exception.message':'timeout'}],
 ['0123456789abcdef0123456789abcdef'], ['0000000000000001'], ['vendor=linked'], [{}]);

CREATE TABLE otel_metrics_sum AS otel_metrics_gauge ENGINE = Memory;
ALTER TABLE otel_metrics_sum ADD COLUMN IsMonotonic Bool DEFAULT true;
ALTER TABLE otel_metrics_sum ADD COLUMN AggregationTemporality Int32 DEFAULT 2;
INSERT INTO otel_metrics_sum (TimeUnix, Value, MetricName, ResourceAttributes, Attributes)
VALUES ('2025-01-01 00:00:00', 12, 'requests', {'service.name':'api'}, {}),
       ('2025-01-01 00:01:00', 15, 'requests', {'service.name':'api'}, {});

CREATE TABLE otel_metrics_histogram (
    TimeUnix DateTime('UTC'), MetricName String, ServiceName String,
    Attributes Map(String, String), ResourceAttributes Map(String, String),
    Count UInt64, Sum Float64, BucketCounts Array(UInt64), ExplicitBounds Array(Float64),
    Min Float64, Max Float64, Flags UInt32,
    Exemplars Nested(FilteredAttributes Map(String, String), TimeUnix DateTime('UTC'), Value Float64, SpanId String, TraceId String)
) ENGINE = Memory;
INSERT INTO otel_metrics_histogram VALUES
('2025-01-01 00:00:00', 'duration', 'api', {'method':'GET'}, {}, 8, 14, [1, 2, 4, 1], [1, 2, 4], 0.5, 5, 0,
 [{}], ['2025-01-01 00:00:00'], [0.5], ['0000000000000001'], ['0123456789abcdef0123456789abcdef']),
('2025-01-01 00:01:00', 'duration', 'api', {'method':'GET'}, {}, 10, 20, [2, 2, 5, 1], [1, 2, 4], 0.5, 5, 0,
 [], [], [], [], []);

CREATE TABLE otel_metrics_exponential_histogram (
    TimeUnix DateTime('UTC'), MetricName String, Count UInt64, Sum Float64,
    Scale Int32, ZeroCount UInt64, PositiveOffset Int32, PositiveBucketCounts Array(UInt64),
    NegativeOffset Int32, NegativeBucketCounts Array(UInt64), Flags UInt32
) ENGINE = Memory;
INSERT INTO otel_metrics_exponential_histogram VALUES
('2025-01-01 00:00:00', 'temperature', 9, 8, 0, 3, -1, [1, 2], -1, [2, 1], 0);

CREATE TABLE otel_metrics_summary (
    TimeUnix DateTime('UTC'), MetricName String, Count UInt64, Sum Float64, Flags UInt32,
    ValueAtQuantiles Nested(Quantile Float64, Value Float64)
) ENGINE = Memory;
INSERT INTO otel_metrics_summary VALUES
('2025-01-01 00:00:00', 'latency', 4, 10, 0, [0.5, 0.99], [2, 7]);

-- Collector profile sample columns, without production indexes/storage settings.
CREATE TABLE otel_profiles (
    Timestamp DateTime64(9, 'UTC'), ProfileId String,
    SampleType LowCardinality(String), SampleUnit LowCardinality(String), ServiceName LowCardinality(String),
    ResourceAttributes Map(String, String), ScopeName String, ScopeVersion String,
    ProfileAttributes Map(String, String), SampleAttributes Map(String, String), StackHash UInt64,
    Addresses Array(UInt64), FunctionNames Array(LowCardinality(String)),
    FileNames Array(LowCardinality(String)), LineNumbers Array(Int32), MappingFileNames Array(LowCardinality(String)),
    Values Array(Int64), TimestampsUnixNano Array(UInt64), DurationNano UInt64,
    Period Int64, PeriodType LowCardinality(String), PeriodUnit LowCardinality(String), TraceId String, SpanId String
) ENGINE = Memory;

INSERT INTO otel_profiles
(Timestamp, ProfileId, SampleType, SampleUnit, ServiceName, FunctionNames, FileNames, LineNumbers,
 MappingFileNames, Addresses, Values, TimestampsUnixNano, DurationNano, Period, PeriodType, PeriodUnit, TraceId, SpanId)
VALUES
('2024-12-31 23:59:59', 'api-cpu', 'cpu', 'nanoseconds', 'api',
 ['api.parse', 'api.handle', 'main'], ['api.go', 'api.go', 'main.go'], [42, 20, 10], ['app', 'app', 'app'], [300, 200, 100],
 [10000000, 20000000], [1735689600123456789, 1735689660000000000], 121000000000, 10000000, 'cpu', 'nanoseconds',
 '0123456789abcdef0123456789abcdef', '0000000000000001'),
('2025-01-01 00:01:00', 'api-cpu', 'cpu', 'nanoseconds', 'api',
 ['api.handle', 'main'], ['api.go', 'main.go'], [20, 10], ['app', 'app'], [200, 100],
 [5000000], [], 0, 10000000, 'cpu', 'nanoseconds', '0123456789abcdef0123456789abcdef', '0000000000000001'),
('2025-01-01 00:00:30', 'worker-cpu', 'cpu', 'nanoseconds', 'worker',
 ['worker.process', 'main'], ['worker.go', 'main.go'], [12, 10], ['app', 'app'], [400, 100],
 [7000000], [1735689630000000000], 0, 10000000, 'cpu', 'nanoseconds', '', ''),
('2025-01-01 00:01:00', 'api-heap', 'alloc_space', 'bytes', 'api',
 ['runtime.malloc', 'api.handle', 'main'], [], [], [], [],
 [4096], [], 0, 1, 'space', 'bytes', '', ''),
('2025-01-01 00:00:00', 'api-count', 'samples', 'count', 'api',
 ['api.handle', 'main'], [], [], [], [],
 [], [1735689600123456789, 1735689660000000000], 61000000000, 100, 'cpu', 'nanoseconds', '', '');
