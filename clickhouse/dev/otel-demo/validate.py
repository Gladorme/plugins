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

"""Execute every migrated panel and variable query against a running ClickHouse."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

def render(sql, variables, start, end, step=30):
    sql = sql.replace("{start}", start).replace("{end}", end).replace("{step}", str(step))
    def replace(match):
        name = match.group(1)
        if name not in variables:
            raise ValueError("Missing variable " + name)
        values = variables[name]
        if not isinstance(values, list):
            values = [values]
        return ",".join("'" + str(v).replace("\\", "\\\\").replace("'", "''") + "'" for v in values)
    return re.sub(r"\$\{(\w+):sqlstring\}", replace, sql)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--step", type=int, default=30, help="Query step in seconds")
    parser.add_argument("--url", default="http://127.0.0.1:18123")
    parser.add_argument("--dashboards", type=Path, default=Path(__file__).parent / "dashboards")
    parser.add_argument("--output", type=Path, default=Path("validation-report.json"))
    args = parser.parse_args()
    end_time = datetime.now(timezone.utc)
    start, end = [(end_time - offset).strftime("%Y-%m-%d %H:%M:%S") for offset in [timedelta(minutes=15), timedelta()]]
    tasks = []
    for path in sorted(args.dashboards.glob("*.json")):
        dashboard = json.loads(path.read_text())
        variables = {v["spec"]["name"]: v["spec"].get("defaultValue", v["spec"].get("value", ".*"))
                     for v in dashboard["spec"].get("variables", [])}
        for variable in dashboard["spec"].get("variables", []):
            spec = variable["spec"]
            if "plugin" in spec:
                tasks.append((path.stem, "variable:" + spec["name"], spec["plugin"]["spec"]["query"], variables))
        for key, panel in dashboard["spec"]["panels"].items():
            for index, query in enumerate(panel["spec"].get("queries", [])):
                tasks.append((path.stem, key + ":" + str(index), query["spec"]["plugin"]["spec"]["query"], variables))
        for index, annotation in enumerate(dashboard["spec"].get("annotations", [])):
            tasks.append((path.stem, "annotation:" + str(index), annotation["plugin"]["spec"]["query"], variables))
    def execute(task):
        dashboard, query, sql, variables = task
        result = {"dashboard": dashboard, "query": query}
        try:
            sql = render(sql, variables, start, end, args.step)
            url = args.url + "/?" + urlencode({"query": sql + " FORMAT JSON", "output_format_json_quote_64bit_integers": "1", "max_execution_time": "30"})
            with urlopen(url, timeout=35) as response:
                data = json.load(response)
            result.update({"rows": data["rows"], "seconds": data.get("statistics", {}).get("elapsed", 0)})
            if dashboard == "signal-validation" and data["rows"] == 0:
                result["error"] = "Native signal validation query returned no live telemetry"
        except HTTPError as error:
            result["error"] = error.read().decode()
        except Exception as error:
            result["error"] = str(error)
        return result
    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(execute, tasks))
    report = {"start": start, "end": end, "queries": results}
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    errors = [r for r in results if "error" in r]
    empty = [r for r in results if r.get("rows") == 0]
    print(f"{len(results)} queries: {len(errors)} errors, {len(empty)} empty, {len(results)-len(errors)-len(empty)} with data")
    for result in errors:
        print(result["dashboard"], result["query"], result["error"][:500])
    raise SystemExit(bool(errors))

if __name__ == "__main__":
    main()
