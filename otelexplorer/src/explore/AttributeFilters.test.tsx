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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';

import { OTelAttributeFilter } from '../model';
import { AttributeFilters } from './AttributeFilters';

function TestFilters(): JSX.Element {
  const [filters, setFilters] = useState<OTelAttributeFilter[]>([]);
  return <AttributeFilters value={filters} onChange={setFilters} />;
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
});
