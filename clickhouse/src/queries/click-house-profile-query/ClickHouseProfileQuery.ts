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

import { PROFILE_EXAMPLE } from '../../components/query-examples';
import { queryDependencies } from '../../model/query';
import { ClickHouseProfileQueryEditor } from './ClickHouseProfileQueryEditor';
import { getProfileData } from './get-profile-data';
import type { ClickHouseProfileQuerySpec } from './types';

// The optional dependency hook also works with hosts predating profile variable support.
export const ClickHouseProfileQuery: ProfileQueryPlugin<ClickHouseProfileQuerySpec> & {
  dependsOn: typeof queryDependencies;
} = {
  getProfileData,
  dependsOn: queryDependencies,
  OptionsEditorComponent: ClickHouseProfileQueryEditor,
  createInitialOptions: () => ({ query: PROFILE_EXAMPLE }),
};
