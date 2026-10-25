# ClickHouse profile query Go SDK

Import `github.com/perses/plugins/clickhouse/sdk/go/query/profile`.

```go
profile.ClickHouseProfileQuery(
	"SELECT * FROM otel_profiles WHERE SampleType = 'cpu' AND SampleUnit = 'nanoseconds' AND TraceId = ${trace_id:sqlstring}",
	profile.Datasource("$source"),
)
```

Use the returned `query.Option` when building a `ProfileQuery` for a Flame Chart panel.
`Query(sql)` overrides the expression. Empty queries and invalid datasource selectors are rejected.
See [the result contract](../model.md#clickhouseprofilequery) for Collector and custom SQL shapes,
time filtering, and profile variables.
