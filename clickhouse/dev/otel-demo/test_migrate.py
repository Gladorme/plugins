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

"""Regression tests for the nontrivial dashboard migration contracts."""
import json
from pathlib import Path
import unittest
from migrate import migrate, promql_sql, metric_query, native_logs
from validate import render


class MigrationTests(unittest.TestCase):
    def test_nested_variables_are_sql_quoted_and_promql_escaped(self):
        sql = metric_query('rate(requests_total{service=~"${service:regex}"}[$__rate_interval])', {"service"})
        result = render(sql, {"service": ["a'b", 'x"\\y']}, "2025-01-01", "2025-01-02", 2)
        self.assertIn("['a''b','x\"\\\\y']", result)
        self.assertIn("toJSONString", result)
        self.assertIn("regexpQuoteMeta", result)
        self.assertIn("greatest(240, 2 * 4)", result)
        self.assertNotIn("$", result)

    def test_regex_capture_replacement_is_not_a_dashboard_variable(self):
        expression = 'label_replace(requests_total, "new", "$1", "old", "(.*)")'
        self.assertIn('"$1"', promql_sql(expression, set()))

    def test_undefined_variables_fail_instead_of_becoming_empty_filters(self):
        with self.assertRaisesRegex(ValueError, "Unknown dashboard variable"):
            promql_sql('requests_total{service="$missing"}', set())

    def test_postgresql_aggregate_does_not_alias_timestamp_in_where(self):
        sql = native_logs("postgresql-dashboard", {"id": 17})
        self.assertIn("max(Timestamp) AS Timestamp", sql)
        self.assertIn("WHERE otel_logs.Timestamp BETWEEN", sql)
        self.assertIn("GROUP BY Body, database, role, query_id", sql)

    def test_collapsed_row_panels_are_retained(self):
        source = {"title": "Example", "panels": [{"id": 1, "type": "row", "panels": [
            {"id": 2, "type": "timeseries", "title": "Counter rate", "targets": [{"expr": "rate(requests_total[$__rate_interval])"}],
             "gridPos": {"x": 0, "y": 1, "w": 24, "h": 8}}]}]}
        migrated, _ = migrate(source, "example")
        self.assertEqual(set(migrated["spec"]["panels"]), {"panel-2"})
        self.assertEqual(migrated["spec"]["layouts"][0]["spec"]["items"][0]["width"], 24)

    def test_every_generated_query_uses_clickhouse_and_declared_variables(self):
        import re
        directory = Path(__file__).parent / "dashboards"
        report = json.loads((directory.parent / "migration-report.json").read_text())
        self.assertEqual(len(report["dashboards"]), 11)
        self.assertEqual(sum(d["panels"] for d in report["dashboards"]), 164)
        for path in directory.glob("*.json"):
            spec = json.loads(path.read_text())["spec"]
            names = {v["spec"]["name"] for v in spec.get("variables", [])}
            queries = [v["spec"]["plugin"] for v in spec.get("variables", []) if "plugin" in v["spec"]]
            queries += [q["spec"]["plugin"] for p in spec["panels"].values() for q in p["spec"].get("queries", [])]
            queries += [a["plugin"] for a in spec.get("annotations", [])]
            for query in queries:
                self.assertTrue(query["kind"].startswith("ClickHouse"), path.name)
                self.assertTrue(query["spec"]["query"].strip(), path.name)
                self.assertLessEqual(set(re.findall(r"\$\{(\w+):sqlstring\}", query["spec"]["query"])), names, path.name)


if __name__ == "__main__":
    unittest.main()
