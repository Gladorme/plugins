# ClickHouse plugin models

This documentation provides the definition of the different plugins related to ClickHouse.

## ClickHouseDatasource

ClickHouse as a datasource is basically an HTTP server. So we need to define an HTTP config.

```yaml
kind: "ClickHouseDatasource"
spec:
  # It is the url of the datasource.
  # Leave it empty if you don't want to access the datasource directly from the UI.
  # You should define a proxy if you want to access the datasource through the Perses' server.
  directUrl: <url> # Optional

  # It is the http configuration that will be used by the Perses' server to redirect to the datasource any query sent by the UI.
  proxy: <HTTP Proxy specification> # Optional
```

### HTTP Proxy specification

See [common plugin definitions](https://perses.dev/perses/docs/plugins/common/#http-proxy-specification).

### Example

A simple ClickHouse datasource would be

```yaml
kind: "Datasource"
metadata:
  name: "ClickHouseMain"
  project: "analytics"
spec:
  default: true
  plugin:
    kind: "ClickHouseDatasource"
    spec:
      directUrl: "http://clickhouse.example.com:8123"
```

A more complex one:

```yaml
kind: "Datasource"
metadata:
  name: "ClickHouseMain"
  project: "analytics"
spec:
  default: true
  plugin:
    kind: "ClickHouseDatasource"
    spec:
      proxy:
        kind: "HTTPProxy"
        spec:
          url: "http://clickhouse.example.com:8123"
          allowedEndpoints:
            - endpointPattern: "/?"
              method: "POST"
            - endpointPattern: "/ping"
              method: "GET"
          secret: "clickhouse_secret_config"
```

## ClickHouseTimeSeriesQuery

Perses supports time series queries for ClickHouse: `ClickHouseTimeSeriesQuery`.

```yaml
kind: "ClickHouseTimeSeriesQuery"
spec:
  # `query` is the SQL expression for time series data.
  query: <string>

  # `datasource` is a datasource selector. If not provided, the default ClickHouseDatasource is used.
  # See the documentation about the datasources to understand how it is selected.
  datasource: <ClickHouse Datasource selector> # Optional

  # The output format for the query results
  format: <string> # Optional
```

- See [ClickHouse Datasource selector](#clickhouse-datasource-selector)

### Example

A simple time series query:

```yaml
kind: "TimeSeriesQuery"
spec:
  plugin:
    kind: "ClickHouseTimeSeriesQuery"
    spec:
      query: "SELECT toStartOfMinute(timestamp) as time, count() as requests FROM http_logs WHERE timestamp >= now() - INTERVAL 1 HOUR GROUP BY time ORDER BY time"
```

## ClickHouseLogQuery

Perses supports log queries for ClickHouse: `ClickHouseLogQuery`.

```yaml
kind: "ClickHouseLogQuery"
spec:
  # `query` is the SQL expression for log data.
  query: <string>

  # `datasource` is a datasource selector. If not provided, the default ClickHouseDatasource is used.
  # See the documentation about the datasources to understand how it is selected.
  datasource: <ClickHouse Datasource selector> # Optional

  # The output format for the query results
  format: <string> # Optional
```

- See [ClickHouse Datasource selector](#clickhouse-datasource-selector)

### Example

A simple log query:

```yaml
kind: "LogQuery"
spec:
  plugin:
    kind: "ClickHouseLogQuery"
    spec:
      query: "SELECT timestamp, level, message, service FROM application_logs WHERE level = 'ERROR' AND timestamp >= now() - INTERVAL 1 HOUR ORDER BY timestamp DESC LIMIT 1000"
```

## ClickHouseQueryVariable

```yaml
kind: "ClickHouseQueryVariable"
spec:
  # SQL used to populate the variable options. The first column is used by default.
  # Return __text and __value columns to provide separate labels and values.
  query: <string>

  # If omitted, the default ClickHouseDatasource is used.
  datasource: <ClickHouse Datasource selector> # Optional
```

### Example

```yaml
kind: "ListVariable"
spec:
  name: "service"
  plugin:
    kind: "ClickHouseQueryVariable"
    spec:
      query: "SELECT DISTINCT service_name AS __text, service_id AS __value FROM services ORDER BY __text"
```

## ClickHouseLabelNamesVariable

```yaml
kind: "ClickHouseLabelNamesVariable"
spec:
  # SQL whose result columns, or single returned Map/object column keys, become options.
  query: <string>
  datasource: <ClickHouse Datasource selector> # Optional
```

### Example

```yaml
kind: "ListVariable"
spec:
  name: "label"
  plugin:
    kind: "ClickHouseLabelNamesVariable"
    spec:
      query: "SELECT ResourceAttributes FROM otel_logs WHERE Timestamp BETWEEN '{start}' AND '{end}'"
```

## ClickHouseLabelValuesVariable

```yaml
kind: "ClickHouseLabelValuesVariable"
spec:
  # SQL whose result contains the requested column or Map/object key.
  query: <string>
  labelName: <string>
  datasource: <ClickHouse Datasource selector> # Optional
```

### Example

```yaml
kind: "ListVariable"
spec:
  name: "service"
  plugin:
    kind: "ClickHouseLabelValuesVariable"
    spec:
      query: "SELECT ResourceAttributes FROM otel_logs WHERE Timestamp BETWEEN '{start}' AND '{end}'"
      labelName: "service.name"
```

## Shared definitions

### ClickHouse Datasource selector

!!! note
    See [Selecting / Referencing a Datasource](https://github.com/perses/perses/blob/main/docs/api/datasource.md#selecting--referencing-a-datasource)

```yaml
kind: "ClickHouseDatasource"
# The name of the datasource regardless its level
name: <string> # Optional
```
