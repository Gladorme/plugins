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

import {
  useValidationSchemas,
  ValidationProvider,
  ValidationSchemas,
  ValidationSchemasContext,
} from '@perses-dev/plugin-system';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';

import { barChartSchema, useBarChartValidation } from './schema';

const setPanelEditorSchemaPlugin = vi.fn();
const validationContext = { setPanelEditorSchemaPlugin } as unknown as ValidationSchemas;

function ValidationRegistration(): null {
  useBarChartValidation();
  return null;
}

function FullFormValidation({ onValidation }: { onValidation: (isValid: boolean) => void }): null {
  useBarChartValidation();
  const { panelEditorSchema } = useValidationSchemas();

  useEffect(() => {
    onValidation(
      panelEditorSchema.safeParse({
        groupId: 0,
        panelDefinition: {
          kind: 'Panel',
          spec: { plugin: { kind: 'BarChart', spec: { calculation: 'last', orientation: 'diagonal' } } },
        },
      }).success,
    );
  }, [onValidation, panelEditorSchema]);
  return null;
}

describe('BarChart validation', () => {
  it('validates the complete plugin options', () => {
    expect(
      barChartSchema.safeParse({
        kind: 'BarChart',
        spec: { calculation: 'last', orientation: 'diagonal' },
      }).success,
    ).toBe(false);
  });

  it('registers the schema with ValidationProvider context', async () => {
    setPanelEditorSchemaPlugin.mockClear();

    render(
      <ValidationSchemasContext.Provider value={validationContext}>
        <ValidationRegistration />
      </ValidationSchemasContext.Provider>,
    );

    await waitFor(() => expect(setPanelEditorSchemaPlugin).toHaveBeenCalledWith(barChartSchema));
  });

  it('updates ValidationProvider full-form validation', async () => {
    const onValidation = vi.fn();

    render(
      <ValidationProvider>
        <FullFormValidation onValidation={onValidation} />
      </ValidationProvider>,
    );

    await waitFor(() => expect(onValidation).toHaveBeenCalledWith(false));
  });
});
