# ClickHouse plugin

Provides SQL queries for metrics, logs, trace search and detail, profiles, annotations, and dashboard variables.

See the [user documentation](../docs/clickhouse/README.md) for query contracts, OpenTelemetry examples, and Go builders.

## Development

Follow the [repository development instructions](../README.md). From the repository root:

```sh
npm ci
npm run type-check -w clickhouse
npm run test -w clickhouse
npm run build -w clickhouse
```

Use `percli plugin start ./clickhouse` with a local Perses server to exercise the editors.

For optional live SQL tests, start a disposable ClickHouse instance and load
[the synthetic fixture](./dev/fixture.sql) into its default database:

```sh
docker run --detach --rm --name perses-clickhouse-test \
  --publish 127.0.0.1:18123:8123 --env CLICKHOUSE_SKIP_USER_SETUP=1 \
  clickhouse/clickhouse-server:26.2
docker exec -i perses-clickhouse-test clickhouse-client --multiquery < clickhouse/dev/fixture.sql
CLICKHOUSE_TEST_URL=http://127.0.0.1:18123 npm run test -w clickhouse
docker stop perses-clickhouse-test
```

The fixture creates test tables; use a disposable instance. Live tests are skipped unless `CLICKHOUSE_TEST_URL` is set.

## Browser integration

The [sample dashboard](./dev/dashboard.json) exercises all six query types against the fixture.
Load the ClickHouse, TimeSeriesChart, LogsTable, TraceTable, TracingGanttChart, HistogramChart, HeatMapChart, and FlameChart plugins in a disposable Perses server
with authentication disabled and the loopback datasource proxy enabled. The fixture datasource uses port 18123. The host must include the shared runtime profile-variable support
for service filters in the Flame Chart panel.

Run the browser test from the repository root, with the server's base URL:

```sh
CLICKHOUSE_E2E_URL=http://127.0.0.1:18080 npm exec -w e2e -- playwright test src/tests/clickhouse
```

The test creates and removes its own project and dashboard. For manual inspection of the sample, open the dashboard
with `?start=1735689600000&end=1735693200000` to select the fixture's time range.

## OpenTelemetry demo

For real application telemetry, the [OpenTelemetry demo setup](./dev/otel-demo/README.md) runs the official Astronomy Shop with ClickHouse,
11 migrated Grafana dashboards and a native signal validation dashboard. It includes pinned images, provisioning,
Tailscale access instructions and browser tests. Keep this runtime separate from the synthetic fixture above.
