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

export const splunkDatasourceSchema = z.object({
  kind: z.literal('SplunkDatasource'),
  spec: z
    .object({
      directUrl: z.string().optional(),
      proxy: z
        .object({
          kind: z.literal('HTTPProxy'),
          spec: z
            .object({
              url: z.string(),
              allowedEndpoints: z
                .array(z.object({ endpointPattern: z.string(), method: z.string() }).strict())
                .optional(),
              headers: z.record(z.string()).optional(),
              secret: z.string().optional(),
            })
            .strict(),
        })
        .strict()
        .optional(),
    })
    .strict()
    .refine(({ directUrl, proxy }) => Boolean(directUrl?.trim() || proxy?.spec.url.trim()), {
      message: 'A direct or proxy URL is required',
      path: ['directUrl'],
    }),
}) as unknown as PluginSchema;

export function useSplunkDatasourceValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setDatasourceEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(splunkDatasourceSchema), []);
}
