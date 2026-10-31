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

import type { TraceQueryPlugin } from '@perses-dev/plugin-system';

import { executeQuery, interpolateQuery } from '../../model/query';
import { quoteTable } from '../../model/sql';
import { traceDetail, traceSearch } from './trace-data';
import type { ClickHouseTraceQuerySpec } from './types';

export const getTraceData: TraceQueryPlugin<ClickHouseTraceQuerySpec>['getTraceData'] = async (
  spec,
  context,
  signal,
) => {
  if (!spec.query.trim()) return spec.mode === 'trace' ? { trace: { resourceSpans: [] } } : { searchResult: [] };
  const interpolated = interpolateQuery(spec.query, context.variableState).trim();
  const isTraceId = /^[\da-f]{32}$/i.test(interpolated);
  const querySpec = isTraceId
    ? {
        ...spec,
        query:
          'SELECT * FROM ' +
          quoteTable(spec.table ?? 'otel_traces') +
          " WHERE TraceId = '" +
          interpolated.toLowerCase() +
          "' ORDER BY Timestamp",
      }
    : spec;
  const { rows, executedQueryString } = await executeQuery(
    querySpec,
    { ...context, timeRange: context.absoluteTimeRange },
    signal,
  );
  return {
    ...(isTraceId || spec.mode === 'trace' ? { trace: traceDetail(rows) } : { searchResult: traceSearch(rows) }),
    metadata: { executedQueryString },
  };
};
