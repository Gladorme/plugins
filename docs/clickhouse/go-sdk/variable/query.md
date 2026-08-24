# ClickHouse Query Variable Go SDK

## Constructor

```golang
import clickhousequery "github.com/perses/plugins/clickhouse/sdk/go/variable/query"

clickhousequery.ClickHouseQuery("SELECT DISTINCT service FROM logs ORDER BY service")
```

The first result column supplies both the label and value. Return `__text` and `__value` columns for distinct display
labels and inserted values.

## Available options

- `Query(string)` replaces the SQL passed to the constructor.
- `Datasource(string)` selects a named ClickHouse datasource.

## Example

```golang
dashboard.New("ClickHouse Dashboard",
	dashboard.AddVariable("service", listvariable.List(
		clickhousequery.ClickHouseQuery(
			"SELECT DISTINCT service_name AS __text, service_id AS __value FROM services",
			clickhousequery.Datasource("ClickHouseMain"),
		),
	)),
)
```
