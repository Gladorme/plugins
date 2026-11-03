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

import { MetricsUsageDatasource } from './metrics-usage-datasource';

const datasource = { kind: 'PrometheusDatasource' };

describe('MetricsUsageDatasource', () => {
  it.each([
    { spec: { directUrl: 'https://usage.example.com/' }, proxyUrl: '/unused', expected: 'https://usage.example.com' },
    {
      spec: { proxy: { kind: 'HTTPProxy' as const, spec: { url: 'http://usage:8080' } } },
      proxyUrl: '/proxy/usage',
      expected: '/proxy/usage',
    },
  ])('uses its own direct or proxy connection: $expected', async ({ spec, proxyUrl, expected }) => {
    const fetchJson = vi.fn().mockResolvedValue({ up: {} });
    const signal = new AbortController().signal;
    const client = MetricsUsageDatasource.createClient(spec, { proxyUrl, fetchJson });
    await client.getUsage({ metricName: 'up', datasource, signal });
    expect(fetchJson).toHaveBeenCalledWith(
      `${expected}/api/v1/metrics?metric_name=up&mode=exact&merge_partial_metrics=true`,
      { signal, headers: undefined },
    );
  });

  it('uses only its own configured headers', async () => {
    const fetchJson = vi.fn().mockResolvedValue({ up: {} });
    const client = MetricsUsageDatasource.createClient(
      { proxy: { kind: 'HTTPProxy', spec: { url: 'http://usage:8080', headers: { 'X-Tenant': 'usage-tenant' } } } },
      { proxyUrl: '/proxy/usage', fetchJson },
    );
    await client.getUsage({ metricName: 'up', datasource });
    expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining('/proxy/usage/'), {
      signal: undefined,
      headers: { 'X-Tenant': 'usage-tenant' },
    });
    expect(JSON.stringify(client.queryKey)).not.toContain('usage-tenant');
  });

  it('requires a direct or resolved proxy URL', () => {
    expect(() => MetricsUsageDatasource.createClient({}, {})).toThrow('No URL specified');
    expect(() => MetricsUsageDatasource.createClient({ directUrl: ' ' }, {})).toThrow('No URL specified');
  });
});
