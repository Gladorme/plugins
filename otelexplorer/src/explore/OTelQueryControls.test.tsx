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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { OTelSignal, OTelSignalCapability, OTelSignalInputs } from '../model';
import { createSignalChangeData, getSignalPanelKind, SignalNavigation } from './OTelExplorer';
import { OTelQueryControls } from './OTelQueryControls';

vi.mock('@perses-dev/plugin-system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@perses-dev/plugin-system')>()),
  useDatasourceClient: (): { data: object } => ({ data: {} }),
  useTimeRange: (): { absoluteTimeRange: { start: Date; end: Date } } => ({
    absoluteTimeRange: { start: new Date(1_000), end: new Date(2_000) },
  }),
}));

const DATASOURCE = { kind: 'TestDatasource' };
const EMPTY_FILTERS: [] = [];
const INPUTS: OTelSignalInputs = {
  logSearch: '',
  logServiceName: '',
  logSeverity: '',
  metricName: '',
  metricsQueryMode: 'range',
  profileServiceName: '',
  profileType: '',
  traceMaxDuration: '',
  traceMinDuration: '',
  traceServiceName: '',
  traceSpanName: '',
  traceStatus: '',
};

function renderControls(signal: OTelSignal, capability: OTelSignalCapability = { createQuery: vi.fn() }): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <OTelQueryControls
        capability={capability}
        datasource={DATASOURCE}
        filters={EMPTY_FILTERS}
        inputs={INPUTS}
        onFiltersChange={vi.fn()}
        onInputsChange={vi.fn()}
        onQueryRun={vi.fn()}
        signal={signal}
      />
    </QueryClientProvider>,
  );
}

describe('OTelQueryControls', () => {
  it('renders dedicated metrics and logs controls', () => {
    renderControls('metrics');
    expect(screen.getByLabelText('Metric name')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Range' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Instant' })).not.toBeNull();

    renderControls('logs');
    expect(screen.getByLabelText('Search log lines')).not.toBeNull();
    expect(screen.getAllByLabelText('Service name')).toHaveLength(1);
    expect(screen.getByLabelText('Severity')).not.toBeNull();
  });

  it('renders dedicated trace controls and validates durations', () => {
    renderControls('traces');
    expect(screen.getByLabelText('Service name')).not.toBeNull();
    expect(screen.getByLabelText('Span name')).not.toBeNull();
    expect(screen.getByLabelText('Status')).not.toBeNull();
    expect(screen.getByLabelText('Min duration')).not.toBeNull();
    expect(screen.getByLabelText('Max duration')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Run query' }).classList.contains('MuiButton-fullWidth')).toBe(true);
  });

  it('renders profile type and service controls', () => {
    renderControls('profiles');
    expect(screen.getByLabelText('Service name')).not.toBeNull();
    expect(screen.getByLabelText('Profile type')).not.toBeNull();
  });

  it('requests datasource-backed suggestions for semantic signal fields', async () => {
    const getSignalFieldValues = vi.fn().mockResolvedValue(['checkout']);
    renderControls('logs', { createQuery: vi.fn(), getSignalFieldValues });

    await waitFor(() =>
      expect(getSignalFieldValues).toHaveBeenCalledWith(expect.objectContaining({ field: 'log.service.name' })),
    );
    fireEvent.change(screen.getByLabelText('Search log lines'), { target: { value: 'failed' } });
  });
});

describe('SignalNavigation', () => {
  it('navigates between all OpenTelemetry signals', () => {
    const onChange = vi.fn();
    render(<SignalNavigation signal="metrics" onChange={onChange} />);

    expect(screen.getByRole('tablist', { name: 'OpenTelemetry signals' })).not.toBeNull();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Metrics', 'Logs', 'Traces', 'Profiles']);
    fireEvent.click(screen.getByRole('tab', { name: 'Traces' }));
    expect(onChange).toHaveBeenCalledWith(expect.anything(), 'traces');
  });

  it('keeps common attributes when changing signal', () => {
    const filters = [{ id: 'service', key: 'service.name', operator: '=' as const, value: 'checkout' }];
    const next = createSignalChangeData({ filters, metricName: 'requests_total', signal: 'metrics' }, 'logs', filters);

    expect(next).toEqual({ filters, metricName: 'requests_total', signal: 'logs' });
    expect(next.filters).toBe(filters);
  });

  it('uses a time series table for instant metric results', () => {
    expect(getSignalPanelKind('metrics', 'range')).toBe('TimeSeriesChart');
    expect(getSignalPanelKind('metrics', 'instant')).toBe('TimeSeriesTable');
    expect(getSignalPanelKind('logs', 'instant')).toBe('LogsTable');
  });
});
