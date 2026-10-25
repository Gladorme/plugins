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

import type { ProfileQueryPlugin } from '@perses-dev/plugin-system';
import { parseVariables } from '@perses-dev/plugin-system';

import type { PyroscopeProfileQuerySpec } from '../../model';
import { getProfileData } from './get-profile-data';
import { PyroscopeProfileQueryEditor } from './PyroscopeProfileQueryEditor';

export const PyroscopeProfileQuery: ProfileQueryPlugin<PyroscopeProfileQuerySpec> = {
  getProfileData,
  dependsOn: (spec) => ({
    variables: [
      ...new Set(
        [
          spec.profileType,
          spec.service ?? '',
          spec.datasource?.name ?? '',
          ...(spec.filters?.flatMap((filter) => [filter.labelName, filter.labelValue]) ?? []),
        ].flatMap(parseVariables),
      ),
    ],
  }),
  OptionsEditorComponent: PyroscopeProfileQueryEditor,
  createInitialOptions: () => ({
    maxNodes: 0,
    datasource: undefined,
    service: '',
    profileType: '',
    filters: [{ labelName: '', labelValue: '', operator: '=' }],
  }),
};
