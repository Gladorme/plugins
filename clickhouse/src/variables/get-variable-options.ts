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

import type { VariablePlugin, VariableOption } from '@perses-dev/plugin-system';

import { executeQuery } from '../model/query';
import type { ClickHouseVariableSpec } from './types';

function optionString(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    throw new Error('ClickHouse variable columns must contain strings, numbers or booleans');
  }
  return String(value);
}

export const getVariableOptions: VariablePlugin<ClickHouseVariableSpec>['getVariableOptions'] = async (
  spec,
  context,
  signal,
) => {
  if (!spec.query.trim()) return { data: [] };
  const { rows } = await executeQuery(spec, { ...context, variableState: context.variables }, signal);
  const options = new Map<string, VariableOption>();
  for (const row of rows) {
    const valueColumn = spec.valueColumn ?? (Object.hasOwn(row, 'value') ? 'value' : Object.keys(row)[0]);
    if (!valueColumn || !Object.hasOwn(row, valueColumn)) {
      throw new Error('ClickHouse variable value column is missing from the query result');
    }
    if (spec.labelColumn && !Object.hasOwn(row, spec.labelColumn)) {
      throw new Error('ClickHouse variable label column is missing from the query result');
    }
    const raw = row[valueColumn];
    if (raw === null || raw === undefined) continue;
    const value = optionString(raw);
    const rawLabel = row[spec.labelColumn ?? 'label'];
    const label = rawLabel === null || rawLabel === undefined ? value : optionString(rawLabel);
    if (!options.has(value)) options.set(value, { value, label });
  }
  return { data: [...options.values()] };
};
