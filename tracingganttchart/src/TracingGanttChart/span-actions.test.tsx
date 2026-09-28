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

import { SelectionProvider, useSelection } from '@perses-dev/components';
import type * as otlptracev1 from '@perses-dev/spec/dist/dashboard/query-type/otlp/trace/v1/trace';
import { renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import * as exampleTrace from '../test/traces/example_otlp.json';
import type { SpanActionData } from './span-actions';
import { getSpanActionData, useSpanSelection } from './span-actions';
import type { Span } from './trace';
import { getTraceModel } from './trace';

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  return <SelectionProvider>{children}</SelectionProvider>;
}

describe('getSpanActionData', () => {
  const trace = getTraceModel(exampleTrace as otlptracev1.TracesData);

  it('returns span, trace and flattened attribute data', () => {
    const span = trace.spanById.get('sid2')!;

    expect(getSpanActionData(trace, span)).toEqual({
      traceId: '5B8EFFF798038103D269B633813FC60C',
      spanId: 'sid2',
      parentSpanId: 'sid1',
      name: 'testChildSpan2',
      kind: 'SPAN_KIND_CLIENT',
      serviceName: 'shop-backend',
      startTimeUnixMs: expect.closeTo(1100),
      endTimeUnixMs: expect.closeTo(1200),
      durationMs: expect.closeTo(100),
      statusCode: 'STATUS_CODE_ERROR',
      statusMessage: 'Forbidden',
      scopeName: 'k6',
      scopeVersion: undefined,
      traceStartTimeUnixMs: expect.closeTo(1000),
      traceEndTimeUnixMs: expect.closeTo(2000),
      'resource.service.name': 'shop-backend',
      'attributes.http.method': 'DELETE',
    });
  });

  it('converts attribute values', () => {
    const span = {
      ...trace.spanById.get('sid1')!,
      attributes: [
        { key: 'int', value: { intValue: '42' } },
        { key: 'double', value: { doubleValue: 4.2 } },
        { key: 'bool', value: { boolValue: true } },
        { key: 'array', value: { arrayValue: { values: [{ stringValue: 'a' }, { intValue: '1' }] } } },
      ],
    };

    expect(getSpanActionData(trace, span)).toMatchObject({
      'attributes.int': '42',
      'attributes.double': 4.2,
      'attributes.bool': true,
      'attributes.array': ['a', '1'],
    });
  });
});

describe('useSpanSelection', () => {
  const trace = getTraceModel(exampleTrace as otlptracev1.TracesData);
  const span = trace.spanById.get('sid2')!;

  function useSelectionMap(selectedSpan: Span | undefined, enabled: boolean): Map<string, SpanActionData> {
    useSpanSelection(trace, selectedSpan, enabled);
    return useSelection<SpanActionData, string>().selectionMap;
  }

  it('exposes the selected span as selection when enabled', () => {
    const { result, rerender } = renderHook(({ selectedSpan }) => useSelectionMap(selectedSpan, true), {
      wrapper: Wrapper,
      initialProps: { selectedSpan: span as Span | undefined },
    });
    expect([...result.current.keys()]).toEqual(['sid2']);
    expect(result.current.get('sid2')).toMatchObject({ spanId: 'sid2', 'attributes.http.method': 'DELETE' });

    rerender({ selectedSpan: undefined });
    expect(result.current.size).toBe(0);
  });

  it('does not expose the selected span when disabled', () => {
    const { result } = renderHook(() => useSelectionMap(span, false), { wrapper: Wrapper });
    expect(result.current.size).toBe(0);
  });
});
