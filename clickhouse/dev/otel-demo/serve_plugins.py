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

"""Serve built modules for a local Perses development instance."""
import http.server
import pathlib
from urllib.parse import unquote, urlsplit

from provision import MODULES as DIRECTORIES

ROOT = pathlib.Path(__file__).resolve().parents[3]

MODULES = {name: directory for directory, name in DIRECTORIES.items()}

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        parts = pathlib.PurePosixPath(unquote(urlsplit(path).path)).parts[1:]
        if len(parts) > 3 and parts[1:3] == ("plugins", parts[0]):
            parts = (parts[0], *parts[3:])
        if not parts or parts[0] not in MODULES or ".." in parts:
            return str(ROOT / "__not_found__")
        root = ROOT / MODULES[parts[0]]
        return str(root.joinpath(*(parts[1:] if parts[1:] == ("package.json",) else ("dist", *parts[1:]))))
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

http.server.ThreadingHTTPServer(("127.0.0.1", 18081), Handler).serve_forever()
