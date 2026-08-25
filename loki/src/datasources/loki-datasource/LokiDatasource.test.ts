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

import type { LokiClient } from '../../model';
import { applyLokiAttributeFilters, LOKI_OTEL_EXPLORER } from './loki-otel-explorer';

const serviceFilter = {
  key: 'service_name',
  operator: '=' as const,
  value: 'checkout',
};

describe('applyLokiAttributeFilters', () => {
  it('adds filters while retaining the pipeline and manual matchers', () => {
    expect(applyLokiAttributeFilters('{level="error"} |= "failed"', [serviceFilter], [])).toBe(
      '{level="error",service_name="checkout"} |= "failed"',
    );
  });

  it('removes a previously applied filter', () => {
    expect(applyLokiAttributeFilters('{level="error",service_name="checkout"}', [], [serviceFilter])).toBe(
      '{level="error"}',
    );
  });
});

describe('Loki OTel explorer capability', () => {
  it('creates a native query from universal attribute filters', () => {
    expect(
      LOKI_OTEL_EXPLORER.logs.createQuery({
        datasource: { kind: 'LokiDatasource', name: 'lokidemo' },
        filters: [serviceFilter],
      }),
    ).toEqual({
      kind: 'LogQuery',
      spec: {
        plugin: {
          kind: 'LokiLogQuery',
          spec: {
            datasource: { kind: 'LokiDatasource', name: 'lokidemo' },
            query: '{service_name="checkout"}',
          },
        },
      },
    });
  });

  it('translates the dedicated log controls without rendering a Loki editor', () => {
    const query = LOKI_OTEL_EXPLORER.logs.createQuery({
      datasource: { kind: 'LokiDatasource' },
      filters: [],
      logSearch: 'request failed',
      logServiceName: 'checkout',
      logSeverity: 'error',
    });

    expect(query.spec.plugin.spec).toEqual({
      datasource: { kind: 'LokiDatasource' },
      query: '{service_name="checkout"} |= "request failed" | detected_level = "error"',
    });
  });

  it('discovers service and severity values for the dedicated controls', async () => {
    const labelValues = vi.fn().mockResolvedValue({ status: 'success', data: ['checkout'] });
    const args = {
      client: { labelValues } as unknown as LokiClient,
      datasource: { kind: 'LokiDatasource' },
      end: new Date(2_000),
      filters: [],
      start: new Date(1_000),
    };

    await expect(LOKI_OTEL_EXPLORER.logs.getSignalFieldValues({ ...args, field: 'log.service.name' })).resolves.toEqual(
      ['checkout'],
    );
    await LOKI_OTEL_EXPLORER.logs.getSignalFieldValues({ ...args, field: 'log.severity' });

    expect(labelValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ labelName: 'service_name', query: undefined }),
    );
    expect(labelValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ labelName: 'detected_level', query: undefined }),
    );
  });
});
