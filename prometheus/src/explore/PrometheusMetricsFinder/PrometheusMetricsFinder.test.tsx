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

import { useDatasourceClient } from '@perses-dev/plugin-system';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RenderResult } from '@testing-library/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { VirtuosoMockContext } from 'react-virtuoso';

import type { MetricUsageProvider } from '../../model';
import { DEFAULT_PROM } from '../../model';
import { MetricsUsageDatasource } from '../../plugins/metrics-usage-datasource';
import { PrometheusDatasource } from '../../plugins/prometheus-datasource';
import { JobTab } from './overview/tabs/JobTab';
import { SimilarTab } from './overview/tabs/SimilarTab';
import { PrometheusMetricsFinder } from './PrometheusMetricsFinder';
import type { useLabelValues, useMetricMetadata } from './utils';

const store = vi.hoisted(() => ({ getDatasourceClient: vi.fn() }));
vi.mock('@perses-dev/plugin-system', () => ({
  useDatasourceClient: vi.fn(),
  useDatasourceStore: (): typeof store => store,
}));
vi.mock('@perses-dev/explore', () => ({ useExplorerQueryParams: vi.fn().mockReturnValue('') }));
vi.mock('./filter/FinderFilters', () => ({ FinderFilters: (): null => null }));
vi.mock('./overview/MetricOverview', () => ({ MetricOverview: (): null => null }));
vi.mock('./utils', () => ({
  useLabelValues: (): Partial<ReturnType<typeof useLabelValues>> => ({
    data: { status: 'success', data: ['up', 'process_cpu_seconds_total'] },
    isLoading: false,
  }),
  useMetricMetadata: (): ReturnType<typeof useMetricMetadata> => ({
    metadata: { type: 'gauge', help: 'Metric description', unit: '' },
    isLoading: false,
    error: null,
  }),
}));
const viewport = { viewportHeight: 400, itemHeight: 25 };

function renderFinder(metricUsage?: MetricUsageProvider | false): RenderResult {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VirtuosoMockContext.Provider value={viewport}>
          <PrometheusMetricsFinder
            value={{ datasource: DEFAULT_PROM, filters: [] }}
            onChange={vi.fn()}
            metricUsage={metricUsage}
          />
        </VirtuosoMockContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function provider(): MetricUsageProvider {
  return {
    queryKey: ['test'],
    getUsage: vi.fn().mockResolvedValue([{ id: 'alerts', label: 'Alerts', references: [{ name: 'TargetDown' }] }]),
  };
}

beforeEach(() => {
  localStorage.clear();
  store.getDatasourceClient.mockReset();
  vi.mocked(useDatasourceClient).mockReturnValue({ data: {} } as ReturnType<typeof useDatasourceClient>);
});

describe('Metric Finder usage integration', () => {
  it('resolves a separate datasource and sends usage requests through its own proxy', async () => {
    const usageFetch = vi.fn().mockResolvedValue({
      up: { usage: { dashboards: [{ title: 'Overview', url: 'https://dash.example/overview' }] } },
    });
    const prometheusFetch = vi.fn();
    const selector = { kind: 'MetricsUsageDatasource' as const, name: 'usage' };
    const promClient = PrometheusDatasource.createClient(
      {
        proxy: {
          kind: 'HTTPProxy',
          spec: { url: 'http://prometheus:9090', headers: { Authorization: 'prom-secret' } },
        },
        queryParams: { tenant: 'prom-tenant' },
        metricsUsage: { enable: true, datasource: selector },
      },
      { proxyUrl: '/proxy/prometheus', fetchJson: prometheusFetch },
    );
    const usageClient = MetricsUsageDatasource.createClient(
      {
        proxy: { kind: 'HTTPProxy', spec: { url: 'http://metrics-usage:8080' } },
      },
      { proxyUrl: '/proxy/usage', fetchJson: usageFetch },
    );
    store.getDatasourceClient.mockResolvedValue(usageClient);
    vi.mocked(useDatasourceClient).mockReturnValue({ data: promClient } as ReturnType<typeof useDatasourceClient>);
    renderFinder();
    expect(await screen.findByRole('button', { name: 'Dashboards: 1 for up' })).toBeInTheDocument();
    expect(store.getDatasourceClient).toHaveBeenCalledTimes(1);
    expect(store.getDatasourceClient).toHaveBeenCalledWith(selector);
    expect(usageFetch).toHaveBeenCalledWith(
      '/proxy/usage/api/v1/metrics?metric_name=up&mode=exact&merge_partial_metrics=true',
      expect.objectContaining({ headers: undefined }),
    );
    expect(prometheusFetch).not.toHaveBeenCalled();
  });

  it.each(['host', 'settings', 'custom'])(
    'does not resolve the referenced datasource when disabled or overridden: %s',
    async (mode) => {
      vi.mocked(useDatasourceClient).mockReturnValue({
        data: { metricUsageDatasource: { kind: 'MetricsUsageDatasource', name: 'usage' } },
      } as ReturnType<typeof useDatasourceClient>);
      if (mode === 'settings')
        localStorage.setItem('PERSES_METRICS_FINDER_SETTINGS', JSON.stringify({ isMetricUsageEnabled: false }));
      const override = mode === 'custom' ? provider() : undefined;
      renderFinder(mode === 'host' ? false : override);
      if (mode === 'custom') await screen.findByRole('button', { name: 'Alerts: 1 for up' });
      expect(store.getDatasourceClient).not.toHaveBeenCalled();
    },
  );

  it('keeps metric exploration available when the referenced datasource is missing', async () => {
    store.getDatasourceClient.mockRejectedValue(new Error('Datasource not found'));
    vi.mocked(useDatasourceClient).mockReturnValue({
      data: { metricUsageDatasource: { kind: 'MetricsUsageDatasource', name: 'missing' } },
    } as ReturnType<typeof useDatasourceClient>);
    renderFinder();
    expect((await screen.findAllByText('Usage unavailable')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'explore metric up' })).toBeInTheDocument();
  });

  it('keeps existing behavior when no provider is configured', () => {
    renderFinder();
    expect(screen.getByText('up')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'explore metric up' })).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: 'settings' }));
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Enable Metric Usage' })).not.toBeInTheDocument();
  });

  it('shows usage per row from the datasource provider and lets users hide it', async () => {
    const usage = provider();
    store.getDatasourceClient.mockResolvedValue(usage);
    vi.mocked(useDatasourceClient).mockReturnValue({
      data: { metricUsageDatasource: { kind: 'MetricsUsageDatasource', name: 'usage' } },
    } as ReturnType<typeof useDatasourceClient>);
    renderFinder();
    expect(await screen.findByRole('button', { name: 'Alerts: 1 for up' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Alerts: 1 for process_cpu_seconds_total' })).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: 'settings' }));
    userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Enable Metric Usage' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Alerts: 1 for up' })).not.toBeInTheDocument());
    expect(JSON.parse(localStorage.getItem('PERSES_METRICS_FINDER_SETTINGS') ?? '{}').isMetricUsageEnabled).toBe(false);
    screen.getByRole('menuitemcheckbox', { name: 'Enable Metric Usage' }).focus();
    userEvent.keyboard('{Enter}');
    userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'Alerts: 1 for up' })).toBeInTheDocument();
    expect(usage.getUsage).toHaveBeenCalledTimes(2);
  });

  it('makes no usage requests when disabled by the host', () => {
    const usage = provider();
    store.getDatasourceClient.mockResolvedValue(usage);
    vi.mocked(useDatasourceClient).mockReturnValue({
      data: { metricUsageDatasource: { kind: 'MetricsUsageDatasource', name: 'usage' } },
    } as ReturnType<typeof useDatasourceClient>);
    renderFinder(false);
    expect(usage.getUsage).not.toHaveBeenCalled();
  });

  it('makes no usage requests when disabled in saved preferences', () => {
    localStorage.setItem('PERSES_METRICS_FINDER_SETTINGS', JSON.stringify({ isMetricUsageEnabled: false }));
    const usage = provider();
    renderFinder(usage);
    expect(usage.getUsage).not.toHaveBeenCalled();
  });

  it('uses a custom provider instead of the datasource provider', async () => {
    const builtin = provider();
    vi.mocked(useDatasourceClient).mockReturnValue({ data: { metricUsage: builtin } } as ReturnType<
      typeof useDatasourceClient
    >);
    const custom = provider();
    renderFinder(custom);
    await screen.findByRole('button', { name: 'Alerts: 1 for up' });
    expect(custom.getUsage).toHaveBeenCalledTimes(2);
    expect(builtin.getUsage).not.toHaveBeenCalled();
  });

  it.each(['invalid json', '{"isMetricUsageEnabled":"false"}', '{"isMetadataEnabled":true}'])(
    'handles malformed or older preferences: %s',
    async (stored) => {
      localStorage.setItem('PERSES_METRICS_FINDER_SETTINGS', stored);
      renderFinder(provider());
      expect(await screen.findByRole('button', { name: 'Alerts: 1 for up' })).toBeInTheDocument();
    },
  );
});

describe('Related metric lists', () => {
  it.each([JobTab, SimilarTab])('displays usage on related metrics in %s', async (Tab) => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <VirtuosoMockContext.Provider value={viewport}>
            <Tab datasource={DEFAULT_PROM} filters={[]} onExplore={vi.fn()} metricUsage={provider()} />
          </VirtuosoMockContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Alerts: 1 for up' })).toBeInTheDocument();
  });
});
