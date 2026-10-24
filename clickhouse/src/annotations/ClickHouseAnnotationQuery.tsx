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

import type { AnnotationPlugin, OptionsEditorProps } from '@perses-dev/plugin-system';
import type { ReactElement } from 'react';

import { ClickHouseQueryEditor } from '../components/ClickHouseQueryEditor';
import { ANNOTATION_EXAMPLE } from '../components/query-examples';
import { queryDependencies } from '../model/query';
import { getAnnotationData } from './get-annotation-data';
import type { ClickHouseAnnotationQuerySpec } from './types';

function AnnotationEditor(props: OptionsEditorProps<ClickHouseAnnotationQuerySpec>): ReactElement {
  return <ClickHouseQueryEditor {...props} examples={ANNOTATION_EXAMPLE} />;
}

export const ClickHouseAnnotationQuery: AnnotationPlugin<ClickHouseAnnotationQuerySpec> = {
  getAnnotationData,
  dependsOn: queryDependencies,
  OptionsEditorComponent: AnnotationEditor,
  createInitialOptions: () => ({ query: ANNOTATION_EXAMPLE }),
};
