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

import { useDatasourceStore } from '@perses-dev/plugin-system';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { MetricUsageProvider, PrometheusClient } from '../../model';

/** Resolve the referenced service lazily, only when a visible metric requests usage. */
export function useMetricUsageProvider(
  client: PrometheusClient | undefined,
  override: MetricUsageProvider | false | undefined,
): MetricUsageProvider | undefined {
  const store = useDatasourceStore();
  const queryClient = useQueryClient();
  const selector = client?.metricUsageDatasource;
  return useMemo(() => {
    if (override === false) return undefined;
    if (override) return override;
    if (!selector) return undefined;
    return {
      queryKey: ['metrics-usage-datasource', selector],
      getUsage: async (request) => {
        const provider = await queryClient.fetchQuery({
          queryKey: ['getDatasourceClient', selector],
          queryFn: () => store.getDatasourceClient<MetricUsageProvider>(selector),
          staleTime: 60_000,
          retry: false,
        });
        request.signal?.throwIfAborted();
        return provider.getUsage(request);
      },
    };
  }, [override, selector, store, queryClient]);
}
