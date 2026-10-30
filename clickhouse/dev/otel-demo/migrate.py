#!/usr/bin/env python3
# Copyright The Perses Authors
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Migrate the pinned OTel demo dashboards to ClickHouse SQL, without dependencies."""
import argparse
import json
from pathlib import Path
import re
import subprocess

DEMO_REVISION = "33bd823107b1b38eaa88dd4ef625cc16d60475d4"
PROJECT = "otel-demo"
START = "toDateTime64('{start}', 3, 'UTC')"
END = "toDateTime64('{end}', 3, 'UTC')"
LOG_RANGE = f"Timestamp BETWEEN {START} AND {END}"
METRIC_RANGE = f"TimeUnix BETWEEN {START} AND {END}"
VARIABLE = re.compile(r"\$(?:\{([A-Za-z_]\w*)(?::\w+)?\}|([A-Za-z_]\w*))")
LABELS = "mapFromArrays(arrayMap(t -> t.1, tags), arrayMap(t -> t.2, tags))"

def quote(value):
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"

def var(name):
    return "$" + "{" + name + ":sqlstring}"

def regex_value(name):
    values = "[" + var(name) + "]"
    return f"if(has({values}, '.*'), '.*', arrayStringConcat(arrayMap(v -> regexpQuoteMeta(v), {values}), '|'))"

def matches(column, name):
    return f"match({column}, concat('^(?:', {regex_value(name)}, ')$'))"

def concat(parts):
    return parts[0] if len(parts) == 1 else "concat(" + ", ".join(parts) + ")"

def promql_sql(expression, names):
    """Quote SQL and nested PromQL independently; preserve multi-select matching."""
    expression = re.sub(r'(?<!!)(?<!~)=\s*("(?:(?:\\.|[^"\\])*\$(?:\{)?[A-Za-z_](?:\\.|[^"\\])*)")',
                        r'=~\1', expression)
    parts, position = [], 0
    token = re.compile(r'"(?:\\.|[^"\\])*"|\$(?:\{\w+(?::\w+)?\}|\w+)')
    for match in token.finditer(expression):
        raw = match.group()
        if raw.startswith('"'):
            value = json.loads(raw)
            variables = list(VARIABLE.finditer(value))
            if not variables:
                continue
            nested, offset = [], 0
            for dependency in variables:
                name = dependency.group(1) or dependency.group(2)
                if name not in names:
                    raise ValueError(f"Unknown dashboard variable: {name}")
                if dependency.start() > offset:
                    nested.append(quote(value[offset:dependency.start()]))
                nested.append(regex_value(name))
                offset = dependency.end()
            if offset < len(value):
                nested.append(quote(value[offset:]))
            replacement = "toJSONString(" + concat(nested) + ")"
        else:
            dependency = VARIABLE.fullmatch(raw)
            name = dependency.group(1) or dependency.group(2)
            macros = {
                "__rate_interval": "concat(toString(greatest(240, {step} * 4)), 's')",
                "__interval": "concat(toString(greatest(1, {step})), 's')",
                "__interval_ms": "toString({step} * 1000)",
                "__range": f"concat(toString(greatest(1, dateDiff('second', {START}, {END}))), 's')",
                "__range_s": f"toString(greatest(1, dateDiff('second', {START}, {END})))",
            }
            if name not in macros:
                raise ValueError(f"Unexpected unquoted PromQL variable: {name}")
            replacement = macros[name]
        if match.start() > position:
            parts.append(quote(expression[position:match.start()]))
        parts.append(replacement)
        position = match.end()
    if position < len(expression):
        parts.append(quote(expression[position:]))
    return concat(parts) if parts else quote(expression)

def metric_query(expression, names, instant=False, alias="value"):
    expr = promql_sql(expression, names)
    bindings = []
    for name in sorted(names):
        value = regex_value(name)
        if value in expr:
            binding = "demo_var_" + name
            expr = expr.replace(value, binding)
            bindings.append(value + " AS " + binding)
    prefix = "WITH " + ",\n".join(bindings) + "\n" if bindings else ""
    column = '"' + alias.replace('"', '""') + '"'
    if instant:
        return (prefix + f"SELECT timestamp AS time, if(isFinite(value), value, NULL) AS {column},\n"
                f"  {LABELS} AS labels\nFROM prometheusQuery(demo_metrics, {expr}, {END})")
    return (prefix + f"SELECT sample.1 AS time, if(isFinite(sample.2), sample.2, NULL) AS {column},\n"
            f"  {LABELS} AS labels\n"
            f"FROM prometheusQueryRange(demo_metrics, {expr}, {START}, {END}, toIntervalSecond({{step}}))\n"
            "ARRAY JOIN samples AS sample\nORDER BY time")

def query(sql, kind="TimeSeriesQuery", **options):
    plugin = {"TimeSeriesQuery": "ClickHouseTimeSeriesQuery", "LogQuery": "ClickHouseLogQuery",
              "TraceQuery": "ClickHouseTraceQuery", "ProfileQuery": "ClickHouseProfileQuery"}[kind]
    return {"kind": kind, "spec": {"plugin": {"kind": plugin, "spec": {"query": sql, **options}}}}

def datasource():
    return {"default": True, "plugin": {"kind": "ClickHouseDatasource", "spec": {"proxy": {
        "kind": "HTTPProxy", "spec": {"url": "http://127.0.0.1:18123",
                                   "allowedEndpoints": [{"endpointPattern": "/", "method": "GET"}]}}}}}

def list_variable(name, sql, default=None, multiple=True):
    return {"kind": "ListVariable", "spec": {
        "name": name, "allowMultiple": multiple, "allowAllValue": False,
        "defaultValue": default or ([".*"] if multiple else ".*"),
        "plugin": {"kind": "ClickHouseVariable", "spec": {"query":
            "SELECT '.*' AS value, 'All' AS label\nUNION DISTINCT\n"
            "SELECT value, value AS label FROM (\n" + sql + "\n) WHERE value != ''\nORDER BY label"}}}}

def tag_filter(selector, names):
    match = re.fullmatch(r"\s*([A-Za-z_:][\w:]*)?\s*(?:\{(.*)\})?\s*", selector, re.S)
    if not match:
        raise ValueError("Expected metric selector: " + selector)
    predicates = []
    if match.group(1):
        predicates.append("metric_name = " + quote(match.group(1)))
    for label, op, raw in re.findall(r'([A-Za-z_]\w*)\s*(=~|!~|!=|=)\s*("(?:\\.|[^"\\])*")', match.group(2) or ""):
        value = json.loads(raw)
        found = VARIABLE.fullmatch(value)
        column = "metric_name" if label == "__name__" else "tags[" + quote(label) + "]"
        if found:
            name = found.group(1) or found.group(2)
            if name not in names:
                raise ValueError("Unknown selector variable: " + name)
            predicate = ("NOT " if op in ["!~", "!="] else "") + matches(column, name)
        elif op in ["=~", "!~"]:
            predicate = ("NOT " if op == "!~" else "") + f"match({column}, {quote('^(?:' + value + ')$')})"
        else:
            predicate = column + (" != " if op == "!=" else " = ") + quote(value)
        predicates.append(predicate)
    return " AND ".join(predicates) or "1"

def migrate_variables(source, slug):
    originals = [v for v in source.get("templating", {}).get("list", []) if v["type"] != "datasource"]
    names, variables = {v["name"] for v in originals}, []
    for v in originals:
        name, value = v["name"], v.get("query", "")
        if isinstance(value, dict):
            value = value.get("query", "")
        if v["type"] in ["constant", "textbox"]:
            variables.append({"kind": "TextVariable", "spec": {"name": name, "value": str(value or "")}})
            continue
        default = None
        if name == "service_name" and slug in ["apm-dashboard", "opentelemetry-collector"]:
            default = ["ad" if slug == "apm-dashboard" else "otelcol-contrib"]
        if name in ["service", "service_name"] and not value.startswith("label_values"):
            if slug == "events-by-name":
                sql = f"SELECT DISTINCT ServiceName AS value FROM otel_logs WHERE {LOG_RANGE} AND EventName != ''"
            else:
                sql = "SELECT DISTINCT tags['service_name'] AS value FROM timeSeriesTags(demo_metrics)"
                if slug == "self-observability":
                    sql += " WHERE startsWith(metric_name, 'otel_sdk_')"
        elif name == "event_name":
            sql = f"SELECT DISTINCT EventName AS value FROM otel_logs WHERE {LOG_RANGE} AND {matches('ServiceName', 'service')}"
        elif name == "severity":
            sql = f"SELECT DISTINCT SeverityText AS value FROM otel_logs WHERE {LOG_RANGE} AND {matches('ServiceName', 'service')} AND {matches('EventName', 'event_name')}"
        elif name == "query_db":
            sql = f"SELECT DISTINCT LogAttributes['db.namespace'] AS value FROM otel_logs WHERE {LOG_RANGE} AND EventName = 'db.server.top_query'"
        elif name == "span_name":
            sql = "SELECT DISTINCT tags['span_name'] AS value FROM timeSeriesTags(demo_metrics) WHERE startsWith(metric_name, 'traces_span_metrics_') AND " + matches("tags['service_name']", "service")
        elif name == "host_count":
            # Unused hidden source variable refers to the undefined $ip.
            continue
        elif value.startswith("label_values("):
            selector, label = value[len("label_values("):-1].rsplit(",", 1)
            sql = f"SELECT DISTINCT tags[{quote(label.strip())}] AS value FROM timeSeriesTags(demo_metrics) WHERE " + tag_filter(selector, names)
        else:
            raise ValueError(f"Variable has no explicit migration: {slug}/{name}: {value}")
        variables.append(list_variable(name, sql, default))
    return variables

def all_panels(panels):
    for panel in panels:
        if panel["type"] != "row":
            yield panel
        yield from all_panels(panel.get("panels", []))

def log_filter(slug):
    predicates = [LOG_RANGE]
    if slug in ["demo-dashboard", "events-by-name"]:
        predicates.append(matches("ServiceName", "service"))
    if slug in ["apm-dashboard", "opentelemetry-collector"]:
        predicates.append(matches("ServiceName", "service_name"))
    if slug == "apm-dashboard":
        predicates.append(matches("ResourceAttributes['service.namespace']", "service_namespace"))
    if slug == "demo-dashboard":
        predicates.append(f"({var('traceId')} = '' OR TraceId = {var('traceId')})")
    if slug == "events-by-name":
        predicates += ["EventName != ''", matches("EventName", "event_name"), matches("SeverityText", "severity")]
    if slug == "postgresql-dashboard":
        predicates.append(matches("LogAttributes['db.namespace']", "query_db"))
    return " AND ".join(predicates)

def native_logs(slug, panel):
    filters = log_filter(slug)
    columns = "Timestamp, Body, SeverityText, ServiceName, TraceId, SpanId, ResourceAttributes, LogAttributes, EventName"
    if slug == "postgresql-dashboard":
        event = "db.server.top_query" if panel["id"] in [17, 19] else "db.server.query_sample"
        filters += " AND EventName = " + quote(event)
        filters += " AND LogAttributes['postgresql.rolname'] != 'monitoring_user' AND LogAttributes['user.name'] != 'monitoring_user'"
        columns = "Timestamp, LogAttributes['db.query.text'] AS Body, ServiceName, LogAttributes, EventName"
        if panel["id"] == 17:
            aggregates = {
                "total_exec_time_s": "total_exec_time", "total_plan_time_s": "total_plan_time",
                "calls": "calls", "rows": "rows", "blocks_read": "shared_blks_read",
                "blocks_hit": "shared_blks_hit", "blocks_written": "shared_blks_written",
                "temp_read": "temp_blks_read", "temp_written": "temp_blks_written",
            }
            fields = [f"sum(toFloat64OrZero(LogAttributes['postgresql.{attr}'])) AS {alias}" for alias, attr in aggregates.items()]
            return ("SELECT max(Timestamp) AS Timestamp, LogAttributes['db.query.text'] AS Body,\n"
                    "  LogAttributes['db.namespace'] AS database, LogAttributes['postgresql.rolname'] AS role,\n"
                    "  LogAttributes['postgresql.queryid'] AS query_id,\n  " + ",\n  ".join(fields) + ",\n"
                    "  total_exec_time_s * 1000 / nullIf(calls, 0) AS avg_exec_ms\n"
                    f"FROM otel_logs WHERE {filters.replace('Timestamp BETWEEN', 'otel_logs.Timestamp BETWEEN')} GROUP BY Body, database, role, query_id\n"
                    "HAVING calls > 0 ORDER BY total_exec_time_s DESC LIMIT 20")
        if panel["id"] == 21:
            filters += " AND (LogAttributes['postgresql.wait_event_type'] != '' OR LogAttributes['postgresql.blocking.pids'] NOT IN ('', '{}'))"
        order = "toFloat64OrZero(LogAttributes['postgresql.total_exec_time'])" if panel["id"] == 22 else "Timestamp"
        return f"SELECT {columns} FROM otel_logs WHERE {filters} ORDER BY {order} DESC LIMIT 50"
    return f"SELECT {columns} FROM otel_logs WHERE {filters} ORDER BY Timestamp DESC LIMIT 100"

def native_trace(slug):
    filters = [LOG_RANGE, matches("ServiceName", "service_name")]
    if slug == "apm-dashboard":
        filters.append(matches("ResourceAttributes['service.namespace']", "service_namespace"))
    return ("SELECT * FROM otel_traces WHERE TraceId IN (\n"
            "  SELECT TraceId FROM otel_traces WHERE " + " AND ".join(filters) +
            "\n  GROUP BY TraceId ORDER BY max(Timestamp) DESC LIMIT 50\n) ORDER BY Timestamp")

FORMATS = {"short": "decimal", "none": "decimal", "percent": "percent", "percentunit": "percent-decimal",
           "s": "seconds", "ms": "milliseconds", "ns": "nanoseconds", "bytes": "bytes", "decbytes": "decbytes",
           "Bps": "bytes/sec", "ops": "ops/sec", "reqps": "requests/sec", "dtdurations": "seconds",
           "dateTimeFromNow": "unix-timestamp", "hertz": "counts/sec"}

def migrate_panel(panel, slug, names, notes):
    targets = [t for t in panel.get("targets", []) if not t.get("hide")]
    first = targets[0] if targets else {}
    title = panel.get("title") or ("Logs" if first.get("query") else
                                   "Traces" if first.get("queryType") == "search" else
                                   "Overview" if panel["type"] == "text" else "Details")
    description = panel.get("description", "")
    kind, options, queries = "TimeSeriesChart", {}, []
    unit = FORMATS.get(panel.get("fieldConfig", {}).get("defaults", {}).get("unit"))
    fmt = {"unit": unit} if unit else None
    if panel["type"] == "text":
        kind, options = "Markdown", {"text": panel.get("options", {}).get("content", "")}
    elif panel["type"] == "alertlist":
        kind, options = "Markdown", {"text": "Grafana-managed alert rules are not included in the upstream demo dashboards. No alert rules are evaluated by this ClickHouse datasource. The signal validation dashboard separately demonstrates SQL annotations from live application event logs."}
        notes.append({"panel": panel["id"], "change": "Grafana alert list replaced with an explicit explanation; no rules were supplied."})
    elif panel["type"] == "nodeGraph":
        kind = "TimeSeriesTable"
        sql = (f"SELECT {END} AS time, parent.ServiceName AS caller, child.ServiceName AS callee, count() AS calls\n"
               "FROM otel_traces AS child INNER JOIN otel_traces AS parent\n"
               "ON child.TraceId = parent.TraceId AND child.ParentSpanId = parent.SpanId\n"
               f"WHERE child.Timestamp BETWEEN {START} AND {END} AND caller != callee\n"
               "GROUP BY caller, callee ORDER BY calls DESC LIMIT 100")
        queries = [query(sql)]
        notes.append({"panel": panel["id"], "change": "Service dependency graph represented as a caller/callee table with observed span counts."})
    elif panel["type"] == "heatmap":
        metric = "demo.cart.get_cart.latency" if panel["id"] == 2 else "demo.cart.add_item.latency"
        kind, options = "HeatMapChart", {"yAxisFormat": {"unit": "seconds"}, "min": 0}
        queries = [query(f"SELECT * FROM otel_metrics_histogram WHERE MetricName = {quote(metric)} AND {METRIC_RANGE} ORDER BY TimeUnix LIMIT 10000")]
        notes.append({"panel": panel["id"], "change": "Uses native OTel histogram buckets; displays recorded cumulative observations rather than PromQL bucket rates."})
    elif slug == "apm-dashboard" and panel["id"] == 39:
        kind, options = "StatChart", {"calculation": "last-number", "format": {"unit": "unix-timestamp"}}
        filters = " AND ".join(matches("tags[" + quote(label) + "]", label) for label in ["deployment_environment_name", "service_namespace", "service_name"])
        queries = [query(f"SELECT {END} AS time, toUnixTimestamp(max(max_time)) AS value FROM timeSeriesTags(demo_metrics) WHERE metric_name = 'target_info' AND {filters}")]
        notes.append({"panel": panel["id"], "change": "Latest metric timestamp is read directly from ClickHouse metadata because timestamp() is not implemented in this PromQL engine."})
    elif slug == "events-by-name":
        kind = "TimeSeriesTable" if panel["id"] == 1 else "TimeSeriesChart"
        time = END if panel["id"] == 1 else "toStartOfInterval(Timestamp, toIntervalSecond({step}))"
        sql = f"SELECT {time} AS time, ServiceName AS service, EventName AS event, count() AS log_count FROM otel_logs WHERE {log_filter(slug)}"
        sql += " GROUP BY time, service, event ORDER BY " + ("log_count DESC LIMIT 20" if panel["id"] == 1 else "time")
        queries = [query(sql)]
    elif slug == "demo-dashboard" and panel["id"] == 20:
        kind = "TimeSeriesTable"
        queries = [query(f"SELECT {END} AS time, SeverityText AS severity, count() AS count FROM otel_logs WHERE {log_filter(slug)} GROUP BY severity ORDER BY count DESC")]
    elif any(t.get("datasource", {}).get("type") == "jaeger" for t in targets):
        kind, queries = "TraceTable", [query(native_trace(slug), "TraceQuery")]
    elif any(t.get("query") for t in targets):
        kind, options, queries = "LogsTable", {"showTime": True, "allowWrap": True, "enableDetails": True}, [query(native_logs(slug, panel), "LogQuery")]
        if panel["type"] == "table":
            notes.append({"panel": panel["id"], "change": "Text-rich log table uses LogsTable; SQL retains source filters, fields and ordering."})
    else:
        instant = panel["type"] in ["stat", "gauge", "bargauge", "table"]
        kind = {"stat": "StatChart", "gauge": "GaugeChart", "bargauge": "BarChart", "table": "TimeSeriesTable"}.get(panel["type"], "TimeSeriesChart")
        if kind in ["StatChart", "GaugeChart", "BarChart"]:
            options["calculation"] = "last-number"
            if fmt:
                options["format"] = fmt
        if kind == "BarChart":
            options.update({"orientation": "horizontal", "sort": "desc"})
        if kind == "TimeSeriesChart" and fmt:
            options["yAxis"] = {"format": fmt}
        for target in targets:
            expression = target.get("expr", "").strip()
            if not expression:
                continue
            expression = expression.replace("kk8s_cluster_name", "k8s_cluster_name").replace("dpostgresql_database_name", "postgresql_database_name")
            if slug == "apm-dashboard" and panel["id"] == 41:
                expression = expression.replace("group_left(service_instance_id)", "group_right")
                expression = re.sub(r"target_info\{[^}]*\$\{service_name\}[^}]*\}",
                                    lambda match: "max by (host_name, service_instance_id) (" + match.group() + ")", expression)
                notes.append({"panel": panel["id"], "change": "Deduplicates host metadata and uses a one-host-to-many-instances join for Docker's shared host."})
            queries.append(query(metric_query(expression, names, instant, target.get("refId", "value"))))
    if not queries and kind != "Markdown":
        raise ValueError(f"Panel has no explicit migration: {slug}/{panel['id']}")
    spec = {"display": {"name": title}, "plugin": {"kind": kind, "spec": options}}
    if description:
        spec["display"]["description"] = description
    if queries:
        spec["queries"] = queries
    return {"kind": "Panel", "spec": spec}

def migrate(source, slug):
    variables = migrate_variables(source, slug)
    names = {v["spec"]["name"] for v in variables}
    notes = []
    if slug == "postgresql-dashboard":
        for name in ["job", "cluster", "instance"]:
            variables.append({"kind": "TextVariable", "spec": {"name": name, "value": ".*"}})
            names.add(name)
        notes.append({"change": "Declared legacy Postgres-exporter filters referenced but missing from source; exporter-only series may remain empty."})
    panels, items = {}, []
    for panel in all_panels(source["panels"]):
        key = "panel-" + str(panel["id"])
        panels[key] = migrate_panel(panel, slug, names, notes)
        grid = panel.get("gridPos", {"x": 0, "y": len(items) * 8, "w": 24, "h": 8})
        items.append({"x": grid["x"], "y": grid["y"], "width": grid["w"], "height": max(3, grid["h"]),
                      "content": {"$ref": "#/spec/panels/" + key}})
    title = source["title"].replace("(Jaeger, Prometheus, OpenSearch)", "(ClickHouse)")
    return {"kind": "Dashboard", "metadata": {"name": slug.lower(), "project": PROJECT}, "spec": {
        "display": {"name": title, "description": "Migrated from OpenTelemetry demo " + DEMO_REVISION +
                    ". All queries use ClickHouse. Metrics preserve PromQL calculations through ClickHouse SQL; other signals read Collector tables."},
        "duration": "15m", "refreshInterval": "30s", "datasources": {"clickhouse": datasource()},
        "variables": variables, "panels": panels, "layouts": [{"kind": "Grid", "spec": {"items": items}}]}}, notes

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("demo", type=Path, help="Checkout of open-telemetry/opentelemetry-demo")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "dashboards")
    args = parser.parse_args()
    revision = subprocess.check_output(["git", "-C", str(args.demo), "rev-parse", "HEAD"], text=True).strip()
    if revision != DEMO_REVISION:
        parser.error("Expected OTel demo revision " + DEMO_REVISION + "; got " + revision)
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"sourceRevision": DEMO_REVISION, "dashboards": []}
    for path in sorted((args.demo / "src/grafana/provisioning/dashboards/demo").glob("*.json")):
        source = json.loads(path.read_text())
        dashboard, notes = migrate(source, path.stem)
        (args.output / (dashboard["metadata"]["name"] + ".json")).write_text(json.dumps(dashboard, indent=2) + "\n")
        report["dashboards"].append({"source": path.name, "dashboard": dashboard["metadata"]["name"],
                                    "panels": len(dashboard["spec"]["panels"]), "notes": notes})
    (args.output.parent / "migration-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"Migrated {len(report['dashboards'])} dashboards and {sum(d['panels'] for d in report['dashboards'])} panels")

if __name__ == "__main__":
    main()
