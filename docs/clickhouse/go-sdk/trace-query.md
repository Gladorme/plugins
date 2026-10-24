# ClickHouse trace query Go SDK

Import `github.com/perses/plugins/clickhouse/sdk/go/query/trace`.

```go
trace.ClickHouseTraceQuery(
	"SELECT * FROM otel_traces WHERE TraceId = ${trace_id:sqlstring}",
	trace.Mode("trace"),
	trace.Datasource("$source"),
)
```

Use the returned `query.Option` when building a query. `Mode("search")` is the default.
`Table("observability.otel_traces")` sets the table for queries containing only a trace ID.
`Query(sql)` overrides the expression. Empty queries and invalid modes are rejected.
See [the result contract](../model.md#clickhousetracequery).
