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

import { buildGraph, durationLabel, getAncestorSpanIds } from './graph-model';
import type { Trace } from './graph-model';
import { makeSpan, trace } from './test/trace';

describe('trace graph', () => {
  it('groups services and preserves parallel calls and internal spans', () => {
    const model = buildGraph(trace);
    expect([...model.services.values()].map((service) => [service.name, service.spans.length])).toEqual([
      ['frontend', 2],
      ['api', 2],
      ['database', 2],
    ]);
    expect(model.connections).toHaveLength(5);
    const internal = model.connections.find((edge) => edge.span.span.spanId === 'prepare');
    expect(internal?.source).toBe(internal?.target);
    const calls = model.connections.filter((edge) => edge.span.serviceName === 'api');
    expect(calls.map((edge) => edge.lane)).toEqual([0, 1]);
    expect(new Set([...model.services.values()].map((service) => JSON.stringify(service.position))).size).toBe(3);
  });

  it('highlights only the selected span and its actual parent chain', () => {
    const model = buildGraph(trace);
    const edge = model.connections.find((item) => item.span.span.spanId === 'insert');
    expect(edge).toBeDefined();
    const path = getAncestorSpanIds(model, edge?.id ?? '');
    expect([...path].map((id) => model.spans.get(id)?.span.spanId)).toEqual([
      'insert',
      'checkout',
      'prepare',
      'request',
    ]);
    expect(model.connections.filter((item) => path.has(item.id)).map((item) => item.span.span.spanId)).toEqual([
      'prepare',
      'checkout',
      'insert',
    ]);
  });

  it('keeps roots and missing parents without inventing edges', () => {
    const incomplete: Trace = {
      resourceSpans: [{ scopeSpans: [{ spans: [makeSpan('orphan', 'missing'), makeSpan('root')] }] }],
    };
    const model = buildGraph(incomplete);
    expect([...model.services.values()][0]?.name).toBe('unknown service');
    expect(model.spans.size).toBe(2);
    expect(model.connections).toHaveLength(0);
    expect(getAncestorSpanIds(model, [...model.spans.keys()][0] ?? '').size).toBe(1);
  });

  it('scopes parent lookup to the trace and deduplicates repeated spans', () => {
    const model = buildGraph({
      resourceSpans: [
        {
          scopeSpans: [
            { spans: [makeSpan('root'), makeSpan('root'), makeSpan('child', 'root', { traceId: 'other-trace' })] },
          ],
        },
      ],
    });
    expect(model.spans.size).toBe(2);
    expect(model.connections).toHaveLength(0);
  });

  it('terminates on cyclic and self-parent input', () => {
    const model = buildGraph({
      resourceSpans: [{ scopeSpans: [{ spans: [makeSpan('a', 'b'), makeSpan('b', 'a'), makeSpan('self', 'self')] }] }],
    });
    expect(getAncestorSpanIds(model, [...model.spans.keys()][0] ?? '').size).toBe(2);
    expect(model.connections).toHaveLength(2);
  });

  it('handles empty traces', () => {
    expect(buildGraph({ resourceSpans: [] }).services.size).toBe(0);
  });

  it('computes sub-millisecond durations without losing Unix nanosecond precision', () => {
    expect(durationLabel(makeSpan('a', undefined, { endTimeUnixNano: '1750000000000001000' }))).toBe('0.001 ms');
    expect(durationLabel(makeSpan('a', undefined, { endTimeUnixNano: 'invalid' }))).toBe('Unknown duration');
    expect(durationLabel(makeSpan('a', undefined, { endTimeUnixNano: '0' }))).toBe('Unknown duration');
  });
});
