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

const httpDatasourceSpecSchema = z
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
  });

export const alertManagerDatasourceSchema = z.object({
  kind: z.literal('AlertManagerDatasource'),
  spec: httpDatasourceSpecSchema,
}) as unknown as PluginSchema;

export const alertTableSchema = z.object({
  kind: z.literal('AlertTable'),
  spec: z
    .object({
      defaultGroupBy: z.array(z.string()).optional(),
      columns: z
        .array(
          z
            .object({
              name: z.string(),
              header: z.string().optional(),
              enableSorting: z.boolean().optional(),
              sort: z.enum(['asc', 'desc']).optional(),
              sortMode: z.enum(['alphabetical', 'numeric', 'severity']).optional(),
            })
            .strict(),
        )
        .optional(),
      deduplication: z
        .object({ mode: z.enum(['none', 'fingerprint', 'labels']), labels: z.array(z.string()).optional() })
        .strict()
        .optional(),
      allowedActions: z.array(z.enum(['silence', 'runbook'])).optional(),
      runbookAnnotationKey: z.string().optional(),
      labelColorMappings: z
        .array(
          z
            .object({
              labelKey: z.string(),
              mode: z.enum(['auto', 'severity', 'manual']),
              overrides: z
                .array(z.object({ value: z.string(), isRegex: z.boolean(), color: z.string() }).strict())
                .optional(),
            })
            .strict(),
        )
        .optional(),
    })
    .strict(),
}) as unknown as PluginSchema;

export const silenceTableSchema = z.object({
  kind: z.literal('SilenceTable'),
  spec: z
    .object({
      columns: z
        .array(
          z
            .object({
              name: z.string(),
              header: z.string().optional(),
              enableSorting: z.boolean().optional(),
              sort: z.enum(['asc', 'desc']).optional(),
              sortMode: z.enum(['alphabetical', 'date', 'status']).optional(),
            })
            .strict(),
        )
        .optional(),
      allowedActions: z.array(z.literal('expire')).optional(),
    })
    .strict(),
}) as unknown as PluginSchema;

export function useAlertManagerDatasourceValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setDatasourceEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(alertManagerDatasourceSchema), []);
}

export function useAlertTableValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(alertTableSchema), []);
}

export function useSilenceTableValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setPanelEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(silenceTableSchema), []);
}
