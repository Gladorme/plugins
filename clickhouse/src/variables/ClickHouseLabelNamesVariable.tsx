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

import { isVariableDatasource, parseVariables, VariablePlugin } from '@perses-dev/plugin-system';

import { ClickHouseLabelNamesVariableEditor } from './ClickHouseVariableEditor';
import { ClickHouseLabelNamesVariableOptions } from './types';
import { executeVariableQuery, queryDataToLabelNames } from './utils';

export const ClickHouseLabelNamesVariable: VariablePlugin<ClickHouseLabelNamesVariableOptions> = {
  getVariableOptions: async (spec, context) => ({
    data: queryDataToLabelNames(await executeVariableQuery(spec, context)),
  }),
  dependsOn: (spec) => ({
    variables: [
      ...new Set([
        ...parseVariables(spec.query),
        ...(spec.datasource && isVariableDatasource(spec.datasource) ? parseVariables(spec.datasource) : []),
      ]),
    ],
  }),
  OptionsEditorComponent: ClickHouseLabelNamesVariableEditor,
  createInitialOptions: () => ({ query: '' }),
};
