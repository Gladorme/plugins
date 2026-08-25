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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useMemo, useState } from 'react';

import { OTelAttributeFilter, OTelSignalCapability } from '../model';
import { AttributeFilters } from './AttributeFilters';

const SUGGESTION_CONTEXT = {
  client: {},
  datasource: { kind: 'TestDatasource' },
  end: new Date(2_000),
  start: new Date(1_000),
};
const GET_ATTRIBUTE_NAMES = vi.fn();
const GET_ATTRIBUTE_VALUES = vi.fn();
const SUGGESTION_CAPABILITY = {
  createQuery: vi.fn(),
  getAttributeNames: GET_ATTRIBUTE_NAMES,
  getAttributeValues: GET_ATTRIBUTE_VALUES,
};

function TestFilters(): JSX.Element {
  const [filters, setFilters] = useState<OTelAttributeFilter[]>([]);
  return <AttributeFilters value={filters} onChange={setFilters} />;
}

function SuggestedTestFilters({ capability }: { capability: OTelSignalCapability }): JSX.Element {
  const [filters, setFilters] = useState<OTelAttributeFilter[]>([
    { id: 'attribute', key: '', operator: '=', value: '' },
  ]);
  const suggestions = useMemo(() => ({ capability, context: SUGGESTION_CONTEXT }), [capability]);
  return <AttributeFilters value={filters} onChange={setFilters} suggestions={suggestions} />;
}

describe('AttributeFilters', () => {
  it('adds, edits, and removes a free-form attribute filter', () => {
    render(<TestFilters />);

    fireEvent.click(screen.getByRole('button', { name: 'Add attribute' }));
    fireEvent.change(screen.getByLabelText('Attribute name'), { target: { value: 'service.name' } });
    fireEvent.change(screen.getByLabelText('Attribute value'), { target: { value: 'checkout' } });

    expect(screen.getByDisplayValue('service.name')).not.toBeNull();
    expect(screen.getByDisplayValue('checkout')).not.toBeNull();

    const valueInput = screen.getByLabelText('Attribute value');
    const valueInputRoot = valueInput.closest('.MuiAutocomplete-root');
    if (!(valueInputRoot instanceof HTMLElement)) {
      throw new Error('Attribute value autocomplete root was not rendered.');
    }
    const deleteButton = within(valueInputRoot).getByRole('button', { name: 'Delete service.name filter' });
    fireEvent.click(deleteButton);
    expect(screen.queryByLabelText('Attribute name')).toBeNull();
  });

  it('keeps filter identities unique after deleting and adding rows', () => {
    render(<TestFilters />);

    fireEvent.click(screen.getByRole('button', { name: 'Add attribute' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add attribute' }));
    const initialNames = screen.getAllByLabelText('Attribute name');
    fireEvent.change(initialNames[0]!, { target: { value: 'service.name' } });
    fireEvent.change(initialNames[1]!, { target: { value: 'deployment.environment.name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete service.name filter' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add attribute' }));
    const nextNames = screen.getAllByLabelText('Attribute name');
    fireEvent.change(nextNames[1]!, { target: { value: 'service.version' } });

    expect(screen.getByDisplayValue('deployment.environment.name')).not.toBeNull();
    expect(screen.getByDisplayValue('service.version')).not.toBeNull();
  });

  it('loads attribute names immediately and values after an attribute is selected', async () => {
    GET_ATTRIBUTE_NAMES.mockReset().mockResolvedValue(['service.name']);
    GET_ATTRIBUTE_VALUES.mockReset().mockResolvedValue(['checkout']);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SuggestedTestFilters capability={SUGGESTION_CAPABILITY} />
      </QueryClientProvider>,
    );

    expect(GET_ATTRIBUTE_VALUES).not.toHaveBeenCalled();
    await waitFor(() => expect(GET_ATTRIBUTE_NAMES).toHaveBeenCalledOnce());
    fireEvent.mouseDown(screen.getByLabelText('Attribute value'));
    expect(screen.queryByText(/Loading/)).toBeNull();
    fireEvent.keyDown(screen.getByLabelText('Attribute value'), { key: 'Escape' });

    fireEvent.change(screen.getByLabelText('Attribute name'), { target: { value: 'service' } });
    await waitFor(() => expect(GET_ATTRIBUTE_VALUES).toHaveBeenCalledOnce());
    expect(GET_ATTRIBUTE_VALUES).toHaveBeenCalledWith(expect.objectContaining({ attribute: 'service', filters: [] }));
  });
});
