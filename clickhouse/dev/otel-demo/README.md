# OpenTelemetry demo on ClickHouse and Perses

This development setup runs the official Astronomy Shop, its traffic generator and eBPF profiler with ClickHouse as the only telemetry backend. It provisions 11 migrated Grafana dashboards (164 panels) and an additional all-signals validation dashboard into the isolated Perses project `otel-demo`.

The source dashboards are pinned to [OpenTelemetry demo `33bd823`](https://github.com/open-telemetry/opentelemetry-demo/tree/33bd823107b1b38eaa88dd4ef625cc16d60475d4/src/grafana/provisioning/dashboards/demo). All container images are pinned by digest in [images.json](./images.json), including Collector 0.160.0 and ClickHouse 26.9.19.9. The application image tags in upstream `main` are mutable, so the digest lock is part of the reproduction.

## Data flow and coverage

The Collector writes standard `otel_logs`, `otel_traces`, `otel_profiles`, and native metric tables. A second metrics export writes ClickHouse's `TimeSeries` table `demo_metrics`. The migrated Prometheus expressions run through ClickHouse SQL `prometheusQuery` / `prometheusQueryRange`; no Prometheus datasource or server is involved. This preserves source rates, aggregations, label operations and quantiles. SQL editors and custom aliases remain usable.

The additional **ClickHouse • All signals** dashboard reads the native Collector tables and exercises:

- Native metrics, logs, trace search and a complete latest trace.
- Real eBPF `samples/count` profiles, flame graphs, function tables and sample timelines.
- Explicit and exponential histogram buckets, plus measured exemplars with trace/span IDs.
- SQL annotations and dependent service/metric variables. Service changes update every signal.

The load generator uses the SDK's exponential histogram aggregation to provide real exponential observations. Application services keep their explicit histogram defaults. The agent uses upstream's recorded VCR responses without an API key; open `/chatbot/` in the shop and select a sample question to generate chatbot request metrics.

## Migration differences

[The migration report](./migration-report.json) records panel-specific adaptations. The migration preserves every non-row panel, its grid position, title and SQL calculation where supported.

- Trace and log panels read native tables. PostgreSQL query tables use log rows with the source filters and aggregations retained.
- The service graph becomes a caller/callee table. The two Grafana alert lists become explanatory text because the source supplies no alert rules.
- Heatmaps display native cumulative histogram observations, rather than the original PromQL bucket rates. The validation dashboard separately demonstrates exemplar markers; the migrated percentile queries do not carry exemplars through the PromQL functions.
- Latest-metric timestamps use ClickHouse table metadata because `timestamp()` is unsupported by this version's PromQL engine. The APM host join deduplicates metadata and supports several service instances on one Docker host.
- The minimum rate window is four minutes, accounting for SDKs exporting every minute. Common variable expressions use SQL `WITH` bindings to keep browser GET queries below request-header limits.
- Docker has no Kubernetes labels; variable lists include an explicit **All** value. APM defaults to `ad`, which emits the legacy HTTP/gRPC metrics used by the source dashboard. Services using newer semantic conventions can leave those legacy panels empty.

Some upstream panels legitimately have no data: error-only SDK series without errors, VCR token usage, legacy PostgreSQL exporter series, Quote's obsolete span-processor metric, and host/filesystem metadata unavailable from the container view. Linux charts describe the Docker Linux VM/container, not macOS. These are recorded in the SQL validation report instead of replaced with invented zeros. The demo emits no summary metrics; summary conversion is covered by the existing unit fixtures.

## Prepare the demo

Use Docker Desktop with sufficient memory for the official full demo (the tested stack used 28 containers), Python 3.9+, Git, Go 1.27.2+ (as required by `go.mod`), and the repository's Node/npm versions. Keep the runtime on a responsive local disk.

From the plugins repository root, with sibling `perses`, `shared`, and `opentelemetry-demo` checkouts:

```sh
git clone https://github.com/open-telemetry/opentelemetry-demo.git ../opentelemetry-demo
git -C ../opentelemetry-demo checkout 33bd823107b1b38eaa88dd4ef625cc16d60475d4
python3 clickhouse/dev/otel-demo/configure.py \
  --demo ../opentelemetry-demo --runtime ../runtime

docker compose -p perses-otel-demo -f ../runtime/compose-resolved.json up -d
```

For shop access from Tailscale, add `--tailscale-ip "$(tailscale ip -4)"` to `configure.py`. ClickHouse remains on loopback port 18123. The shop listens on 18090, with the optional additional Tailscale binding. The profiler uses upstream's privileged Linux eBPF configuration; on Docker Desktop it profiles the Linux VM containers.

## Prepare Perses

This demo is pinned to shared `224c3187e04b5d694a96870bf27c826ec02d493f` and Perses `4f9350d788e9d7bfd8d852e36fd5b2d84305f1f5`. The launcher checks the shared checkout before starting. This shared commit includes profile variables and infinite cache freshness, before the later breaking query-context changes. Use the exact commit rather than the moving branch tip.

At this pin, metrics, logs and variable options receive `timeRange`; traces, profiles and annotations receive `absoluteTimeRange`. ClickHouse maps these declared contracts into its common SQL execution path. All query kinds retain variable interpolation. No runtime version detection or compatibility fallback is used.

Build shared and install its local plugin-system package for plugin type checking, without changing package manifests or dependency versions:

```sh
git -C ../shared fetch origin feat/clickhouse-profile-variables
git -C ../shared switch --detach 224c3187e04b5d694a96870bf27c826ec02d493f
(cd ../shared && npm ci && npm run build)
(cd ../shared/plugin-system && npm pack --pack-destination ../..)
npm ci
npm install --ignore-scripts --no-save ../perses-dev-plugin-system-0.55.0.tgz
npm run build -w clickhouse -w timeserieschart -w logstable -w tracetable \
  -w tracingganttchart -w histogramchart -w heatmapchart -w flamechart \
  -w statchart -w gaugechart -w barchart -w timeseriestable -w markdown

(cd ../perses/ui && npm ci && npm exec -- tsc --project internal-utils --noEmit false)
(cd ../perses && bash scripts/compress_assets.sh && go build -o ../bin/perses ./cmd/perses)
```

Start the API, plugin server and shared-development UI as detached processes. The launcher writes process IDs and logs under the selected runtime directory and provisions the dashboards. Set `--host "$(tailscale ip -4)"` for private remote access; the default is loopback.

```sh
python3 clickhouse/dev/otel-demo/run_perses.py start \
  --runtime ../runtime --perses ../perses --shared ../shared --binary ../bin/perses \
  --host "$(tailscale ip -4)"
```

Open `http://<tailscale-ip>:18080/projects/otel-demo/dashboards/signal-validation` for native signals, `http://<tailscale-ip>:18080/projects/otel-demo` for the migrated dashboard list, and `http://<tailscale-ip>:18090/` for the shop. These development instances have authentication disabled and use private Tailscale access; no Funnel is configured. Wait a few minutes for rates and profile samples to accumulate.

## Regenerate and validate

The generator verifies the source commit before migrating. After regeneration, format the JSON and provision it:

```sh
python3 clickhouse/dev/otel-demo/migrate.py ../opentelemetry-demo
python3 clickhouse/dev/otel-demo/signals.py
npm exec -- oxfmt clickhouse/dev/otel-demo/dashboards clickhouse/dev/otel-demo/migration-report.json
python3 clickhouse/dev/otel-demo/provision.py
python3 -m unittest discover -s clickhouse/dev/otel-demo -p 'test_*.py'
python3 clickhouse/dev/otel-demo/validate.py --step 2 --output ../runtime/sql-validation.json

npm exec -w e2e -- playwright install chromium
OTEL_DEMO_E2E_URL="http://$(tailscale ip -4):18080" \
  npm exec -w e2e -- playwright test src/tests/clickhouse/otel-demo.spec.ts --workers=1
```

The SQL validator runs every variable, panel and annotation query and requires nonempty native signal results. Browser tests traverse lazy-rendered panels on all 12 dashboards, detect query/runtime failures, verify native charts and profiles, change service variables, and refresh an absolute time range despite infinite query freshness. Live SQL/browser runs are separate from the existing synthetic fixture, which must not overwrite these Collector tables.

Run the repository checks against the pinned local plugin-system package. See [validation.md](./validation.md) for the results and remaining telemetry limits.

## Stop or restart

```sh
python3 clickhouse/dev/otel-demo/run_perses.py stop --runtime ../runtime
docker compose -p perses-otel-demo -f ../runtime/compose-resolved.json down
```

This preserves telemetry volumes. Start again with Compose and the launcher commands above. The Collector's native tables use a 72-hour TTL; the demo's `TimeSeries` table persists until its dedicated volume is removed.
