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

import { ValidationSchemasContext } from '@perses-dev/plugin-system';
import { PluginSchema } from '@perses-dev/spec';
import { useContext, useEffect, useRef } from 'react';
import { z } from 'zod';

export const datasourceVariableSchema = z.object({
  kind: z.literal('DatasourceVariable'),
  spec: z.object({ datasourcePluginKind: z.string().min(1, 'Required') }).strict(),
}) as unknown as PluginSchema;

export function useDatasourceVariableValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setVariableEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(datasourceVariableSchema), []);
}
