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

import { DatasourceStoreContext } from '@perses-dev/plugin-system';
import type { DatasourceStore, PanelData } from '@perses-dev/plugin-system';
import type { DatasourceSelector, TimeSeriesData } from '@perses-dev/spec';
import { useContext, useEffect, useMemo, useState } from 'react';

import { getTimeSeriesExemplars, isDatasourceSelector, parseTimeSeriesExemplars } from '../utils/exemplar';
import type { TimeSeriesExemplar } from '../utils/exemplar';

interface ExemplarQueryDescriptor {
  datasource: DatasourceSelector;
  end: number;
  query: string;
  requestOptions?: Record<string, unknown>;
  start: number;
  tracingDatasource?: DatasourceSelector;
}

interface ExemplarClient {
  exemplarQuery: (
    params: { end: number; query: string; start: number },
    options?: Record<string, unknown> & { signal?: AbortSignal },
  ) => Promise<unknown>;
}

const EMPTY_EXEMPLARS: TimeSeriesExemplar[] = [];

interface FetchResult {
  exemplars: TimeSeriesExemplar[];
  requestKey: string;
}

const EMPTY_FETCH_RESULT: FetchResult = { exemplars: EMPTY_EXEMPLARS, requestKey: '' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getExemplarQueryDescriptors(queryResults: Array<PanelData<TimeSeriesData>>): ExemplarQueryDescriptor[] {
  return queryResults.flatMap(({ data }) => {
    const metadata = data.metadata;
    const candidate = metadata?.exemplarQuery;
    if (
      !isRecord(candidate) ||
      !isDatasourceSelector(candidate.datasource) ||
      typeof candidate.query !== 'string' ||
      typeof candidate.start !== 'number' ||
      typeof candidate.end !== 'number'
    ) {
      return [];
    }

    const tracingDatasource = isDatasourceSelector(metadata?.tracingDatasource)
      ? metadata.tracingDatasource
      : undefined;
    const requestOptions = isRecord(candidate.requestOptions) ? candidate.requestOptions : undefined;
    return [
      {
        datasource: candidate.datasource,
        query: candidate.query,
        ...(requestOptions ? { requestOptions } : {}),
        start: candidate.start,
        end: candidate.end,
        ...(tracingDatasource ? { tracingDatasource } : {}),
      },
    ];
  });
}

export async function fetchTimeSeriesExemplars(
  descriptors: ExemplarQueryDescriptor[],
  datasourceStore: DatasourceStore,
  signal: AbortSignal,
): Promise<TimeSeriesExemplar[]> {
  const results = await Promise.all(
    descriptors.map(async (descriptor) => {
      const client = await datasourceStore.getDatasourceClient<ExemplarClient>(descriptor.datasource);
      const response = await client.exemplarQuery(
        { query: descriptor.query, start: descriptor.start, end: descriptor.end },
        { ...descriptor.requestOptions, signal },
      );
      if (!isRecord(response) || response.status !== 'success') return [];
      return parseTimeSeriesExemplars(response.data, descriptor.tracingDatasource);
    }),
  );
  return results.flat();
}

export function useTimeSeriesExemplars(
  queryResults: Array<PanelData<TimeSeriesData>>,
  enabled: boolean,
): TimeSeriesExemplar[] {
  const datasourceStore = useContext(DatasourceStoreContext);
  const embeddedExemplars = useMemo(() => getTimeSeriesExemplars(queryResults), [queryResults]);
  const descriptors = useMemo(() => getExemplarQueryDescriptors(queryResults), [queryResults]);
  const requestKey = useMemo(() => JSON.stringify(descriptors), [descriptors]);
  const [fetchResult, setFetchResult] = useState<FetchResult>(EMPTY_FETCH_RESULT);

  useEffect(() => {
    if (!enabled || !datasourceStore || descriptors.length === 0) return;

    const abortController = new AbortController();
    void fetchTimeSeriesExemplars(descriptors, datasourceStore, abortController.signal)
      .then((exemplars) => {
        if (!abortController.signal.aborted) setFetchResult({ exemplars, requestKey });
      })
      .catch(() => undefined);

    return (): void => abortController.abort();
  }, [datasourceStore, descriptors, enabled, requestKey]);

  if (!enabled) return EMPTY_EXEMPLARS;
  const fetchedExemplars = fetchResult.requestKey === requestKey ? fetchResult.exemplars : EMPTY_EXEMPLARS;
  return [...embeddedExemplars, ...fetchedExemplars];
}
