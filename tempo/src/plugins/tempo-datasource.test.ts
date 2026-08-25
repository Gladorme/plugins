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

import type { TempoClient } from '../model';
import { applyTempoAttributeFilters, TEMPO_OTEL_EXPLORER } from './tempo-otel-explorer';

const serviceFilter = {
  key: 'resource.service.name',
  operator: '=' as const,
  value: 'checkout',
};

describe('applyTempoAttributeFilters', () => {
  it('adds filters while retaining native TraceQL matchers and pipelines', () => {
    expect(applyTempoAttributeFilters('{ duration > 1s } | count()', [serviceFilter], [])).toBe(
      '{ duration > 1s && resource.service.name = "checkout" } | count()',
    );
  });

  it('replaces a previously applied filter', () => {
    expect(
      applyTempoAttributeFilters(
        '{ resource.service.name = "checkout" }',
        [{ ...serviceFilter, value: 'payments' }],
        [serviceFilter],
      ),
    ).toBe('{ resource.service.name = "payments" }');
  });
});

describe('Tempo OTel explorer capability', () => {
  it('creates a native query from universal attribute filters', () => {
    expect(
      TEMPO_OTEL_EXPLORER.traces.createQuery({
        datasource: { kind: 'TempoDatasource', name: 'tempodemo' },
        filters: [serviceFilter],
      }),
    ).toEqual({
      kind: 'TraceQuery',
      spec: {
        plugin: {
          kind: 'TempoTraceQuery',
          spec: {
            datasource: { kind: 'TempoDatasource', name: 'tempodemo' },
            limit: 20,
            query: '{ resource.service.name = "checkout" }',
          },
        },
      },
    });
  });

  it('translates service, span, status, and duration controls to TraceQL', () => {
    const query = TEMPO_OTEL_EXPLORER.traces.createQuery({
      datasource: { kind: 'TempoDatasource' },
      filters: [],
      traceMaxDuration: '2s',
      traceMinDuration: '100ms',
      traceServiceName: 'checkout',
      traceSpanName: 'POST /orders',
      traceStatus: 'error',
    });

    expect(query.spec.plugin.spec).toEqual({
      datasource: { kind: 'TempoDatasource' },
      limit: 20,
      query:
        '{ resource.service.name = "checkout" && name = "POST /orders" && status = error && duration >= 100ms && duration <= 2s }',
    });
  });

  it('discovers service and span names for the dedicated controls', async () => {
    const searchTagValues = vi.fn().mockResolvedValue({ tagValues: [{ value: 'checkout' }] });
    const args = {
      client: { searchTagValues } as unknown as TempoClient,
      datasource: { kind: 'TempoDatasource' },
      end: new Date(2_000),
      filters: [],
      start: new Date(1_000),
      traceServiceName: 'checkout',
    };

    await expect(
      TEMPO_OTEL_EXPLORER.traces.getSignalFieldValues({ ...args, field: 'trace.service.name' }),
    ).resolves.toEqual(['checkout']);
    await TEMPO_OTEL_EXPLORER.traces.getSignalFieldValues({ ...args, field: 'trace.span.name' });

    expect(searchTagValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ q: '{}', tag: 'resource.service.name' }),
    );
    expect(searchTagValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ q: '{ resource.service.name = "checkout" }', tag: 'name' }),
    );
  });
});
