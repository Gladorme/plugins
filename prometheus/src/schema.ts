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
import { durationValidationSchema, PluginSchema } from '@perses-dev/spec';
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
    scrapeInterval: durationValidationSchema.optional(),
    queryParams: z.record(z.union([z.string(), z.array(z.string())])).optional(),
  })
  .strict()
  .refine(({ directUrl, proxy }) => Boolean(directUrl?.trim() || proxy?.spec.url.trim()), {
    message: 'A direct or proxy URL is required',
    path: ['directUrl'],
  });
const datasourceSelectorSchema = z.union([
  z.string(),
  z.object({ kind: z.literal('PrometheusDatasource'), name: z.string().optional() }).strict(),
]);

export const prometheusDatasourceSchema = z.object({
  kind: z.literal('PrometheusDatasource'),
  spec: httpDatasourceSpecSchema,
}) as unknown as PluginSchema;
export const prometheusLabelNamesVariableSchema = z.object({
  kind: z.literal('PrometheusLabelNamesVariable'),
  spec: z
    .object({ datasource: datasourceSelectorSchema.optional(), matchers: z.array(z.string()).optional() })
    .strict(),
}) as unknown as PluginSchema;
export const prometheusLabelValuesVariableSchema = z.object({
  kind: z.literal('PrometheusLabelValuesVariable'),
  spec: z
    .object({
      datasource: datasourceSelectorSchema.optional(),
      labelName: z.string().min(1, 'Required'),
      matchers: z.array(z.string()).optional(),
    })
    .strict(),
}) as unknown as PluginSchema;
export const prometheusPromQLVariableSchema = z.object({
  kind: z.literal('PrometheusPromQLVariable'),
  spec: z
    .object({
      datasource: datasourceSelectorSchema.optional(),
      expr: z.string().min(1, 'Required'),
      labelName: z.string().min(1, 'Required'),
    })
    .strict(),
}) as unknown as PluginSchema;
export const prometheusPromQLAnnotationSchema = z.object({
  kind: z.literal('PrometheusPromQLAnnotation'),
  spec: z
    .object({
      datasource: datasourceSelectorSchema.optional(),
      expr: z.string().min(1, 'Required'),
      title: z.string().optional(),
      legend: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .strict(),
}) as unknown as PluginSchema;

export function usePrometheusDatasourceValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setDatasourceEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(prometheusDatasourceSchema), []);
}

function usePrometheusVariableValidation(schema: PluginSchema): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setVariableEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(schema), [schema]);
}

export function usePrometheusLabelNamesVariableValidation(): void {
  usePrometheusVariableValidation(prometheusLabelNamesVariableSchema);
}

export function usePrometheusLabelValuesVariableValidation(): void {
  usePrometheusVariableValidation(prometheusLabelValuesVariableSchema);
}

export function usePrometheusPromQLVariableValidation(): void {
  usePrometheusVariableValidation(prometheusPromQLVariableSchema);
}

export function usePrometheusPromQLAnnotationValidation(): void {
  const validationSchemas = useContext(ValidationSchemasContext);
  const setSchema = useRef(validationSchemas?.setAnnotationEditorSchemaPlugin);
  useEffect(() => setSchema.current?.(prometheusPromQLAnnotationSchema), []);
}
