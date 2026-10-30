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

import type { LogQueryPlugin } from '@perses-dev/plugin-system';

import { executeQuery } from '../../model/query';
import { labelsFromRecord, stringValue, timestampMs } from '../../model/rows';
import type { ClickHouseLogQuerySpec } from './click-house-log-query-types';

export const getClickHouseLogData: LogQueryPlugin<ClickHouseLogQuerySpec>['getLogData'] = async (
  spec,
  context,
  signal,
) => {
  if (!spec.query?.trim()) {
    return { logs: { entries: [], totalCount: 0 }, timeRange: context.absoluteTimeRange };
  }
  const { rows, executedQueryString } = await executeQuery(spec, context, signal);
  const entries = rows.map((row) => {
    const time = spec.timeColumn ? row[spec.timeColumn] : (row.Timestamp ?? row.timestamp ?? row.log_time ?? row.time);
    const labels = labelsFromRecord(row);
    const body = row.Body ?? row.body ?? row.message ?? row.line;
    const line =
      body === undefined
        ? Object.entries(labels)
            .filter(([key]) => !['Timestamp', 'timestamp', 'log_time', 'time'].includes(key))
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => '<' + key + '> ' + (value || '--'))
            .join(' ')
        : stringValue(body);
    return { timestamp: timestampMs(time) / 1000, line, labels };
  });
  return {
    timeRange: context.absoluteTimeRange,
    logs: { entries, totalCount: entries.length },
    metadata: { executedQueryString },
  };
};
