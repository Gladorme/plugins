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

import type { AnnotationPlugin } from '@perses-dev/plugin-system';
import type { AnnotationData } from '@perses-dev/spec';

import { executeQuery } from '../model/query';
import { labelsFromRecord, stringValue, timestampMs } from '../model/rows';
import type { ClickHouseAnnotationQuerySpec } from './types';

export const getAnnotationData: AnnotationPlugin<ClickHouseAnnotationQuerySpec>['getAnnotationData'] = async (
  spec,
  context,
  signal,
) => {
  if (!spec.query.trim()) return [];
  const { rows } = await executeQuery(spec, { ...context, timeRange: context.absoluteTimeRange }, signal);
  return rows.map((row) => {
    const start = timestampMs(row.start ?? row.Timestamp);
    const end = row.end === null || row.end === undefined ? undefined : timestampMs(row.end);
    if (end !== undefined && end < start) throw new Error('ClickHouse annotation end precedes start');
    const annotation: AnnotationData = { start };
    if (end !== undefined) annotation.end = end;
    if (row.title !== undefined) annotation.title = stringValue(row.title);
    if (row.legend !== undefined) annotation.legend = stringValue(row.legend);
    if (row.tags !== undefined) annotation.tags = labelsFromRecord(row.tags);
    return annotation;
  });
};
