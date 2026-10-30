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

"""Provision demo dashboards into an existing Perses development instance."""
import argparse
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

MODULES = {
    "clickhouse": "ClickHouse", "timeserieschart": "TimeSeriesChart", "logstable": "LogsTable",
    "tracetable": "TraceTable", "tracingganttchart": "TracingGanttChart", "histogramchart": "HistogramChart",
    "heatmapchart": "HeatMapChart", "flamechart": "FlameChart", "statchart": "StatChart",
    "gaugechart": "GaugeChart", "barchart": "BarChart", "timeseriestable": "TimeSeriesTable",
    "markdown": "Markdown",
}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8080")
    parser.add_argument("--plugins-url", default="http://127.0.0.1:18081")
    parser.add_argument("--plugins", type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument("--dashboards", type=Path, default=Path(__file__).parent / "dashboards")
    args = parser.parse_args()
    def send(path, data, method="POST"):
        request = Request(args.url + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"}, method=method)
        try:
            with urlopen(request, timeout=60) as response:
                return response.read()
        except HTTPError as error:
            body = error.read().decode()
            if error.code == 409 and method == "POST" and data.get("metadata", {}).get("name"):
                return send(path + "/" + data["metadata"]["name"], data, "PUT")
            raise RuntimeError(f"{path}: HTTP {error.code}: {body}") from error
    modules = [{"name": name, "version": json.loads((args.plugins / directory / "package.json").read_text())["version"],
                "url": args.plugins_url + "/" + name, "absolute_path": str((args.plugins / directory).resolve())}
               for directory, name in MODULES.items()]
    send("/api/v1/plugins/dev", modules)
    send("/api/v1/projects", {"kind": "Project", "metadata": {"name": "otel-demo"}, "spec": {"display": {"name": "OpenTelemetry demo"}}})
    for path in sorted(args.dashboards.glob("*.json")):
        send("/api/v1/projects/otel-demo/dashboards", json.loads(path.read_text()))
        print("Provisioned", path.stem, flush=True)

if __name__ == "__main__":
    main()
