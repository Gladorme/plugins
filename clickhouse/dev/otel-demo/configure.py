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

"""Resolve the pinned official demo into an isolated, ClickHouse-only Compose project."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import shutil
import subprocess
from migrate import DEMO_REVISION

ROOT = Path(__file__).resolve().parent
PROJECT = "perses-otel-demo"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", type=Path, required=True)
    parser.add_argument("--runtime", type=Path, required=True)
    parser.add_argument("--tailscale-ip", help="Optional local Tailscale IPv4 address for the shop listener")
    args = parser.parse_args()
    if args.tailscale_ip and ipaddress.ip_address(args.tailscale_ip) not in ipaddress.ip_network("100.64.0.0/10"):
        parser.error("--tailscale-ip must be the local node's Tailscale IPv4 address")
    demo, runtime = args.demo.resolve(), args.runtime.resolve()
    revision = subprocess.check_output(["git", "-C", str(demo), "rev-parse", "HEAD"], text=True).strip()
    if revision != DEMO_REVISION:
        parser.error("Expected OTel demo revision " + DEMO_REVISION + "; got " + revision)
    runtime.mkdir(parents=True, exist_ok=True)
    for name in ["collector-clickhouse.yaml", "clickhouse-config.xml", "clickhouse-users.xml", "init.sql"]:
        shutil.copyfile(ROOT / name, runtime / name)
    overlay = {"services": {
        "clickhouse": {
            "image": "clickhouse/clickhouse-server:26.9.19.9", "restart": "unless-stopped",
            "environment": {"CLICKHOUSE_SKIP_USER_SETUP": "1"}, "mem_limit": "2g",
            "volumes": ["clickhouse-data:/var/lib/clickhouse"] + [str(runtime / source) + ":" + target + ":ro" for source, target in [
                ("clickhouse-config.xml", "/etc/clickhouse-server/config.d/demo.xml"),
                ("clickhouse-users.xml", "/etc/clickhouse-server/users.d/demo.xml"),
                ("init.sql", "/docker-entrypoint-initdb.d/demo.sql")]],
            "healthcheck": {"test": ["CMD", "clickhouse-client", "--query", "SELECT 1"], "interval": "5s", "timeout": "3s", "retries": 30}},
        "otel-collector": {
            "deploy": {"resources": {"limits": {"memory": "700M"}}},
            "environment": {"GOMEMLIMIT": "560MiB"},
            "depends_on": {"clickhouse": {"condition": "service_healthy"}},
            "volumes": [str(runtime / "collector-clickhouse.yaml") + ":/etc/otelcol-config-extras.yml:ro"]},
    }, "volumes": {"clickhouse-data": {}}}
    overlay_path = runtime / "compose-clickhouse.json"
    overlay_path.write_text(json.dumps(overlay, indent=2) + "\n")
    environment = {**os.environ, "ENVOY_PORT": "18090", "PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": "/otlp-http/v1/traces",
                   "LOCUST_USERS": "3", "USE_VCR": "True", "API_KEY": "", "LLM_BASE_URL": "https://local-llm.com"}
    command = ["docker", "compose", "-p", PROJECT]
    for path in [demo / "compose.yaml", demo / "compose.full.yaml", demo / "compose.profiling.yaml", demo / "compose.agent.yaml", overlay_path]:
        command += ["-f", str(path)]
    command += ["config", "--no-consistency", "--format", "json"]
    config = json.loads(subprocess.check_output(command, cwd=demo, env=environment))
    config["services"].pop("firepit", None)
    images = json.loads((ROOT / "images.json").read_text())
    for name, service in config["services"].items():
        service.pop("build", None)
        service.pop("ports", None)
        service.pop("profiles", None)
        service.get("deploy", {}).pop("placement", None)
        service["container_name"] = "perses-otel-" + name
        service["image"] = images[name]
        service.get("depends_on", {}).pop("opamp-server", None)
        service.get("environment", {}).pop("OPAMP_SERVER_ENDPOINT", None)
        if name == "otel-collector":
            service["volumes"] = [v for v in service["volumes"] if v["target"] != "/hostfs"]
    config["services"]["clickhouse"]["ports"] = [{"target": 8123, "published": "18123", "host_ip": "127.0.0.1"}]
    addresses = ["127.0.0.1"] + ([args.tailscale_ip] if args.tailscale_ip else [])
    config["services"]["frontend-proxy"]["ports"] = [{"target": 18090, "published": "18090", "host_ip": ip} for ip in addresses]
    config["services"]["load-generator"]["environment"].update({
        "OTEL_EXPORTER_OTLP_METRICS_DEFAULT_HISTOGRAM_AGGREGATION": "base2_exponential_bucket_histogram",
        "OTEL_METRIC_EXPORT_INTERVAL": "10000"})
    config["networks"]["default"]["name"] = PROJECT
    for name, volume in config.get("volumes", {}).items():
        volume["name"] = PROJECT + "_" + name
    target = runtime / "compose-resolved.json"
    target.write_text(json.dumps(config, indent=2) + "\n")
    subprocess.run(["docker", "compose", "-p", PROJECT, "-f", str(target), "config", "--quiet"], check=True)
    print("Generated", target)
    print("Start: docker compose -p", PROJECT, "-f", str(target), "up -d")


if __name__ == "__main__":
    main()
