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

const formatSchema = z
  .object({ unit: z.string().optional(), decimalPlaces: z.number().optional(), shortValues: z.boolean().optional() })
  .strict();

export const heatMapChartSchema = z.object({
  kind: z.literal('HeatMapChart'),
  spec: z
    .object({
      yAxisFormat: formatSchema.optional(),
      countFormat: formatSchema.optional(),
      showVisualMap: z.boolean().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      logBase: z.union([z.literal(2), z.literal(10)]).optional(),
    })
    .strict()
    .refine(({ min, max }) => min === undefined || max === undefined || max >= min, {
      message: 'Maximum must be greater than or equal to minimum',
      path: ['max'],
    }),
}) as unknown as PluginSchema;

export function useHeatMapChartValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(heatMapChartSchema), []);
}
