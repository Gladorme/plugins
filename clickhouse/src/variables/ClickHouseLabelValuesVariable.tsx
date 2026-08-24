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

import { isVariableDatasource, parseVariables, replaceVariables, VariablePlugin } from '@perses-dev/plugin-system';

import { ClickHouseLabelValuesVariableEditor } from './ClickHouseVariableEditor';
import { ClickHouseLabelValuesVariableOptions } from './types';
import { executeVariableQuery, queryDataToLabelValues } from './utils';

export const ClickHouseLabelValuesVariable: VariablePlugin<ClickHouseLabelValuesVariableOptions> = {
  getVariableOptions: async (spec, context) => ({
    data: queryDataToLabelValues(
      await executeVariableQuery(spec, context),
      replaceVariables(spec.labelName, context.variables),
    ),
  }),
  dependsOn: (spec) => ({
    variables: [
      ...new Set([
        ...parseVariables(spec.query),
        ...parseVariables(spec.labelName),
        ...(spec.datasource && isVariableDatasource(spec.datasource) ? parseVariables(spec.datasource) : []),
      ]),
    ],
  }),
  OptionsEditorComponent: ClickHouseLabelValuesVariableEditor,
  createInitialOptions: () => ({ query: '', labelName: '' }),
};
