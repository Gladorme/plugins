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

import { ChartsProvider, testChartsTheme } from '@perses-dev/components';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TimeSeriesChartGeneralSettings } from './GeneralSettingsEditor';

const DEFAULT_OPTIONS = {};

describe('TimeSeriesChartGeneralSettings', () => {
  it('keeps exemplar fetching disabled by default and allows enabling it', async () => {
    const onChange = vi.fn();
    render(
      <ChartsProvider chartsTheme={testChartsTheme}>
        <TimeSeriesChartGeneralSettings value={DEFAULT_OPTIONS} onChange={onChange} />
      </ChartsProvider>,
    );

    const toggle = screen.getByRole('checkbox', { name: 'Enable exemplars' });
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith({ enableExemplars: true });
  });
});
