# ClickHouse plugin models

## ClickHouseDatasource

Configure the ClickHouse HTTP endpoint (usually port 8123, or the HTTPS endpoint for ClickHouse Cloud).

```yaml
kind: Datasource
metadata:
  name: clickhouse
  project: observability
spec:
  default: true
  plugin:
    kind: ClickHouseDatasource
    spec:
      directUrl: http://localhost:8123/?database=default
```

Use a proxy to keep database credentials on the Perses server:

```yaml
kind: ClickHouseDatasource
spec:
  proxy:
    kind: HTTPProxy
    spec:
      url: http://clickhouse:8123/?database=observability
      allowedEndpoints:
        - endpointPattern: "/"
          method: GET
      secret: clickhouse-secret
```

The client uses GET queries and requests JSON results. It preserves URL settings such as `database`,
including a database configured on the proxy's upstream URL. It requests quoted 64-bit integers
to preserve timestamps and addresses before JSON parsing; do not disable this setting in SQL.
See the [HTTP proxy specification](https://perses.dev/perses/docs/plugins/common/#http-proxy-specification) for authentication and secrets.
HTTP errors are shown as query failures. Requests support cancellation.

## Shared SQL conventions

All six query plugins accept:

```yaml
query: <SQL string>
datasource: # optional; otherwise the default ClickHouse datasource
  kind: ClickHouseDatasource
  name: clickhouse
```

A datasource variable can be used instead: `datasource: "$source"`.
It must resolve to one ClickHouse datasource.

| Placeholder            | Meaning                                                                      |
|------------------------|------------------------------------------------------------------------------|
| `{start}`              | Selected range start as a UTC date/time, including milliseconds when present |
| `{end}`                | Selected range end as a UTC date/time                                        |
| `{step}`               | Suggested interval in whole seconds, rounded up; defaults to 30              |
| `${service:sqlstring}` | SQL-quoted scalar or comma-separated multi-select values                     |

Use `toDateTime64('{start}', 9, 'UTC')` and `toDateTime64('{end}', 9, 'UTC')` for time predicates.
A query using these placeholders needs a selected time range.
Use `ServiceName IN (${service:sqlstring})` without surrounding quotes.
The `sqlstring` format escapes both quotes and backslashes for ClickHouse.
Other Perses interpolation formats remain available; raw interpolation inserts SQL literally.
Variables used in queries or datasource selectors are tracked as dependencies, including chained variables.

Omit `FORMAT`, or use `FORMAT JSON`. Row-oriented or compact JSON formats are not supported.
DateTime and DateTime64 values retain their timezone and fractional seconds.
Timezone-free result strings are interpreted as UTC. Numeric timestamp aliases must be Unix milliseconds.

## ClickHouseTimeSeriesQuery

Return `time` (or `Timestamp`/`TimeUnix`) plus numeric value columns.
Each numeric column becomes a metric; string columns and an optional `labels` map distinguish series.
ClickHouse column metadata distinguishes string labels such as status code `"200"` from numbers.
Null numeric samples stay gaps. Points are sorted by time, and the step is inferred within each series.

```sql
SELECT toStartOfInterval(TimeUnix, INTERVAL {step} SECOND) AS time,
       avg(Value) AS value,
       MetricName AS metric,
       ResourceAttributes['service.name'] AS service
FROM otel_metrics_gauge
WHERE TimeUnix BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
GROUP BY time, metric, service
ORDER BY time
```

For custom schemas, alias the timestamp and select the metric columns:

```yaml
kind: ClickHouseTimeSeriesQuery
spec:
  query: |
    SELECT recorded_at AS time, cpu_usage AS cpu, host
    FROM host_metrics
    WHERE recorded_at BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
    ORDER BY time
```

### Native OpenTelemetry metrics

Results retaining `MetricName`, `TimeUnix`, and the Collector's value columns are converted automatically:

| Collector table                           | Value columns                                                                                                          | Perses result                                                      |
|-------------------------------------------|------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| `otel_metrics_gauge` / `otel_metrics_sum` | `Value`                                                                                                                | Named time series                                                  |
| `otel_metrics_histogram`                  | `Count`, `Sum`, `BucketCounts`, `ExplicitBounds`                                                                       | Native histogram buckets                                           |
| `otel_metrics_exponential_histogram`      | `Count`, `Sum`, `Scale`, `ZeroCount`, `PositiveOffset`/`NegativeOffset`, `PositiveBucketCounts`/`NegativeBucketCounts` | Native histogram buckets, including negative and zero observations |
| `otel_metrics_summary`                    | `Count`, `Sum`, `ValueAtQuantiles.Quantile`/`ValueAtQuantiles.Value`                                                   | Count, sum, and quantile time series                               |

For example, this works in a Histogram Chart or Heatmap Chart without expanding buckets in SQL:

```sql
SELECT * FROM otel_metrics_histogram
WHERE TimeUnix BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY TimeUnix LIMIT 10000
```

The SQL editor includes examples for all five tables. Custom schemas can alias their columns to these names.
Queries using the generic `time` plus numeric-column contract keep their existing behavior.

Native series use `MetricName` as their name. Resource, scope, and datapoint attributes remain separate
labels under `ResourceAttributes.*`, `ScopeAttributes.*`, and `Attributes.*`.
`ServiceName`, scope name/version, unit, temporality, and monotonicity are retained when selected.
Start timestamps and flags do not become extra metrics or split a series at counter resets.
The `Flags` no-recorded-value bit produces gaps.

Native histograms retain noncumulative bucket counts, inclusive/exclusive boundaries, and unbounded tails.
Histogram and Heatmap panels display the tails at their plot edges; tooltips retain the original bounds.
Zero-width zero buckets remain visible. The time-series representation of a histogram uses its sum.
Instant panels receive the latest returned sample of each series.
An optional `ZeroThreshold` alias preserves an exponential histogram's zero-bucket threshold;
the standard Collector table does not store that field, so it defaults to zero.

Selecting `Exemplars.*` (or `SELECT *`) preserves exemplar values, timestamps, filtered attributes,
and `trace_id`/`span_id` labels. Time Series Chart displays these as markers associated with the
matching series. Exemplars are omitted for instant queries. Configure panel links to navigate to trace detail.

SQL still determines filtering, aggregation, ordering, and limits. Choose counter-to-rate calculations and
temporal aggregation appropriate to the source's delta or cumulative temporality; the plugin does not silently
change those semantics. To aggregate into scalar series, use the generic aliases above, such as
`Sum / nullIf(Count, 0) AS average` and `TimeUnix AS time`.

See the [Collector's metric table definitions](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/clickhouseexporter/internal/sqltemplates)
for the stored columns.

## ClickHouseLogQuery

Standard OpenTelemetry results use `Timestamp` and `Body`.
The timestamp is converted to Unix seconds for Perses log panels.
`SeverityText`, `TraceId`, `SpanId`, and other fields remain available as labels.
Maps are flattened into dotted string labels, such as `LogAttributes.http.status_code`.

```yaml
kind: ClickHouseLogQuery
spec:
  query: |
    SELECT Timestamp, Body, SeverityText, ServiceName, TraceId, SpanId,
           ResourceAttributes, LogAttributes
    FROM otel_logs
    WHERE Timestamp BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
    ORDER BY Timestamp DESC LIMIT 1000
```

Custom schemas may return `timestamp`, `log_time`, or `time` and `body`, `message`, or `line`.
Without a body field, the plugin retains the legacy formatted field listing.
An optional `timeColumn` selects another timestamp field:

```yaml
kind: ClickHouseLogQuery
spec:
  query: SELECT created_at, message FROM application_logs ORDER BY created_at DESC LIMIT 1000
  timeColumn: created_at
```

Log volume queries count the rows returned by the SQL, including its filters and LIMIT.
For volume charts, the selected column must be a DateTime/DateTime64; set `timeColumn` when it is not `Timestamp`.
The SQL editor controls ordering, filtering, and result limits; the plugin does not implement server-side pagination.

## ClickHouseTraceQuery

`mode` is `search` (default) or `trace`.
Both modes consume span rows using the OpenTelemetry column names.

Required columns are `TraceId` (32 hex digits), `SpanId` (16 hex digits),
`Timestamp` (span start), and `Duration` (integer nanoseconds).
Return `ParentSpanId`, `ServiceName`, and `SpanName` for names and hierarchy.
Optional fields include `TraceState`, `SpanKind`, `StatusCode`, `StatusMessage`,
`ResourceAttributes`, `SpanAttributes`, `ScopeName`, `ScopeVersion`,
and the exporter's `Events.*` and `Links.*` arrays.

Trace search groups the returned spans by trace ID. It calculates overall duration, root names, and
per-service span/error counts. Return all spans for each selected trace for complete counts.
The default example first selects up to 100 trace IDs in the time range, then retrieves their spans:

```sql
SELECT *
FROM otel_traces
WHERE TraceId IN (
  SELECT TraceId FROM otel_traces
  WHERE Timestamp BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
  GROUP BY TraceId ORDER BY max(Timestamp) DESC LIMIT 100
)
ORDER BY Timestamp
```

Trace detail preserves nanosecond timestamps, resources, instrumentation scopes, attributes, events,
links, trace state, status, and parent IDs in Perses's OTLP data model. A detail query must return only one trace:

```yaml
kind: ClickHouseTraceQuery
spec:
  mode: trace
  query: |
    SELECT * FROM otel_traces
    WHERE TraceId = ${trace_id:sqlstring}
    ORDER BY Timestamp
```

Entering a trace ID directly automatically selects trace detail and retrieves the entire trace,
without clipping spans to the dashboard's time range.
`table` optionally sets the table for this shorthand (default `otel_traces`):

```yaml
kind: ClickHouseTraceQuery
spec:
  query: "0123456789abcdef0123456789abcdef"
  table: observability.otel_traces
```

Use a Trace Table panel for search and a Tracing Gantt Chart for detail.
Dashboard variables can carry trace IDs between logs, search, and detail panels.
Configure panel links explicitly to match your dashboard; the datasource does not create navigation links automatically.
For custom schemas, alias columns to the names above in SQL. `table` alone does not remap columns.

## ClickHouseProfileQuery

Use a Flame Chart panel to view weighted call stacks, a function table, and a sample timeline.
The default query targets the Collector's `otel_profiles` table:

```sql
SELECT Timestamp, SampleType, SampleUnit,
       FunctionNames, FileNames, LineNumbers, MappingFileNames, Addresses,
       Values, TimestampsUnixNano
FROM otel_profiles
WHERE SampleType = 'cpu' AND SampleUnit = 'nanoseconds'
  AND Timestamp <= toDateTime64('{end}', 9, 'UTC')
  AND Timestamp + toIntervalNanosecond(DurationNano) >= toDateTime64('{start}', 9, 'UTC')
ORDER BY Timestamp LIMIT 10000
```

The [Collector's profiles exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/clickhouseexporter#profiles)
is in **development**; its schema can change. Use a Collector version that includes the profiles exporter,
enable `--feature-gates=+service.profilesSupport`, and configure a profiles pipeline.
The exporter's default table creation requires ClickHouse 26.2 or newer. For older servers, create a compatible
custom table and disable automatic schema creation with `create_schema: false`.
The plugin reads resolved sample rows; it does not ingest raw OTLP profile dictionaries or pprof files.

Each Collector row represents one sample stack. Required columns are `FunctionNames`, `Values`,
and `SampleType`/`SampleUnit`. Select `TimestampsUnixNano` for timestamped observations,
and `Timestamp` for values without individual timestamps. Optional parallel frame arrays are
`FileNames`, `LineNumbers`, `MappingFileNames`, and `Addresses`.
All nonempty frame arrays must have the same length. Collector stacks, including inline frames,
are leaf first; the plugin reverses them into caller-to-callee order.
Unsymbolized frames retain their binary name and address when available.

`Values` contains measured weights, already in `SampleUnit`; the plugin does not multiply them by `Period`.
When values and individual timestamps are both present, their lengths must match.
Timestamp-only samples contribute one count per observation. Values without individual timestamps
are assigned to the profile's `Timestamp`; they are not prorated across `DurationNano`.
Individual observations are clipped to the selected time range at nanosecond precision.
The overlap predicate above includes profiles collected before the range whose observations extend into it.

Shared stack prefixes are merged. The function table shows total and self weights, preserving recursion.
The timeline sums weights into bounded time buckets; it does not turn CPU time into a rate or percentage.
Weights must be finite, nonnegative, and within JavaScript's safe numeric range; oversized totals fail explicitly.
Filter to **one sample type and unit** per query, such as CPU nanoseconds, allocation bytes, or sample counts.
Mixed types or units are rejected rather than added together.

Add service or trace filters before `ORDER BY`:

```sql
AND ServiceName IN (${service:sqlstring})
AND TraceId = ${trace_id:sqlstring}
```

Profile query variables, including `datasource: "$source"`, require the Perses shared runtime's
profile variable support (`ProfileQueryContext.variableState` and `ProfileQueryPlugin.dependsOn`).
Static SQL and time placeholders work on older hosts; variable queries show an explicit compatibility error there.
Configure dashboard links to pass trace IDs between signals. Profile results do not create automatic trace links.

### Custom profile schemas

Alias one row per weighted stack with the following columns:

| Alias        | Type                     | Meaning                                                                         |
|--------------|--------------------------|---------------------------------------------------------------------------------|
| `stack`      | `Array(String)`          | Frames ordered from root to leaf; reverse leaf-first arrays in SQL              |
| `value`      | Number or numeric string | Weight of this stack, including any sampling-period conversion performed in SQL |
| `time`       | Optional timestamp       | DateTime/DateTime64 or Unix milliseconds                                        |
| `sampleType` | Optional string          | Profile type; defaults to `samples`                                             |
| `unit`       | Optional string          | Weight unit; defaults to `count`; use `nanoseconds` or `bytes` when appropriate |

```sql
SELECT captured_at AS time, frames AS stack, weight AS value,
       'cpu' AS sampleType, 'nanoseconds' AS unit
FROM custom_profiles
WHERE captured_at BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
ORDER BY time LIMIT 10000
```

Alternatively, alias custom columns to the Collector names above.
The units `ns`, `By`, and `1` normalize to `nanoseconds`, `bytes`, and `count`.
When custom rows omit `time`, SQL owns time filtering and no timeline is produced.
SQL also owns aggregation and row limits; a limit can return a partial profile.

## ClickHouseAnnotationQuery

Return `start` (or `Timestamp`), optionally `end`, `title`, `legend`, and a `tags` map.
Start and end become Unix milliseconds. Omit end for point events; ranges must end at or after their start.

```yaml
kind: ClickHouseAnnotationQuery
spec:
  query: |
    SELECT Timestamp AS start, Body AS title, ServiceName AS legend, LogAttributes AS tags
    FROM otel_logs
    WHERE Timestamp BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
      AND SeverityText = 'ERROR'
    ORDER BY Timestamp LIMIT 1000
```

Use this plugin in dashboard or panel annotation definitions. For a deployment table,
`SELECT deployed_at AS start, finished_at AS end, version AS title FROM deployments ...`
produces range annotations.

## ClickHouseVariable

Return `value` and optionally `label`. If no `value` column exists, the first selected column is used.
`valueColumn` and `labelColumn` override those names. Null values are omitted; duplicate values keep the first label.
Strings, numbers, and booleans are supported. SQL ordering determines dropdown ordering.

```yaml
kind: ClickHouseVariable
spec:
  query: |
    SELECT DISTINCT ServiceName AS value, ServiceName AS label
    FROM otel_logs
    WHERE Timestamp BETWEEN toDateTime64('{start}', 9, 'UTC') AND toDateTime64('{end}', 9, 'UTC')
    ORDER BY value
```

A chained variable can add `AND ResourceAttributes['deployment.environment'] IN (${environment:sqlstring})`.
Use `${service:sqlstring}` in metrics, logs, traces, profiles, or annotation queries to consume its values.

## ClickHouse datasource selector

Use `{kind: ClickHouseDatasource, name: clickhouse}` for a named datasource,
`{kind: ClickHouseDatasource}` for the default, or `"$source"` for a datasource variable.
Omitting the selector also uses the default.
