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
import type { DatasourcePlugin } from '@perses-dev/plugin-system';
import type { HTTPProxy } from '@perses-dev/spec';

import { createMetricsUsageProvider } from '../model/metric-usage';
import type { MetricUsageProvider } from '../model/metric-usage';
import { MetricsUsageDatasourceEditor } from './MetricsUsageDatasourceEditor';

export interface MetricsUsageDatasourceSpec {
  directUrl?: string;
  proxy?: HTTPProxy;
}

export const MetricsUsageDatasource: DatasourcePlugin<MetricsUsageDatasourceSpec, MetricUsageProvider> = {
  createClient: (spec, options) => {
    const url = spec.directUrl ?? options.proxyUrl;
    if (!url?.trim()) throw new Error('No URL specified for Metrics Usage datasource.');
    const doFetchJson = options.fetchJson ?? fetchJson;
    return createMetricsUsageProvider(url, (input, init) =>
      doFetchJson(input, { ...init, headers: spec.proxy?.spec.headers }),
    );
  },
  OptionsEditorComponent: MetricsUsageDatasourceEditor,
  createInitialOptions: () => ({ directUrl: '' }),
};
