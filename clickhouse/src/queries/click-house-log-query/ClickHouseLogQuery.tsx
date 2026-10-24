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

import { queryDependencies } from '../../model/query';
import { quoteIdentifier } from '../../model/sql';
import type { ClickHouseLogQuerySpec } from './click-house-log-query-types';
import { ClickHouseLogQueryEditor } from './ClickHouseLogQueryEditor';
import { getClickHouseLogData } from './get-click-house-log-data';

export const ClickHouseLogQuery: LogQueryPlugin<ClickHouseLogQuerySpec> = {
  getLogData: getClickHouseLogData,
  OptionsEditorComponent: ClickHouseLogQueryEditor,
  createInitialOptions: () => ({ query: '' }),
  dependsOn: queryDependencies,
  createVolumeQuery: (spec) => {
    if (!spec.query.trim()) return null;
    const sql = spec.query
      .trim()
      .replace(/;\s*$/, '')
      .replace(/\s+FORMAT\s+JSON\s*$/i, '');
    return {
      kind: 'TimeSeriesQuery',
      spec: {
        plugin: {
          kind: 'ClickHouseTimeSeriesQuery',
          spec: {
            datasource: spec.datasource,
            query:
              'SELECT toStartOfInterval(' +
              quoteIdentifier(spec.timeColumn ?? 'Timestamp') +
              ', INTERVAL {step} SECOND) AS time, count() AS logs\nFROM (\n' +
              sql +
              '\n) GROUP BY time ORDER BY time',
          },
        },
      },
    };
  },
};
