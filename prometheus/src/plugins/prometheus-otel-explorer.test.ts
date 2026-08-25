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

import type { PrometheusClient } from '../model';
import { applyPrometheusAttributeFilters, PROMETHEUS_OTEL_EXPLORER } from './prometheus-otel-explorer';

const serviceFilter = {
  key: 'service_name',
  operator: '=' as const,
  value: 'checkout',
};

describe('applyPrometheusAttributeFilters', () => {
  it('adds filters while retaining manual matchers', () => {
    expect(applyPrometheusAttributeFilters('http_requests_total{method="GET"}', [serviceFilter], [])).toBe(
      'http_requests_total{method="GET",service_name="checkout"}',
    );
  });

  it('replaces previously applied filters', () => {
    expect(
      applyPrometheusAttributeFilters(
        'http_requests_total{method="GET",service_name="checkout"}',
        [{ ...serviceFilter, value: 'payments' }],
        [serviceFilter],
      ),
    ).toBe('http_requests_total{method="GET",service_name="payments"}');
  });
});

describe('Prometheus OTel explorer capability', () => {
  it('creates a native query without rendering the Prometheus editor', () => {
    expect(
      PROMETHEUS_OTEL_EXPLORER.metrics.createQuery({
        datasource: { kind: 'PrometheusDatasource', name: 'prometheusdemo' },
        filters: [serviceFilter],
      }),
    ).toEqual({
      kind: 'TimeSeriesQuery',
      spec: {
        plugin: {
          kind: 'PrometheusTimeSeriesQuery',
          spec: {
            datasource: { kind: 'PrometheusDatasource', name: 'prometheusdemo' },
            instant: false,
            query: '{service_name="checkout"}',
          },
        },
      },
    });
  });

  it('supports an empty metric name and creates an instant query', () => {
    expect(
      PROMETHEUS_OTEL_EXPLORER.metrics.createQuery({
        datasource: { kind: 'PrometheusDatasource' },
        filters: [],
        metricName: '',
        metricsQueryMode: 'instant',
      }),
    ).toEqual({
      kind: 'TimeSeriesQuery',
      spec: {
        plugin: {
          kind: 'PrometheusTimeSeriesQuery',
          spec: {
            datasource: { kind: 'PrometheusDatasource' },
            instant: true,
            query: '{__name__=~".+"}',
          },
        },
      },
    });
  });

  it('combines a metric name with attribute filters', () => {
    const query = PROMETHEUS_OTEL_EXPLORER.metrics.createQuery({
      datasource: { kind: 'PrometheusDatasource' },
      filters: [serviceFilter],
      metricName: 'http_requests_total',
      metricsQueryMode: 'range',
    });

    expect(query.spec.plugin.spec).toEqual({
      datasource: { kind: 'PrometheusDatasource' },
      instant: false,
      query: 'http_requests_total{service_name="checkout"}',
    });
  });

  it('loads metric and attribute suggestions for the active selector', async () => {
    const labelNames = vi.fn().mockResolvedValue({ status: 'success', data: ['__name__', 'service_name'] });
    const labelValues = vi.fn().mockResolvedValue({ status: 'success', data: ['checkout'] });
    const client = { labelNames, labelValues } as unknown as PrometheusClient;
    const suggestionArgs = {
      client,
      datasource: { kind: 'PrometheusDatasource' },
      end: new Date(2_000),
      filters: [serviceFilter],
      metricName: 'http_requests_total',
      start: new Date(1_000),
    };

    await expect(PROMETHEUS_OTEL_EXPLORER.metrics.getAttributeNames(suggestionArgs)).resolves.toEqual(['service_name']);
    await expect(
      PROMETHEUS_OTEL_EXPLORER.metrics.getAttributeValues({ ...suggestionArgs, attribute: 'service_name' }),
    ).resolves.toEqual(['checkout']);
    await expect(PROMETHEUS_OTEL_EXPLORER.metrics.getMetricNames(suggestionArgs)).resolves.toEqual(['checkout']);

    expect(labelNames).toHaveBeenCalledWith(
      {
        'match[]': ['http_requests_total{service_name="checkout"}'],
        end: 2,
        start: 1,
      },
      { signal: undefined },
    );
    expect(labelValues).toHaveBeenCalledWith(
      expect.objectContaining({ labelName: '__name__', 'match[]': ['{service_name="checkout"}'] }),
      { signal: undefined },
    );
  });
});
