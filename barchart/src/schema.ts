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

export const barChartSchema = z.object({
  kind: z.literal('BarChart'),
  spec: z.object({
    calculation: z.enum(['first', 'last', 'first-number', 'last-number', 'mean', 'sum', 'min', 'max']),
    format: z.object({ unit: z.string().optional() }).passthrough().optional(),
    sort: z.enum(['asc', 'desc']).optional(),
    mode: z.enum(['value', 'percentage']).optional(),
    orientation: z.enum(['horizontal', 'vertical']).optional(),
    groupBy: z.array(z.string()).optional(),
    isStacked: z.boolean().optional(),
    visual: z
      .object({
        colorOverrides: z.array(z.object({ regex: z.string(), color: z.string() })).optional(),
      })
      .optional(),
  }),
}) as unknown as PluginSchema;

export function useBarChartValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);

  useEffect(() => {
    setSchema.current?.(barChartSchema);
  }, []);
}
