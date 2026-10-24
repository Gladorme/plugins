# ClickHouse annotation Go SDK

Import `github.com/perses/plugins/clickhouse/sdk/go/annotation` (aliased below as `channotation`)
and `github.com/perses/perses/go-sdk/annotation`.

```go
annotation.New("Deployments",
	channotation.ClickHouseAnnotationQuery(
		"SELECT deployed_at AS start, version AS title FROM deployments",
		channotation.Datasource("clickhouse"),
	),
)
```

`ClickHouseAnnotationQuery` returns an `annotation.Option`.
`Query(sql)` overrides the expression; `Datasource("$source")` selects a datasource variable.
Empty queries are rejected. See [the result contract](../model.md#clickhouseannotationquery).
