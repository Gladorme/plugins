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

import { createContext } from '../../../test/context';
import { PROFILE_EXAMPLE } from '../../components/query-examples';
import { ClickHouseProfileQuery } from './ClickHouseProfileQuery';
import { buildProfileData, getProfileData } from './get-profile-data';

const TIME = '2025-01-01T00:00:00Z';
const NANO = 1735689600000000000n;
const RANGE = { start: new Date(TIME), end: new Date('2025-01-01T00:00:02Z') };
const NATIVE = {
  Timestamp: TIME,
  SampleType: 'cpu',
  SampleUnit: 'nanoseconds',
  FunctionNames: ['parse', 'handle', 'main'],
  Values: ['2', '3'],
  TimestampsUnixNano: [String(NANO), String(NANO + 1_000_000_000n)],
};

it('merges shared prefixes with correct inclusive totals, self values and disjoint flame widths', () => {
  const data = buildProfileData([
    { stack: ['main', 'parse'], value: 3 },
    { stack: ['main'], value: 5 },
    { stack: ['main', 'parse'], value: 2 },
    { stack: ['main', 'render'], value: 4 },
  ]);
  expect(data.numTicks).toBe(14);
  expect(data.maxSelf).toBe(5);
  const root = data.profile.stackTrace;
  expect(root).toMatchObject({ id: 1, level: 0, start: 0, end: 14, total: 14, self: 0 });
  expect(root.children).toHaveLength(1);
  expect(root.children[0]).toMatchObject({
    name: 'main',
    total: 14,
    self: 5,
    start: 0,
    end: 14,
    children: [
      { name: 'parse', total: 5, self: 5, start: 5, end: 10 },
      { name: 'render', total: 4, self: 4, start: 10, end: 14 },
    ],
  });
  expect(data.timeline?.samples).toEqual([]);
});

it('converts Collector leaf-first stacks and per-observation weights without multiplying by Period', () => {
  const data = buildProfileData([{ ...NATIVE, Period: 10_000_000 }], RANGE);
  expect(data).toMatchObject({ numTicks: 5, maxSelf: 5, metadata: { name: 'cpu', units: 'nanoseconds' } });
  expect(data.profile.stackTrace.children[0]).toMatchObject({
    name: 'main',
    children: [{ name: 'handle', children: [{ name: 'parse', total: 5, self: 5 }] }],
  });
  expect(data.timeline).toEqual({ startTime: Number(NANO) / 1e9, durationDelta: 1, samples: [2, 3, 0] });
});

it('counts timestamp-only observations and clips nanosecond boundaries before converting time to numbers', () => {
  const data = buildProfileData(
    [
      {
        ...NATIVE,
        Values: [],
        TimestampsUnixNano: [String(NANO - 1n), String(NANO), String(NANO + 1n), String(NANO + 2_000_000_000n + 1n)],
      },
    ],
    RANGE,
  );
  expect(data.numTicks).toBe(2);
  expect(data.timeline?.samples).toEqual([2, 0, 0]);
});

it('supports values-only profiles at Timestamp and preserves source and unsymbolized frame identities', () => {
  const data = buildProfileData(
    [
      {
        ...NATIVE,
        Values: ['7'],
        TimestampsUnixNano: [],
        FunctionNames: ['', 'inline', 'caller'],
        FileNames: ['', 'app.go', 'app.go'],
        LineNumbers: [0, 10, 20],
        MappingFileNames: ['binary', '', ''],
        Addresses: ['18446744073709551615', '0', '0'],
      },
    ],
    RANGE,
  );
  expect(data.profile.stackTrace.children[0]).toMatchObject({
    name: 'caller (app.go:20)',
    children: [{ name: 'inline (app.go:10)', children: [{ name: 'binary 0xffffffffffffffff', self: 7 }] }],
  });
  expect(data.timeline?.samples).toEqual([7, 0, 0]);
});

it('keeps recursive call sites separate and handles empty or unnamed stacks', () => {
  const data = buildProfileData([
    { stack: ['recurse', 'recurse'], value: 2 },
    { stack: [], value: 1 },
    { stack: [''], value: 3 },
  ]);
  expect(data.profile.stackTrace.children).toMatchObject([
    { name: '[unknown]', self: 4 },
    { name: 'recurse', self: 0, children: [{ name: 'recurse', self: 2 }] },
  ]);
  expect(buildProfileData([]).profile.stackTrace.id).toBe(0);
  expect(buildProfileData([{ stack: ['zero'], value: 0 }]).profile.stackTrace.children).toEqual([]);
});

it('retains custom time/value aliases and normalizes common units', () => {
  const data = buildProfileData(
    [
      { stack: ['alloc'], value: '1024', time: TIME, sampleType: 'allocations', unit: 'By' },
      { stack: ['alloc'], value: 512, time: 1735689601000, sampleType: 'allocations', unit: 'bytes' },
    ],
    RANGE,
  );
  expect(data.metadata).toMatchObject({ name: 'allocations', units: 'bytes' });
  expect(data.timeline?.samples).toEqual([1024, 512, 0]);
});

it('limits the timeline to about 1000 bins and preserves totals across many rows', () => {
  const range = { start: new Date(TIME), end: new Date('2025-02-01T00:00:00Z') };
  const rows = Array.from({ length: 2000 }, (_, i) => ({
    stack: ['work'],
    value: 1,
    time: range.start.getTime() + i * 60_000,
  }));
  const data = buildProfileData(rows, range);
  expect(data.timeline?.samples.length).toBeLessThanOrEqual(1001);
  expect(data.timeline?.samples.reduce((a, b) => a + b, 0)).toBe(2000);
  expect(data.numTicks).toBe(2000);
});

it.each([
  { ...NATIVE, Values: ['1'] },
  { ...NATIVE, Values: [], TimestampsUnixNano: [] },
  { ...NATIVE, SampleUnit: undefined },
  { ...NATIVE, SampleType: '' },
  { ...NATIVE, FileNames: ['one'] },
  { ...NATIVE, TimestampsUnixNano: [Number(NANO), Number(NANO)] },
  { stack: 'not an array', value: 1 },
  { stack: ['work'], value: -1 },
  { stack: ['work'], value: 'NaN' },
  { stack: ['work'], value: '9007199254740993' },
])('rejects malformed or unrepresentable profile rows: %j', (row) => {
  expect(() => buildProfileData([row])).toThrow();
});

it('rejects mixed sample types or units instead of adding incompatible measurements', () => {
  expect(() => buildProfileData([NATIVE, { ...NATIVE, SampleType: 'memory' }])).toThrow('one SampleType');
  expect(() => buildProfileData([NATIVE, { ...NATIVE, SampleUnit: 'bytes' }])).toThrow('one SampleType');
});

it('expands SQL and datasource variables, exposes executed SQL, and forwards cancellation', async () => {
  const ctx = createContext([NATIVE]);
  ctx.variableState.service = { value: "app'one", loading: false };
  ctx.variableState.source = { value: 'profiles', loading: false };
  vi.mocked(ctx.datasourceStore.listDatasourceSelectItems).mockResolvedValue([
    {
      items: [{ name: 'profiles', selector: { kind: 'ClickHouseDatasource', name: 'profiles' } }],
    },
  ]);
  const spec = {
    datasource: '$source',
    query: "SELECT * FROM otel_profiles WHERE ServiceName IN (${service:sqlstring}) AND Timestamp >= '{start}'",
  };
  const signal = new AbortController().signal;
  const result = await getProfileData(spec, ctx, signal);
  expect(ClickHouseProfileQuery.dependsOn?.(spec, ctx).variables).toEqual(['service', 'source']);
  expect(ctx.datasourceStore.getDatasourceClient).toHaveBeenCalledWith({
    kind: 'ClickHouseDatasource',
    name: 'profiles',
  });
  expect(ctx.query).toHaveBeenCalledWith(
    { query: "SELECT * FROM otel_profiles WHERE ServiceName IN ('app''one') AND Timestamp >= '2025-01-01 00:00:00'" },
    undefined,
    signal,
  );
  expect(result.metadata?.executedQueryString).toContain("'app''one'");
});

it('propagates query failures and leaves incomplete queries idle', async () => {
  const ctx = createContext();
  expect((await getProfileData({ query: '' }, ctx)).numTicks).toBe(0);
  expect(ctx.query).not.toHaveBeenCalled();
  ctx.query.mockRejectedValue(new Error('ClickHouse unavailable'));
  await expect(getProfileData({ query: PROFILE_EXAMPLE }, ctx)).rejects.toThrow('ClickHouse unavailable');
});

it('keeps observations on opposite sides of a nanosecond bucket boundary separate', () => {
  const rows = [{ ...NATIVE, TimestampsUnixNano: [String(NANO + 999_999_999n), String(NANO + 1_000_000_000n)] }];
  expect(buildProfileData(rows, RANGE).timeline?.samples).toEqual([2, 3, 0]);
  expect(buildProfileData(rows).timeline).toEqual({
    startTime: Number(NANO / 1_000_000_000n),
    durationDelta: 1,
    samples: [2, 3],
  });
});
