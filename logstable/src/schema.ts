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

const baseActionSchema = z.object({
  name: z.string(),
  icon: z.string().optional(),
  confirmMessage: z.string().optional(),
  enabled: z.boolean().optional(),
  batchMode: z.enum(['batch', 'individual']),
  bodyTemplate: z.string().optional(),
});
const actionSchema = z.discriminatedUnion('type', [
  baseActionSchema.extend({ type: z.literal('event'), eventName: z.string() }).strict(),
  baseActionSchema
    .extend({
      type: z.literal('webhook'),
      url: z.string(),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      contentType: z.enum(['none', 'json', 'text']),
      headers: z.record(z.string()).optional(),
    })
    .strict(),
]);

export const logsTableSchema = z.object({
  kind: z.literal('LogsTable'),
  spec: z
    .object({
      allowWrap: z.boolean().optional(),
      enableDetails: z.boolean().optional(),
      showTime: z.boolean().optional(),
      selection: z.object({ enabled: z.boolean().optional() }).strict().optional(),
      actions: z
        .object({
          enabled: z.boolean().optional(),
          actionsList: z.array(actionSchema).optional(),
          displayInHeader: z.boolean().optional(),
          displayWithItem: z.boolean().optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
}) as unknown as PluginSchema;

export function useLogsTableValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(logsTableSchema), []);
}
