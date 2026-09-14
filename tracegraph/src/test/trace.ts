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

import type { Trace, OtlpSpan } from '../graph-model';

export function makeSpan(spanId: string, parentSpanId?: string, fields: Partial<OtlpSpan> = {}): OtlpSpan {
  return {
    traceId: 'trace-1',
    spanId,
    parentSpanId,
    name: spanId,
    startTimeUnixNano: '1750000000000000000',
    endTimeUnixNano: '1750000000001000000',
    ...fields,
  };
}

export const trace: Trace = {
  resourceSpans: [
    {
      resource: { attributes: [{ key: 'service.name', value: { stringValue: 'frontend' } }] },
      scopeSpans: [{ spans: [makeSpan('request'), makeSpan('prepare', 'request')] }],
    },
    {
      resource: { attributes: [{ key: 'service.name', value: { stringValue: 'api' } }] },
      scopeSpans: [{ spans: [makeSpan('checkout', 'prepare'), makeSpan('catalog', 'request')] }],
    },
    {
      resource: { attributes: [{ key: 'service.name', value: { stringValue: 'database' } }] },
      scopeSpans: [
        {
          spans: [
            makeSpan('insert', 'checkout', {
              attributes: [{ key: 'db.operation.name', value: { stringValue: 'INSERT' } }],
              status: { code: 'STATUS_CODE_ERROR', message: 'Write failed' },
              events: [{ name: 'exception', timeUnixNano: '1750000000000500000' }],
            }),
            makeSpan('select', 'catalog'),
          ],
        },
      ],
    },
  ],
};
