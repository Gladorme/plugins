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

const colorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, 'Must be a hexadecimal color');
const formatSchema = z
  .object({ unit: z.string().optional(), decimalPlaces: z.number().optional(), shortValues: z.boolean().optional() })
  .strict();
const pluginSchema = z.object({ kind: z.string().min(1, 'Required'), spec: z.record(z.unknown()) }).strict();
const conditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('Value'), spec: z.object({ value: z.string().min(1, 'Required') }).strict() }),
  z.object({
    kind: z.literal('Range'),
    spec: z
      .object({ min: z.number().optional(), max: z.number().optional() })
      .strict()
      .refine(({ min, max }) => min === undefined || max === undefined || max >= min, {
        message: 'Maximum must be greater than or equal to minimum',
        path: ['max'],
      }),
  }),
  z.object({ kind: z.literal('Regex'), spec: z.object({ expr: z.string().min(1, 'Required') }).strict() }),
  z.object({
    kind: z.literal('Misc'),
    spec: z.object({ value: z.enum(['empty', 'null', 'NaN', 'true', 'false']) }).strict(),
  }),
]);
const cellSettingsSchema = z
  .object({
    condition: conditionSchema,
    text: z.string().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    textColor: colorSchema.optional(),
    backgroundColor: colorSchema.optional(),
  })
  .strict();
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
const transformSchema = z.object({ kind: z.string().min(1, 'Required'), spec: z.record(z.unknown()) }).strict();

export const tableSchema = z.object({
  kind: z.literal('Table'),
  spec: z
    .object({
      density: z.enum(['compact', 'standard', 'comfortable']).optional(),
      defaultColumnWidth: z.union([z.literal('auto'), z.number()]).optional(),
      defaultColumnHeight: z.union([z.literal('auto'), z.number()]).optional(),
      defaultColumnHidden: z.boolean().optional(),
      pagination: z.boolean().optional(),
      enableFiltering: z.boolean().optional(),
      enableSorting: z.boolean().optional(),
      columnSettings: z
        .array(
          z
            .object({
              name: z.string().min(1, 'Required'),
              header: z.string().optional(),
              headerDescription: z.string().optional(),
              cellDescription: z.string().optional(),
              plugin: pluginSchema.optional(),
              format: formatSchema.optional(),
              align: z.enum(['left', 'center', 'right']).optional(),
              enableSorting: z.boolean().optional(),
              sort: z.enum(['asc', 'desc']).optional(),
              width: z.union([z.literal('auto'), z.number()]).optional(),
              hide: z.boolean().optional(),
              cellSettings: z.array(cellSettingsSchema).optional(),
              dataLink: z
                .object({ url: z.string(), title: z.string().optional(), openNewTab: z.boolean() })
                .strict()
                .optional(),
            })
            .strict(),
        )
        .optional(),
      cellSettings: z.array(cellSettingsSchema).optional(),
      transforms: z.array(transformSchema).optional(),
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

export function useTableValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(tableSchema), []);
}
