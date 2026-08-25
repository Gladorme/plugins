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

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PrometheusDatasourceEditor } from './PrometheusDatasourceEditor';

vi.mock('@perses-dev/plugin-system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@perses-dev/plugin-system')>()),
  HTTPSettingsEditor: (): null => null,
}));

describe('PrometheusDatasourceEditor', () => {
  it('selects a tracing datasource without requiring a DatasourceStoreContext', async () => {
    const onChange = vi.fn();
    render(<PrometheusDatasourceEditor value={{ directUrl: 'http://prometheus' }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Tracing Datasource' }));
    await userEvent.click(screen.getByRole('option', { name: 'Tempo' }));

    expect(onChange).toHaveBeenCalledWith({
      directUrl: 'http://prometheus',
      tracingDatasource: { kind: 'TempoDatasource' },
    });
  });

  it('updates the optional tracing datasource name', async () => {
    const onChange = vi.fn();
    render(
      <PrometheusDatasourceEditor
        value={{ directUrl: 'http://prometheus', tracingDatasource: { kind: 'TempoDatasource' } }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Tracing Datasource Name' }), { target: { value: 'tempo' } });

    expect(onChange).toHaveBeenLastCalledWith({
      directUrl: 'http://prometheus',
      tracingDatasource: { kind: 'TempoDatasource', name: 'tempo' },
    });
  });
});
