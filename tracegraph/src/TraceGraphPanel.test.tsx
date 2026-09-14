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

import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';

import { TraceGraphPanel } from './TraceGraphPanel';
import type { TraceGraphPanelProps } from './TraceGraphPanel';

vi.mock('@perses-dev/components', () => ({
  NoDataOverlay: ({ resource }: { resource: string }): ReactElement => <div>No {resource} data</div>,
  TextOverlay: ({ message }: { message: string }): ReactElement => <div>{message}</div>,
}));
const definition = { kind: 'TraceQuery' as const, spec: { plugin: { kind: 'TempoTraceQuery', spec: {} } } };
const emptySpec = {};
function panel(queryResults: TraceGraphPanelProps['queryResults']): void {
  render(<TraceGraphPanel spec={emptySpec} queryResults={queryResults} />);
}

it('shows the missing trace state', () => {
  panel([]);
  expect(screen.getByText('No trace data')).toBeTruthy();
});
it('rejects multiple queries', () => {
  panel([
    { definition, data: {} },
    { definition, data: {} },
  ]);
  expect(screen.getByText('This panel supports one trace query.')).toBeTruthy();
});
it('shows the empty span state', () => {
  panel([{ definition, data: { trace: { resourceSpans: [] } } }]);
  expect(screen.getByText('No spans found in this trace.')).toBeTruthy();
});

it('rejects trace search results with a useful message', () => {
  panel([{ definition, data: { searchResult: [] } }]);
  expect(screen.getByText(/Enter a trace ID/)).toBeTruthy();
});
