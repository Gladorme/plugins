# ClickHouse variable Go SDK

Import `github.com/perses/plugins/clickhouse/sdk/go/variable` (aliased below as `chvariable`),
`github.com/perses/perses/go-sdk/variable`, and
`github.com/perses/perses/go-sdk/variable/list-variable` (aliased as `listvariable`).

```go
variable.New("service",
	listvariable.List(chvariable.ClickHouseVariable(
		"SELECT DISTINCT ServiceName AS value FROM otel_logs ORDER BY value",
		chvariable.Datasource("clickhouse"),
	)),
)
```

`ClickHouseVariable` returns a `listvariable.Option`.
Optional `ValueColumn("id")` and `LabelColumn("name")` select custom columns.
`Query(sql)` overrides the expression; `Datasource("$source")` selects a datasource variable.
Empty queries and explicitly empty column names are rejected.
See [the result contract](../model.md#clickhousevariable).
