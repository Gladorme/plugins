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

import { ValidationSchemas, ValidationSchemasContext } from '@perses-dev/plugin-system';
import { render, waitFor } from '@testing-library/react';

import {
  prometheusDatasourceSchema,
  prometheusLabelValuesVariableSchema,
  prometheusPromQLAnnotationSchema,
  usePrometheusDatasourceValidation,
  usePrometheusLabelValuesVariableValidation,
  usePrometheusPromQLAnnotationValidation,
} from './schema';

const validationContext = {
  setDatasourceEditorSchemaPlugin: vi.fn(),
  setVariableEditorSchemaPlugin: vi.fn(),
  setAnnotationEditorSchemaPlugin: vi.fn(),
} as unknown as ValidationSchemas;

function ValidationRegistration(): null {
  usePrometheusDatasourceValidation();
  usePrometheusLabelValuesVariableValidation();
  usePrometheusPromQLAnnotationValidation();
  return null;
}

describe('Prometheus validation', () => {
  it('rejects incomplete datasource and variable options', () => {
    expect(prometheusDatasourceSchema.safeParse({ kind: 'PrometheusDatasource', spec: {} }).success).toBe(false);
    expect(
      prometheusLabelValuesVariableSchema.safeParse({ kind: 'PrometheusLabelValuesVariable', spec: {} }).success,
    ).toBe(false);
  });

  it('registers datasource, variable, and annotation schemas with ValidationProvider context', async () => {
    vi.clearAllMocks();

    render(
      <ValidationSchemasContext.Provider value={validationContext}>
        <ValidationRegistration />
      </ValidationSchemasContext.Provider>,
    );

    await waitFor(() => {
      expect(validationContext.setDatasourceEditorSchemaPlugin).toHaveBeenCalledWith(prometheusDatasourceSchema);
      expect(validationContext.setVariableEditorSchemaPlugin).toHaveBeenCalledWith(prometheusLabelValuesVariableSchema);
      expect(validationContext.setAnnotationEditorSchemaPlugin).toHaveBeenCalledWith(prometheusPromQLAnnotationSchema);
    });
  });
});
