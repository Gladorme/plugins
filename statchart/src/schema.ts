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
const thresholdsSchema = z
  .object({
    mode: z.enum(['percent', 'absolute']).optional(),
    defaultColor: z.string().optional(),
    steps: z
      .array(z.object({ value: z.number(), color: z.string().optional(), name: z.string().optional() }))
      .optional(),
  })
  .strict();
const mappingResultSchema = z
  .object({ value: z.union([z.string(), z.number()]), color: colorSchema.optional() })
  .strict();
const mappingSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('Value'),
    spec: z.object({ value: z.union([z.string().min(1), z.number()]), result: mappingResultSchema }).strict(),
  }),
  z.object({
    kind: z.literal('Range'),
    spec: z.object({ from: z.number().optional(), to: z.number().optional(), result: mappingResultSchema }).strict(),
  }),
  z.object({
    kind: z.literal('Regex'),
    spec: z.object({ pattern: z.string().min(1, 'Required'), result: mappingResultSchema }).strict(),
  }),
  z.object({
    kind: z.literal('Misc'),
    spec: z.object({ value: z.enum(['empty', 'null', 'NaN', 'true', 'false']), result: mappingResultSchema }).strict(),
  }),
]);

export const statChartSchema = z.object({
  kind: z.literal('StatChart'),
  spec: z
    .object({
      calculation: z.enum(['first', 'last', 'first-number', 'last-number', 'mean', 'sum', 'min', 'max']),
      metricLabel: z.string().optional(),
      format: formatSchema.optional(),
      thresholds: thresholdsSchema.optional(),
      sparkline: z.object({ color: z.string().optional(), width: z.number().optional() }).strict().optional(),
      valueFontSize: z.number().optional(),
      colorMode: z.enum(['value', 'background_solid', 'none']).optional(),
      legendMode: z.enum(['auto', 'on', 'off']).optional(),
      mappings: z.array(mappingSchema).optional(),
    })
    .strict(),
}) as unknown as PluginSchema;

export function useStatChartValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(statChartSchema), []);
}
