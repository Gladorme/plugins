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
const thresholdsSchema = z
  .object({
    mode: z.enum(['percent', 'absolute']).optional(),
    defaultColor: z.string().optional(),
    steps: z
      .array(z.object({ value: z.number(), color: z.string().optional(), name: z.string().optional() }))
      .optional(),
  })
  .strict();

export const gaugeChartSchema = z.object({
  kind: z.literal('GaugeChart'),
  spec: z
    .object({
      calculation: z.enum(['first', 'last', 'first-number', 'last-number', 'mean', 'sum', 'min', 'max']),
      format: formatSchema.optional(),
      thresholds: thresholdsSchema.optional(),
      max: z.number().optional(),
      legend: z.object({ show: z.boolean().optional() }).strict().optional(),
    })
    .strict(),
}) as unknown as PluginSchema;

export function useGaugeChartValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(gaugeChartSchema), []);
}
