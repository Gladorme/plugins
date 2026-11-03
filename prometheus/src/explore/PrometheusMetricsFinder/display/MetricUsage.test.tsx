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
import type { RenderResult } from '@testing-library/react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { MetricUsageCategory, MetricUsageProvider } from '../../../model';
import { DEFAULT_PROM } from '../../../model';
import { MetricUsage } from './MetricUsage';

function renderUsage(provider: MetricUsageProvider): RenderResult & { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
    logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MetricUsage metricName="up" datasource={DEFAULT_PROM} provider={provider} />
      </QueryClientProvider>,
    ),
  };
}

const categories: MetricUsageCategory[] = [
  {
    id: 'dashboards',
    label: 'Dashboards',
    references: [{ name: 'Overview', url: 'https://perses.example.com/dashboard' }],
  },
  { id: 'alerts', label: 'Alerts', references: [] },
  {
    id: 'custom',
    label: 'Reports',
    references: [{ name: 'Monthly report', url: 'javascript:alert(1)', description: 'Internal report' }],
  },
];

describe('MetricUsage', () => {
  it('opens a drawer with non-empty tabs, icons, references, and safe links', async () => {
    renderUsage({ queryKey: ['test'], getUsage: vi.fn().mockResolvedValue(categories) });
    expect(screen.getByLabelText('Loading usage for up')).toBeInTheDocument();
    const chip = await screen.findByRole('button', { name: 'Dashboards: 1 for up' });
    expect(chip).toHaveTextContent(/^1$/);
    expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByText('Alerts: 0')).not.toBeInTheDocument();
    userEvent.click(chip);
    const drawer = screen.getByRole('dialog', { name: 'Where up is used' });
    expect(within(drawer).getByRole('tab', { name: 'Dashboards: 1' })).toHaveAttribute('aria-selected', 'true');
    expect(within(drawer).queryByRole('tab', { name: /Alerts/ })).not.toBeInTheDocument();
    const link = within(drawer).getByRole('link', { name: 'Open dashboard: Overview' });
    expect(link).toHaveAttribute('href', 'https://perses.example.com/dashboard');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    userEvent.click(within(drawer).getByRole('tab', { name: 'Reports: 1' }));
    const panel = within(drawer).getByRole('tabpanel', { name: 'Reports: 1' });
    expect(within(panel).getByText('Monthly report')).toBeInTheDocument();
    expect(within(panel).getByText('Internal report')).toBeInTheDocument();
    expect(within(panel).queryByRole('link')).not.toBeInTheDocument();
    expect(within(panel).getByText('No link configured')).toBeInTheDocument();
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Close metric usage' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    userEvent.click(screen.getByRole('button', { name: 'Reports: 1 for up' }));
    expect(screen.getByRole('tab', { name: 'Reports: 1' })).toHaveAttribute('aria-selected', 'true');
    userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens the clicked category and provides alert and recording-rule links', async () => {
    const usage = [
      ...categories.filter(({ id }) => id !== 'alerts'),
      {
        id: 'alerts',
        label: 'Alerts',
        references: [{ name: 'TargetDown', url: '/alerts/TargetDown', description: 'up == 0' }],
      },
      {
        id: 'recordingRules',
        label: 'Recording rules',
        references: [{ name: 'job:up:sum', url: '/rules/job-up-sum' }],
      },
    ];
    renderUsage({ queryKey: ['rules'], getUsage: vi.fn().mockResolvedValue(usage) });
    const alertChip = await screen.findByRole('button', { name: 'Alerts: 1 for up' });
    expect(alertChip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Recording rules: 1 for up' }).querySelector('svg')).toBeInTheDocument();
    userEvent.click(alertChip);
    expect(screen.getByRole('tab', { name: 'Alerts: 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('up == 0')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open alert: TargetDown' })).toHaveAttribute(
      'href',
      new URL('/alerts/TargetDown', window.location.origin).href,
    );
    userEvent.click(screen.getByRole('tab', { name: 'Recording rules: 1' }));
    expect(screen.getByRole('link', { name: 'Open recording rule: job:up:sum' })).toBeInTheDocument();
  });

  it('hides all chips and tabs when every category has zero occurrences', async () => {
    const usage = categories.map((category) => ({ ...category, references: [] }));
    const { container } = renderUsage({ queryKey: ['unused'], getUsage: vi.fn().mockResolvedValue(usage) });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows unknown metrics separately from errors and known empty results', async () => {
    const getUsage = vi.fn().mockResolvedValue(undefined);
    renderUsage({ queryKey: ['unknown'], getUsage });
    expect(await screen.findByText('Usage unknown')).toBeInTheDocument();
  });

  it('renders nothing for known empty results', async () => {
    const { container } = renderUsage({ queryKey: ['empty'], getUsage: vi.fn().mockResolvedValue([]) });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('isolates failures without exposing server details', async () => {
    renderUsage({ queryKey: ['failure'], getUsage: vi.fn().mockRejectedValue(new Error('secret server detail')) });
    expect(await screen.findByText('Usage unavailable')).toBeInTheDocument();
    expect(screen.queryByText('secret server detail')).not.toBeInTheDocument();
  });

  it('separates cached usage by datasource and provider', async () => {
    const getUsage = vi.fn().mockResolvedValue(categories);
    const provider = { queryKey: ['first'], getUsage };
    const { client, rerender } = renderUsage(provider);
    await screen.findByRole('button', { name: 'Dashboards: 1 for up' });
    const datasource = { kind: 'PrometheusDatasource', name: 'other' };
    rerender(
      <QueryClientProvider client={client}>
        <MetricUsage metricName="up" datasource={datasource} provider={provider} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(getUsage).toHaveBeenCalledTimes(2));
    const otherProvider = { queryKey: ['second'], getUsage };
    rerender(
      <QueryClientProvider client={client}>
        <MetricUsage metricName="up" datasource={datasource} provider={otherProvider} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(getUsage).toHaveBeenCalledTimes(3));
  });

  it('aborts an outstanding request on unmount', async () => {
    const getUsage = vi.fn<MetricUsageProvider['getUsage']>(() => new Promise<MetricUsageCategory[]>(() => {}));
    const { unmount } = renderUsage({ queryKey: ['pending'], getUsage });
    await waitFor(() => expect(getUsage).toHaveBeenCalled());
    const signal = getUsage.mock.calls[0]?.[0];
    unmount();
    // The provider receives the query's cancellation signal.
    expect(signal).toEqual(expect.objectContaining({ signal: expect.objectContaining({ aborted: true }) }));
  });
});
