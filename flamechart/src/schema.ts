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

export const flameChartSchema = z.object({
  kind: z.literal('FlameChart'),
  spec: z
    .object({
      palette: z.enum(['package-name', 'value']),
      showSettings: z.boolean(),
      showSeries: z.boolean(),
      showTable: z.boolean(),
      showFlameGraph: z.boolean(),
      traceHeight: z.number().int().nonnegative().optional(),
    })
    .strict(),
}) as unknown as PluginSchema;

export function useFlameChartValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(flameChartSchema), []);
}
