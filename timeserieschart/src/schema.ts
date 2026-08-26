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
const lineStyleSchema = z.enum(['solid', 'dashed', 'dotted']);

export const timeSeriesChartSchema = z.object({
  kind: z.literal('TimeSeriesChart'),
  spec: z
    .object({
      legend: z
        .object({
          position: z.enum(['bottom', 'right']),
          mode: z.enum(['list', 'table']).optional(),
          size: z.enum(['small', 'medium']).optional(),
          values: z
            .array(z.enum(['first', 'last', 'first-number', 'last-number', 'mean', 'sum', 'min', 'max']))
            .optional(),
        })
        .strict()
        .optional(),
      tooltip: z.object({ enablePinning: z.boolean().optional() }).strict().optional(),
      yAxis: z
        .object({
          show: z.boolean().optional(),
          label: z.string().optional(),
          format: formatSchema.optional(),
          min: z.number().optional(),
          max: z.number().optional(),
          logBase: z.union([z.literal(2), z.literal(10)]).optional(),
        })
        .strict()
        .refine(({ min, max }) => min === undefined || max === undefined || max >= min, {
          message: 'Maximum must be greater than or equal to minimum',
          path: ['max'],
        })
        .optional(),
      thresholds: thresholdsSchema.optional(),
      visual: z
        .object({
          display: z.enum(['line', 'bar']).optional(),
          lineWidth: z.number().min(0.25).max(3).optional(),
          lineStyle: lineStyleSchema.optional(),
          areaOpacity: z.number().min(0).max(1).optional(),
          showPoints: z.enum(['auto', 'always']).optional(),
          palette: z
            .object({ mode: z.enum(['auto', 'categorical']) })
            .strict()
            .optional(),
          pointRadius: z.number().min(0).max(6).optional(),
          stack: z.enum(['all', 'percent']).optional(),
          connectNulls: z.boolean().optional(),
        })
        .strict()
        .optional(),
      querySettings: z
        .array(
          z
            .object({
              queryIndex: z.number().int().nonnegative(),
              colorMode: z.enum(['fixed', 'fixed-single']).optional(),
              colorValue: colorSchema.optional(),
              lineStyle: lineStyleSchema.optional(),
              areaOpacity: z.number().min(0).max(1).optional(),
              format: formatSchema.optional(),
              negativeY: z.boolean().optional(),
              stack: z.boolean().optional(),
            })
            .strict(),
        )
        .optional(),
    })
    .strict(),
}) as unknown as PluginSchema;

export function useTimeSeriesChartValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(timeSeriesChartSchema), []);
}
