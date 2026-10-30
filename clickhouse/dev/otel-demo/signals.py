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

"""Generate an additional dashboard exercising native Collector tables."""
import json
from pathlib import Path
from migrate import START, END, LOG_RANGE, METRIC_RANGE, datasource, query, var


def dashboard():
    service = "ServiceName = " + var("service")
    metric = "MetricName = " + var("metric")
    histogram = "MetricName = 'demo.cart.get_cart.latency' AND " + METRIC_RANGE
    explicit = ("SELECT TimeUnix, MetricName, MetricUnit, Count, Sum, ExplicitBounds, BucketCounts, Flags "
                "FROM otel_metrics_histogram WHERE " + histogram + " ORDER BY TimeUnix LIMIT 10000")
    trace = ("SELECT * FROM otel_traces WHERE TraceId IN (SELECT TraceId FROM otel_traces WHERE "
             + service + " AND " + LOG_RANGE + " GROUP BY TraceId ORDER BY max(Timestamp) DESC LIMIT ")
    panels = {}
    def panel(key, title, kind, sql, signal="TimeSeriesQuery", options=None, description=None, **query_options):
        spec = {"display": {"name": title}, "plugin": {"kind": kind, "spec": options or {}},
                "queries": [query(sql, signal, **query_options)]}
        if description:
            spec["display"]["description"] = description
        panels[key] = {"kind": "Panel", "spec": spec}
    panel("metrics", "Native OTel metrics", "TimeSeriesChart",
          "SELECT * FROM otel_metrics_sum WHERE " + service + " AND " + metric + " AND " + METRIC_RANGE + " ORDER BY TimeUnix LIMIT 10000",
          description="Select a service and its dependent metric variable. Raw cumulative counters and up/down sums retain their OTel labels.")
    panel("logs", "Live application logs", "LogsTable",
          "SELECT Timestamp, if(Body = '', EventName, Body) AS Body, SeverityText, ServiceName, TraceId, SpanId, ResourceAttributes, LogAttributes "
          "FROM otel_logs WHERE " + service + " AND " + LOG_RANGE + " ORDER BY Timestamp DESC LIMIT 100",
          "LogQuery", {"showTime": True, "allowWrap": True, "enableDetails": True})
    panel("search", "Live trace search", "TraceTable", trace + "10) ORDER BY Timestamp", "TraceQuery")
    panel("trace", "Latest trace detail", "TracingGanttChart", trace + "1) ORDER BY Timestamp", "TraceQuery", mode="trace")
    panel("histogram", "Native explicit histogram", "HistogramChart", explicit,
          description="Cart get latency. Native cumulative OTel bucket counts, not a rate.")
    panel("heatmap", "Native histogram over time", "HeatMapChart", explicit, options={"yAxisFormat": {"unit": "seconds"}, "min": 0},
          description="Cart get latency. Native cumulative observations at their original collection timestamps.")
    panel("exemplars", "Mean cart latency and trace exemplars", "TimeSeriesChart",
          "SELECT TimeUnix, MetricName, MetricUnit, Sum / nullIf(Count, 0) AS Value, "
          "`Exemplars.Value`, `Exemplars.TimeUnix`, `Exemplars.TraceId`, `Exemplars.SpanId`, `Exemplars.FilteredAttributes` "
          "FROM otel_metrics_histogram WHERE " + histogram + " ORDER BY TimeUnix LIMIT 10000",
          options={"yAxis": {"format": {"unit": "seconds"}}},
          description="Mean of cumulative observations; exemplar points retain their measured duration and trace/span IDs.")
    panel("exponential", "Native exponential histogram", "HistogramChart",
          "SELECT TimeUnix, MetricName, MetricUnit, Count, Sum, Scale, ZeroCount, PositiveOffset, PositiveBucketCounts, NegativeOffset, NegativeBucketCounts, Flags "
          "FROM otel_metrics_exponential_histogram WHERE ServiceName = 'load-generator' AND MetricName = 'http.client.duration' AND " + METRIC_RANGE +
          " AND Attributes = (SELECT Attributes FROM otel_metrics_exponential_histogram WHERE ServiceName = 'load-generator' AND MetricName = 'http.client.duration' AND " + METRIC_RANGE +
          " GROUP BY Attributes ORDER BY count() DESC LIMIT 1) ORDER BY TimeUnix LIMIT 10000",
          description="Real load-generator HTTP timings exported with the SDK's base-2 exponential histogram aggregation.")
    panel("profiles", "Live eBPF profiles", "FlameChart",
          "SELECT Timestamp, SampleType, SampleUnit, FunctionNames, FileNames, LineNumbers, MappingFileNames, Addresses, Values, TimestampsUnixNano "
          "FROM otel_profiles WHERE " + service + " AND SampleType = 'samples' AND SampleUnit = 'count' "
          f"AND Timestamp <= {END} AND Timestamp + toIntervalNanosecond(DurationNano) >= {START} "
          "ORDER BY Timestamp LIMIT 20000", "ProfileQuery",
          {"palette": "package-name", "showSettings": True, "showSeries": True, "showTable": True, "showFlameGraph": True},
          description="Live Docker Linux VM eBPF samples, filtered by service and time; counts are not nanoseconds.")
    variables = [
        {"kind": "ListVariable", "spec": {"name": "service", "defaultValue": "checkout", "allowMultiple": False,
         "plugin": {"kind": "ClickHouseVariable", "spec": {"query": "SELECT DISTINCT ServiceName AS value FROM otel_traces WHERE " + LOG_RANGE + " AND ServiceName != '' ORDER BY value"}}}},
        {"kind": "ListVariable", "spec": {"name": "metric", "defaultValue": "go.memory.used", "allowMultiple": False,
         "plugin": {"kind": "ClickHouseVariable", "spec": {"query": "SELECT DISTINCT MetricName AS value FROM otel_metrics_sum WHERE " + service + " AND " + METRIC_RANGE + " ORDER BY value"}}}},
    ]
    items = [{"x": (i % 2) * 12, "y": (i // 2) * 9, "width": 12, "height": 9,
              "content": {"$ref": "#/spec/panels/" + key}} for i, key in enumerate(panels) if key != "profiles"]
    items.append({"x": 0, "y": 36, "width": 24, "height": 20, "content": {"$ref": "#/spec/panels/profiles"}})
    return {"kind": "Dashboard", "metadata": {"name": "signal-validation", "project": "otel-demo"}, "spec": {
        "display": {"name": "ClickHouse • All signals", "description": "Live standard OTel tables: metrics, logs, traces, profiles, histograms, exemplars, SQL annotations and dependent variables."},
        "duration": "15m", "refreshInterval": "30s", "datasources": {"clickhouse": datasource()},
        "variables": variables, "panels": panels, "layouts": [{"kind": "Grid", "spec": {"items": items}}],
        "annotations": [{"display": {"name": "Application log activity"}, "plugin": {"kind": "ClickHouseAnnotationQuery", "spec": {"query":
            "SELECT toStartOfInterval(Timestamp, INTERVAL 1 MINUTE) AS start, concat(toString(count()), ' application logs') AS title, ServiceName AS legend "
            "FROM otel_logs WHERE " + service + " AND " + LOG_RANGE + " GROUP BY start, ServiceName ORDER BY start LIMIT 100"}}}]
    }}


if __name__ == "__main__":
    path = Path(__file__).parent / "dashboards/signal-validation.json"
    path.write_text(json.dumps(dashboard(), indent=2) + "\n")
    print("Generated", path.name)
