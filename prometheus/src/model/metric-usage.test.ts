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

import { createMetricsUsageProvider } from './metric-usage';
import { DEFAULT_PROM } from './prometheus-selectors';

const dashboard = { uid: 'a', title: 'Overview', url: 'https://perses.example.com/dashboards/a' };
const rule = {
  name: 'HighCPU',
  prom_link: 'https://prometheus.example.com',
  group_name: 'cpu',
  expression: 'cpu > 90',
};

describe('Metrics Usage adapter', () => {
  it('requests an exact metric with partial usage merged and forwards cancellation', async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      'cpu/é': { usage: { dashboards: [dashboard], alertRules: [rule], recordingRules: [rule] } },
    });
    const provider = createMetricsUsageProvider('/usage/', fetchJson);
    const signal = new AbortController().signal;
    const categories = await provider.getUsage({ metricName: 'cpu/é', datasource: DEFAULT_PROM, signal });
    expect(fetchJson).toHaveBeenCalledWith(
      '/usage/api/v1/metrics?metric_name=cpu%2F%C3%A9&mode=exact&merge_partial_metrics=true',
      { signal },
    );
    expect(categories).toEqual([
      { id: 'dashboards', label: 'Dashboards', references: [{ name: dashboard.title, url: dashboard.url }] },
      {
        id: 'alerts',
        label: 'Alerts',
        references: [{ name: rule.name, url: rule.prom_link, description: 'cpu: cpu > 90' }],
      },
      {
        id: 'recordingRules',
        label: 'Recording rules',
        references: [{ name: rule.name, url: rule.prom_link, description: 'cpu: cpu > 90' }],
      },
    ]);
  });

  it.each([{ up: {} }, { up: { usage: null } }, { up: { usage: { dashboards: null } } }])(
    'returns zero counts for a known metric without usage: %j',
    async (response) => {
      const provider = createMetricsUsageProvider('/usage', vi.fn().mockResolvedValue(response));
      const categories = await provider.getUsage({ metricName: 'up', datasource: DEFAULT_PROM });
      expect(categories?.map(({ references }) => references.length)).toEqual([0, 0, 0]);
    },
  );

  it('distinguishes an unknown metric from zero usage', async () => {
    const provider = createMetricsUsageProvider('/usage', vi.fn().mockResolvedValue({}));
    expect(await provider.getUsage({ metricName: 'up', datasource: DEFAULT_PROM })).toBeUndefined();
    expect(await provider.getUsage({ metricName: 'constructor', datasource: DEFAULT_PROM })).toBeUndefined();
  });

  it.each([
    null,
    [],
    { up: null },
    { up: { usage: [] } },
    { up: { usage: { dashboards: {} } } },
    { up: { usage: { dashboards: [{}] } } },
    { up: { usage: { alertRules: [{ name: 5 }] } } },
  ])('rejects malformed API data instead of displaying zero counts: %j', async (response) => {
    const provider = createMetricsUsageProvider('/usage', vi.fn().mockResolvedValue(response));
    await expect(provider.getUsage({ metricName: 'up', datasource: DEFAULT_PROM })).rejects.toThrow();
  });

  it('preserves request failures', async () => {
    const error = new Error('Unauthorized');
    const provider = createMetricsUsageProvider('/usage', vi.fn().mockRejectedValue(error));
    await expect(provider.getUsage({ metricName: 'up', datasource: DEFAULT_PROM })).rejects.toBe(error);
  });
});
