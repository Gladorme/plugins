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

import { isRecord } from './click-house-client';

/** Preserve the fractional part of DateTime64(9) for trace spans. Numeric inputs are Unix milliseconds. */
export function timestampNano(value: unknown): bigint {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value * 1_000_000));
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Expected a ClickHouse date/time or Unix millisecond timestamp');
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return timestampNano(Number(value));
  }
  if (/^\d{4}-\d\d-\d\d$/.test(value)) return timestampNano(value + 'T00:00:00Z');
  const match = /^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?(Z|[+-]\d\d:\d\d)?$/.exec(value);
  if (!match) {
    throw new Error('Invalid ClickHouse timestamp: ' + value);
  }
  const millis = Date.parse(match[1] + 'T' + match[2] + (match[4] ?? 'Z'));
  if (!Number.isFinite(millis)) {
    throw new Error('Invalid ClickHouse timestamp: ' + value);
  }
  return BigInt(millis) * 1_000_000n + BigInt((match[3] ?? '').padEnd(9, '0'));
}

export function timestampMs(value: unknown): number {
  return Number(timestampNano(value)) / 1_000_000;
}

export function numericValue(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') {
    return null;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function stringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function labelsFromRecord(value: unknown, prefix = ''): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      isRecord(item) ? Object.entries(labelsFromRecord(item, prefix + key + '.')) : [[prefix + key, stringValue(item)]],
    ),
  );
}
