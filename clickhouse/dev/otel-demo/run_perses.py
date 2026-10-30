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

"""Start or stop the local Perses API, shared-development UI and plugin server."""
import argparse
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["start", "stop"])
    parser.add_argument("--runtime", type=Path, required=True)
    parser.add_argument("--perses", type=Path)
    parser.add_argument("--shared", type=Path)
    parser.add_argument("--binary", type=Path)
    parser.add_argument("--host", default="127.0.0.1", help="UI bind address; use the local Tailscale IP for private remote access")
    args = parser.parse_args()
    runtime = args.runtime.resolve()
    runtime.mkdir(parents=True, exist_ok=True)
    pidfile = runtime / "perses-processes.json"
    if args.action == "stop":
        if pidfile.exists():
            for pid in json.loads(pidfile.read_text()).values():
                try:
                    os.killpg(pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            pidfile.unlink()
        return
    if not all([args.perses, args.shared, args.binary]):
        parser.error("start requires --perses, --shared and --binary")
    if pidfile.exists():
        parser.error("Process state already exists; stop this runtime first")
    for host, port in [("127.0.0.1", 8080), ("127.0.0.1", 18081), (args.host, 18080)]:
        with socket.socket() as connection:
            if connection.connect_ex((host, port)) == 0:
                parser.error(f"{host}:{port} is already in use; stop that demo process first")
    config = {"security": {"enable_auth": False}, "database": {"file": {"folder": str(runtime / "db"), "extension": "json"}},
              "plugin": {"enable_dev": True, "path": str(runtime / "plugins"), "archive_paths": [str(runtime / "archives")]},
              "datasource": {"proxy": {"allowed_networks": ["127.0.0.1/32", "::1/128"]}},
              "frontend": {"explorer": {"enable": True}}}
    config_path = runtime / "perses.yaml"
    config_path.write_text(json.dumps(config, indent=2) + "\n")
    processes = {}
    def start(name, command, cwd, env=None):
        with (runtime / (name + ".log")).open("ab") as log:
            process = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                       stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        processes[name] = process.pid
        pidfile.write_text(json.dumps(processes, indent=2) + "\n")
    start("perses-api", [str(args.binary.resolve()), "--config=" + str(config_path), "--web.listen-address=127.0.0.1:8080"], runtime)
    start("plugin-server", [sys.executable, str(ROOT / "serve_plugins.py")], runtime)
    start("perses-ui", ["npm", "run", "start:shared", "-w", "app", "--", "--host", args.host], args.perses.resolve() / "ui",
          {**os.environ, "PORT": "18080", "SHARED_PACKAGES_PATH": str(args.shared.resolve())})
    for attempt in range(60):
        try:
            with urlopen("http://127.0.0.1:8080/api/v1/projects", timeout=1) as response:
                if response.status == 200:
                    break
        except OSError:
            time.sleep(1)
    else:
        raise RuntimeError("Perses did not start; inspect " + str(runtime / "perses-api.log"))
    subprocess.run([sys.executable, str(ROOT / "provision.py")], check=True)
    print("Perses UI: http://" + args.host + ":18080/projects/otel-demo/dashboards/signal-validation")
    print("Logs and process IDs:", runtime)


if __name__ == "__main__":
    main()
