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

import { NoDataOverlay, TextOverlay } from '@perses-dev/components';
import type { PanelProps } from '@perses-dev/plugin-system';
import type { TraceData } from '@perses-dev/spec';
import type { ReactElement } from 'react';

import { ServiceGraph } from './ServiceGraph';
import type { TraceGraphOptions } from './trace-graph-options';

export type TraceGraphPanelProps = PanelProps<TraceGraphOptions, TraceData>;

export function TraceGraphPanel({ queryResults }: TraceGraphPanelProps): ReactElement {
  if (queryResults.length > 1) return <TextOverlay message="This panel supports one trace query." />;
  const data = queryResults[0]?.data;
  if (data?.searchResult) {
    return (
      <TextOverlay message="Enter a trace ID in the query editor to display its service graph. Trace search results are not supported." />
    );
  }
  if (!data?.trace) return <NoDataOverlay resource="trace" />;
  return <ServiceGraph trace={data.trace} />;
}
