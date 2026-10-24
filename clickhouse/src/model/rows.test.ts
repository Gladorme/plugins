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

import { labelsFromRecord, timestampMs, timestampNano } from './rows';

describe('ClickHouse row conversion', () => {
  it('preserves nanoseconds and treats timezone-free dates as UTC', () => {
    expect(timestampNano('2025-01-01 00:00:00.123456789')).toBe(1735689600123456789n);
    expect(timestampNano('2025-01-01T01:00:00.123456789+01:00')).toBe(1735689600123456789n);
    expect(timestampMs('2025-01-01T00:00:00.123Z')).toBe(1735689600123);
    expect(timestampMs('2025-01-01')).toBe(1735689600000);
    expect(timestampNano(0)).toBe(0n);
    expect(timestampMs('1735689600123')).toBe(1735689600123);
  });

  it.each([undefined, null, '', 'not a date', Infinity, {}])('rejects invalid timestamps: %s', (value) => {
    expect(() => timestampMs(value)).toThrow();
  });

  it('flattens maps without losing array values, zero or booleans', () => {
    expect(labelsFromRecord({ attributes: { status: 0, active: false, list: ['x', 'y'] } })).toEqual({
      'attributes.status': '0',
      'attributes.active': 'false',
      'attributes.list': '["x","y"]',
    });
  });
});
