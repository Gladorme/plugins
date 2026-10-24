---
tags:
    - datasource
---

# ClickHouse plugins

Query ClickHouse from Perses using SQL. The package provides:

- `ClickHouseDatasource`: HTTP access directly or through the Perses proxy.
- `ClickHouseTimeSeriesQuery`: numeric metrics grouped by labels.
- `ClickHouseLogQuery`: log messages, timestamps, attributes, and volume queries.
- `ClickHouseTraceQuery`: trace search and OTLP trace detail for waterfall panels.
- `ClickHouseProfileQuery`: Collector or custom SQL stacks for Flame Chart panels.
- `ClickHouseAnnotationQuery`: point and range annotations.
- `ClickHouseVariable`: query-backed dropdowns, including chained variables.

The examples use the [OpenTelemetry Collector ClickHouse exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/clickhouseexporter)
tables. Custom schemas work by aliasing columns to the documented result names.
SQL editors include examples; trace, profile, annotation, and variable editors start with OpenTelemetry queries.

See the [data models and SQL examples](./model.md), and the Go SDK documentation for
[datasources](./go-sdk/datasource.md), [metrics](./go-sdk/timeseries-query.md),
[logs](./go-sdk/log-query.md), [traces](./go-sdk/trace-query.md), [profiles](./go-sdk/profile-query.md),
[annotations](./go-sdk/annotation-query.md), and [variables](./go-sdk/variable.md).
