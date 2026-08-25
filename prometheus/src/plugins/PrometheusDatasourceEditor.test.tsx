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

import type { DatasourceSelectItemGroup } from '@perses-dev/plugin-system';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PrometheusDatasourceEditor } from './PrometheusDatasourceEditor';

vi.mock('@perses-dev/plugin-system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@perses-dev/plugin-system')>()),
  HTTPSettingsEditor: (): null => null,
  useListDatasourceSelectItems: (kind: string): { data: DatasourceSelectItemGroup[] } => ({
    data:
      kind === 'TempoDatasource'
        ? [
            {
              items: [
                {
                  name: 'tempo',
                  selector: { kind: 'TempoDatasource', name: 'tempo' },
                },
              ],
            },
          ]
        : [],
  }),
}));

describe('PrometheusDatasourceEditor', () => {
  it('selects the tracing datasource used by exemplars', async () => {
    const onChange = vi.fn();
    render(<PrometheusDatasourceEditor value={{ directUrl: 'http://prometheus' }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Tracing Datasource' }));
    await userEvent.click(screen.getByRole('option', { name: 'tempo (TempoDatasource)' }));

    expect(onChange).toHaveBeenCalledWith({
      directUrl: 'http://prometheus',
      tracingDatasource: { kind: 'TempoDatasource', name: 'tempo' },
    });
  });
});
