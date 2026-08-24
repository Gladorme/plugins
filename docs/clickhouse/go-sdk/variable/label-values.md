# ClickHouse Label Values Variable Go SDK

## Constructor

```golang
import labelvalues "github.com/perses/plugins/clickhouse/sdk/go/variable/label-values"

labelvalues.ClickHouseLabelValues("SELECT ResourceAttributes FROM otel_logs", "service.name")
```

The named result column or ClickHouse Map/object key supplies the unique variable options.

## Available options

- `Query(string)` replaces the SQL passed to the constructor.
- `LabelName(string)` replaces the label name passed to the constructor.
- `Datasource(string)` selects a named ClickHouse datasource.

## Example

```golang
dashboard.New("ClickHouse Dashboard",
	dashboard.AddVariable("service", listvariable.List(
		labelvalues.ClickHouseLabelValues(
			"SELECT ResourceAttributes FROM otel_logs WHERE Timestamp BETWEEN '{start}' AND '{end}'",
			"service.name",
			labelvalues.Datasource("ClickHouseMain"),
		),
	)),
)
```
