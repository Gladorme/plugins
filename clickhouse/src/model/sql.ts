// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** Quote a column name, including literal dots, without interpreting it as SQL. */
export function quoteIdentifier(identifier: string): string {
  if (!identifier.trim()) throw new Error('ClickHouse identifiers must not be empty');
  return '"' + identifier.replaceAll('\\', '\\\\').replaceAll('"', '""') + '"';
}

/** Table references may include a database qualifier. */
export function quoteTable(identifier: string): string {
  return identifier.split('.').map(quoteIdentifier).join('.');
}
