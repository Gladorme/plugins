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

import { fetchJson } from '@perses-dev/client';
import type { DatasourceSelector } from '@perses-dev/spec';

export interface MetricUsageReference {
  name: string;
  url?: string;
  description?: string;
}

export interface MetricUsageCategory {
  id: string;
  label: string;
  references: MetricUsageReference[];
}

/** Undefined means the metric is unknown; empty categories mean no collected usage. */
export interface MetricUsageProvider {
  /** Include all configuration affecting results, including tenant/auth scope, but never secrets. */
  queryKey: readonly unknown[];
  getUsage: (request: {
    metricName: string;
    datasource: DatasourceSelector;
    signal?: AbortSignal;
  }) => Promise<MetricUsageCategory[] | undefined>;
}

export interface MetricsUsageSpec {
  enable: boolean;
  /** Browser-accessible service base URL, including any reverse-proxy prefix. */
  url: string;
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid Metrics Usage response');
  }
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid Metrics Usage reference');
  return value;
}

function references(value: unknown, dashboard: boolean): MetricUsageReference[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Invalid Metrics Usage references');
  return value.map((entry: unknown) => {
    const reference = object(entry);
    return dashboard
      ? { name: string(reference.title), url: string(reference.url) }
      : {
          name: string(reference.name),
          url: string(reference.prom_link),
          description: `${string(reference.group_name)}: ${string(reference.expression)}`,
        };
  });
}

/** Adapter for https://github.com/perses/metrics-usage. */
export function createMetricsUsageProvider(
  url: string,
  doFetchJson: typeof fetchJson = fetchJson,
): MetricUsageProvider {
  const baseUrl = url.replace(/\/+$/, '');
  return {
    queryKey: ['perses-metrics-usage', baseUrl],
    getUsage: async ({ metricName, signal }) => {
      const params = new URLSearchParams({
        metric_name: metricName,
        mode: 'exact',
        merge_partial_metrics: 'true',
      });
      const response = object(await doFetchJson<unknown>(`${baseUrl}/api/v1/metrics?${params}`, { signal }));
      if (!Object.hasOwn(response, metricName)) return undefined;
      const metric = object(response[metricName]);
      const usage = metric.usage === undefined || metric.usage === null ? {} : object(metric.usage);
      return [
        { id: 'dashboards', label: 'Dashboards', references: references(usage.dashboards, true) },
        { id: 'alerts', label: 'Alerts', references: references(usage.alertRules, false) },
        { id: 'recordingRules', label: 'Recording rules', references: references(usage.recordingRules, false) },
      ];
    },
  };
}
