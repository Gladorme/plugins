# ClickHouse Label Names Variable Go SDK

## Constructor

```golang
import labelnames "github.com/perses/plugins/clickhouse/sdk/go/variable/label-names"

labelnames.ClickHouseLabelNames("SELECT ResourceAttributes FROM otel_logs")
```

The result columns become variable options. If the query returns one ClickHouse Map/object column, its keys become the
options instead.

## Available options

- `Query(string)` replaces the SQL passed to the constructor.
- `Datasource(string)` selects a named ClickHouse datasource.

## Example

```golang
dashboard.New("ClickHouse Dashboard",
	dashboard.AddVariable("label", listvariable.List(
		labelnames.ClickHouseLabelNames(
			"SELECT ResourceAttributes FROM otel_logs WHERE Timestamp BETWEEN '{start}' AND '{end}'",
		),
	)),
)
```
