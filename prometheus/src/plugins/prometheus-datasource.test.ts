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

import { PrometheusDatasource } from './prometheus-datasource';
import type { PrometheusDatasourceSpec } from './types';

describe('PrometheusDatasource query parameters', () => {
  it('should not alter the base URL', () => {
    const spec: PrometheusDatasourceSpec = {
      proxy: {
        kind: 'HTTPProxy',
        spec: {
          url: 'http://localhost:9090',
        },
      },
      queryParams: {
        engine: 'prometheus',
        tenant: 'default',
      },
    };

    const client = PrometheusDatasource.createClient(spec, { proxyUrl: 'http://proxy:8080' });

    // The client should have the original URL without query parameters
    // Query parameters will be added to individual API requests
    expect(client.options.datasourceUrl).toBe('http://proxy:8080');
  });

  it('should include query parameters in API calls', async () => {
    const spec: PrometheusDatasourceSpec = {
      directUrl: 'http://localhost:9090',
      queryParams: {
        dedup: 'false',
        timeout: '30s',
      },
    };

    const client = PrometheusDatasource.createClient(spec, {});

    // Mock the global fetch to verify the URL includes query parameters
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });
    global.fetch = mockFetch;

    // Test healthCheck includes query parameters
    if (client.healthCheck) {
      const healthCheckFn = client.healthCheck();
      await healthCheckFn;
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9090/-/healthy?dedup=false&timeout=30s',
        expect.any(Object),
      );
    }

    mockFetch.mockClear();
  });

  it('should call the query_exemplars endpoint with query parameters', async () => {
    const spec: PrometheusDatasourceSpec = {
      directUrl: 'http://localhost:9090',
      queryParams: {
        dedup: 'false',
      },
      exemplars: {
        enable: true,
      },
    };

    const client = PrometheusDatasource.createClient(spec, {});

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ data: [] }),
    });
    global.fetch = mockFetch;

    const response = await client.queryExemplars({
      query: 'up',
      start: 1700000000,
      end: 1700003600,
    });

    expect(response.data).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9090/api/v1/query_exemplars?query=up&start=1700000000&end=1700003600&dedup=false',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('PrometheusDatasource custom fetch injection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the fetch provided through createClient options for healthCheck', async () => {
    const spec: PrometheusDatasourceSpec = { directUrl: 'http://localhost:9090' };
    // Previous tests in this file reassign global.fetch without restoring it; clear any inherited call history.
    const globalFetchSpy = vi.spyOn(globalThis, 'fetch').mockClear();
    const customFetch = vi.fn().mockResolvedValue({ status: 200 });

    const client = PrometheusDatasource.createClient(spec, {
      proxyUrl: 'http://proxy:8080',
      fetch: customFetch,
    });

    expect(client.healthCheck).toBeDefined();
    const healthy = await client.healthCheck!();

    expect(healthy).toBe(true);
    expect(customFetch).toHaveBeenCalledTimes(1);
    expect(globalFetchSpy).not.toHaveBeenCalled();
  });

  it('uses the fetchJson provided through createClient options for queries', async () => {
    const spec: PrometheusDatasourceSpec = { directUrl: 'http://localhost:9090' };
    // Previous tests in this file reassign global.fetch without restoring it; clear any inherited call history.
    const globalFetchSpy = vi.spyOn(globalThis, 'fetch').mockClear();
    const customFetchJson = vi.fn().mockResolvedValue({
      status: 'success',
      data: { resultType: 'vector', result: [] },
    });

    const client = PrometheusDatasource.createClient(spec, {
      proxyUrl: 'http://proxy:8080',
      fetchJson: customFetchJson,
    });

    const response = await client.instantQuery({ query: 'up' });

    expect(response.data).toEqual({ resultType: 'vector', result: [] });
    expect(customFetchJson).toHaveBeenCalledTimes(1);
    expect(globalFetchSpy).not.toHaveBeenCalled();
  });
});

describe('PrometheusDatasource metric usage', () => {
  it('exposes the reference instead of creating a client with Prometheus transport', () => {
    const datasource = { kind: 'MetricsUsageDatasource' as const, name: 'usage' };
    const client = PrometheusDatasource.createClient(
      { directUrl: '/prom', metricsUsage: { enable: true, datasource, url: '/legacy' } },
      {},
    );
    expect(client.metricUsageDatasource).toEqual(datasource);
    expect(client.metricUsage).toBeUndefined();
    const disabled = PrometheusDatasource.createClient(
      { directUrl: '/prom', metricsUsage: { enable: false, datasource } },
      {},
    );
    expect(disabled.metricUsageDatasource).toBeUndefined();
  });
  it.each([undefined, { enable: false, url: '/usage' }])('is disabled unless configured: %j', (metricsUsage) => {
    const client = PrometheusDatasource.createClient({ directUrl: '/prom', metricsUsage }, {});
    expect(client.metricUsage).toBeUndefined();
  });

  it('uses the configured endpoint and injected HTTP client without Prometheus headers or parameters', async () => {
    const fetchJson = vi.fn().mockResolvedValue({ up: {} });
    const client = PrometheusDatasource.createClient(
      {
        proxy: {
          kind: 'HTTPProxy',
          spec: { url: 'https://prometheus.example.com', headers: { Authorization: 'prom-secret' } },
        },
        queryParams: { tenant: 'prom-tenant' },
        metricsUsage: { enable: true, url: '/usage/' },
      },
      { proxyUrl: '/prom-proxy', fetchJson },
    );
    expect(client.metricUsage).toBeDefined();
    await client.metricUsage?.getUsage({ metricName: 'up', datasource: { kind: 'PrometheusDatasource' } });
    expect(fetchJson).toHaveBeenCalledWith(
      '/usage/api/v1/metrics?metric_name=up&mode=exact&merge_partial_metrics=true',
      { signal: undefined },
    );
  });
});
