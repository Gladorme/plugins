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

import type { CursorCoordinates } from '@perses-dev/components';
import { render, screen } from '@testing-library/react';

import { ExemplarTooltip } from './ExemplarTooltip';

const PINNED_POSITION: CursorCoordinates = {
  page: { x: 10, y: 10 },
  client: { x: 10, y: 10 },
  plotCanvas: { x: 10, y: 10 },
  target: null,
};
const formatTime = (): string => 'formatted time';
const handleUnpin = vi.fn();

describe('ExemplarTooltip', () => {
  it('shows trace and span IDs without requiring a DatasourceStoreContext', () => {
    render(
      <ExemplarTooltip
        color="#ff0000"
        exemplar={{
          labels: { trace_id: 'trace-123', span_id: 'span-456' },
          seriesLabels: { service: 'api' },
          timestamp: 123250,
          value: 42.5,
        }}
        formatWithUserTimeZone={formatTime}
        pinnedPos={PINNED_POSITION}
        onUnpinClick={handleUnpin}
      />,
    );

    expect(screen.getByText('Trace ID: trace-123')).toBeInTheDocument();
    expect(screen.getByText('span_id: span-456')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading trace')).not.toBeInTheDocument();
  });
});
