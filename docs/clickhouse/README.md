---
tags:
  - datasource
---
# ClickHouse plugins

The ClickHouse package includes several plugins that provide comprehensive support for ClickHouse database in Perses dashboards.

## Datasource (`ClickHouseDatasource`)

The ClickHouse datasource enables connection between Perses and your ClickHouse database for analytical querying. It works with various visualization panels and supports SQL queries.

It supports the [proxy](https://perses.dev/perses/docs/concepts/proxy/) feature of Perses that allows to restrict the access to your data source.

See also technical docs related to this plugin:

- [Data model](./model.md#clickhousedatasource)
- [Dashboard-as-Code Go lib](./go-sdk/datasource.md)

## Time Series Query (`ClickHouseTimeSeriesQuery`)

The ClickHouse time series query plugin enables executing SQL queries against your ClickHouse database for time-based data visualization. It supports complex analytical queries and aggregations for metrics and time series data.

See also technical docs related to this plugin:

- [Data model](./model.md#clickhousetimeseriesquery)
- [Dashboard-as-Code Go lib](./go-sdk/timeseries-query.md)

## Log Query (`ClickHouseLogQuery`)

The ClickHouse log query plugin enables querying log data stored in your ClickHouse database. It supports log filtering, searching, and analysis for log management use cases.

See also technical docs related to this plugin:

- [Data model](./model.md#clickhouselogquery)
- [Dashboard-as-Code Go lib](./go-sdk/log-query.md)

## Variables

ClickHouse variables populate dashboard dropdowns from SQL results. Variables can reference earlier variables and can
be used in both time-series and log queries with the [standard Perses variable
syntax](https://perses.dev/perses/docs/concepts/variable/#using-variables). Variable SQL also supports the ClickHouse
`{start}` and `{end}` time-range placeholders.

### Query (`ClickHouseQueryVariable`)

Executes arbitrary SQL and uses the first returned column for each option. A query can instead return columns named
`__text` and `__value` to keep a friendly display label separate from the value inserted into panel queries.

- [Data model](./model.md#clickhousequeryvariable)
- [Dashboard-as-Code Go lib](./go-sdk/variable/query.md)

### Label Names (`ClickHouseLabelNamesVariable`)

Returns the column names from a SQL result. When a query returns one ClickHouse Map/object column, the Map keys are
returned instead, which is useful with OpenTelemetry resource and log attributes.

- [Data model](./model.md#clickhouselabelnamesvariable)
- [Dashboard-as-Code Go lib](./go-sdk/variable/label-names.md)

### Label Values (`ClickHouseLabelValuesVariable`)

Returns the unique values of a named result column or a named key inside a ClickHouse Map/object column.

- [Data model](./model.md#clickhouselabelvaluesvariable)
- [Dashboard-as-Code Go lib](./go-sdk/variable/label-values.md)
