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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PrometheusDatasourceEditor } from './PrometheusDatasourceEditor';

vi.mock('@perses-dev/plugin-system', () => ({ HTTPSettingsEditor: (): null => null }));

const selector = { kind: 'MetricsUsageDatasource' as const, name: 'usage' };
const configured = { directUrl: '/prom', metricsUsage: { enable: true, datasource: selector } };

describe('Metrics Usage datasource reference editor', () => {
  it('is opt-in and saves a datasource reference', () => {
    const onChange = vi.fn();
    const { rerender } = render(<PrometheusDatasourceEditor value={{ directUrl: '/prom' }} onChange={onChange} />);
    expect(screen.getByRole('checkbox', { name: 'Enable metric usage' })).not.toBeChecked();
    expect(screen.queryByLabelText('Metrics Usage datasource')).not.toBeInTheDocument();
    userEvent.click(screen.getByRole('checkbox', { name: 'Enable metric usage' }));
    expect(onChange).toHaveBeenCalledWith({
      directUrl: '/prom',
      metricsUsage: { enable: true, datasource: { kind: 'MetricsUsageDatasource' } },
    });
    rerender(<PrometheusDatasourceEditor value={configured} onChange={onChange} />);
    expect(screen.getByLabelText('Metrics Usage datasource')).toHaveValue('usage');
    userEvent.click(screen.getByRole('checkbox', { name: 'Enable metric usage' }));
    expect(onChange).toHaveBeenLastCalledWith({
      directUrl: '/prom',
      metricsUsage: { enable: false, datasource: selector },
    });
  });

  it('replaces the deprecated URL when a datasource is selected', () => {
    const onChange = vi.fn();
    render(
      <PrometheusDatasourceEditor
        value={{ directUrl: '/prom', metricsUsage: { enable: true, url: '/legacy' } }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/Using legacy URL: \/legacy/)).toBeInTheDocument();
    userEvent.paste(screen.getByLabelText('Metrics Usage datasource'), 'usage');
    expect(onChange).toHaveBeenLastCalledWith(configured);
  });

  it('respects read-only datasource permissions', () => {
    render(<PrometheusDatasourceEditor value={configured} onChange={vi.fn()} isReadonly />);
    expect(screen.getByRole('checkbox', { name: 'Enable metric usage' })).toBeDisabled();
    expect(screen.getByLabelText('Metrics Usage datasource')).toBeDisabled();
  });
});
