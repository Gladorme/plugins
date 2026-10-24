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

import type { ProfileQueryContext, VariableStateMap } from '@perses-dev/plugin-system';
import type { AbsoluteTimeRange, ProfileData, StackTrace, Timeline } from '@perses-dev/spec';

import { executeQuery, queryDependencies } from '../../model/query';
import { numericValue, timestampNano } from '../../model/rows';
import type { ClickHouseProfileQuerySpec } from './types';

type Row = Record<string, unknown>;
type Point = { time?: bigint; value: number };
interface Node {
  name: string;
  total: number;
  self: number;
  children: Map<string, Node>;
}

function array(value: unknown, name: string, optional = false): unknown[] {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value)) throw new Error('ClickHouse profiles require an array for ' + name);
  return value;
}

function text(value: unknown, name: string, fallback = ''): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new Error('ClickHouse profiles require a string for ' + name);
  return value;
}

function weight(value: unknown): number {
  const result = numericValue(value);
  if (result === null || result < 0 || result > Number.MAX_SAFE_INTEGER) {
    throw new Error('ClickHouse profile values must be finite, nonnegative numbers within the safe integer range');
  }
  return result;
}

function add(a: number, b: number): number {
  return weight(a + b);
}

function nanos(value: unknown): bigint {
  if (
    (typeof value !== 'string' || !/^\d+$/.test(value)) &&
    (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
  ) {
    throw new Error('ClickHouse profile nanosecond timestamps must be unsigned integer strings or safe integers');
  }
  return BigInt(value);
}

function stack(row: Row, native: boolean): string[] {
  if (!native) {
    const names = array(row.stack, 'stack').map((name) => text(name, 'stack'));
    return names.length ? names.map((name) => name || '[unknown]') : ['[unknown]'];
  }
  const names = array(row.FunctionNames, 'FunctionNames');
  const files = array(row.FileNames, 'FileNames', true);
  const lines = array(row.LineNumbers, 'LineNumbers', true);
  const mappings = array(row.MappingFileNames, 'MappingFileNames', true);
  const addresses = array(row.Addresses, 'Addresses', true);
  for (const values of [files, lines, mappings, addresses]) {
    if (values.length && values.length !== names.length) {
      throw new Error('ClickHouse profile frame arrays must have matching lengths');
    }
  }
  const frames = names.map((rawName, index) => {
    const name = text(rawName, 'FunctionNames');
    const file = text(files[index], 'FileNames');
    const line = numericValue(lines[index]);
    const mapping = text(mappings[index], 'MappingFileNames');
    if (name) return name + (file ? ' (' + file + (line && line > 0 ? ':' + line : '') + ')' : '');
    // Keep unsymbolized frames separate, including UInt64 addresses above JavaScript's safe integer range.
    const address = addresses[index] === undefined ? undefined : nanos(addresses[index]);
    const location = address === undefined ? '' : '0x' + address.toString(16);
    return [mapping, file, location].filter(Boolean).join(' ') || '[unknown]';
  });
  // Collector stacks and inline frames are leaf first; Perses expects callers above callees.
  return frames.length ? frames.toReversed() : ['[unknown]'];
}

function samplePoints(row: Row, native: boolean): Point[] {
  if (!native) {
    return [{ value: weight(row.value), time: row.time === undefined ? undefined : timestampNano(row.time) }];
  }
  const values = array(row.Values, 'Values');
  const times = array(row.TimestampsUnixNano, 'TimestampsUnixNano', true);
  if (values.length && times.length && values.length !== times.length) {
    throw new Error('ClickHouse profile Values and TimestampsUnixNano must have matching lengths');
  }
  if (!values.length && !times.length) {
    throw new Error('ClickHouse profile samples require Values or TimestampsUnixNano');
  }
  if (times.length) {
    return times.map((time, index) => ({ time: nanos(time), value: values.length ? weight(values[index]) : 1 }));
  }
  // Untimed aggregated observations belong to the profile collection timestamp.
  const time = timestampNano(row.Timestamp);
  return values.map((value) => ({ time, value: weight(value) }));
}

function unit(value: string): string {
  if (value === 'ns') return 'nanoseconds';
  if (value === 'By') return 'bytes';
  if (value === '1') return 'count';
  return value;
}

function node(name: string): Node {
  return { name, total: 0, self: 0, children: new Map() };
}

function layout(root: Node): { stackTrace: StackTrace; maxSelf: number } {
  let id = 1;
  let maxSelf = 0;
  const stackTrace: StackTrace = {
    id: root.total ? id++ : 0,
    name: root.name,
    level: 0,
    start: 0,
    end: root.total,
    self: root.self,
    total: root.total,
    children: [],
  };
  const pending = [{ source: root, target: stackTrace }];
  // Iterative traversal also supports deeply nested profiles without overflowing the JS call stack.
  while (pending.length) {
    const entry = pending.pop();
    if (!entry) break;
    const { source, target } = entry;
    maxSelf = Math.max(maxSelf, source.self);
    let cursor = target.start + source.self;
    for (const child of [...source.children.values()].toSorted((a, b) => a.name.localeCompare(b.name))) {
      const result: StackTrace = {
        id: id++,
        name: child.name,
        level: target.level + 1,
        start: cursor,
        end: cursor + child.total,
        self: child.self,
        total: child.total,
        children: [],
      };
      target.children.push(result);
      pending.push({ source: child, target: result });
      cursor += child.total;
    }
  }
  return { stackTrace, maxSelf };
}

function timeline(points: Point[], range?: AbsoluteTimeRange): Timeline {
  const empty = { startTime: (range?.start.getTime() ?? 0) / 1000, durationDelta: 1, samples: [] };
  if (!points.length || points.some((point) => point.time === undefined)) return empty;
  let first = range ? BigInt(range.start.getTime()) * 1_000_000n : undefined;
  let last = range ? BigInt(range.end.getTime()) * 1_000_000n : undefined;
  for (const point of points) {
    if (point.time === undefined || range) continue;
    if (first === undefined || point.time < first) first = point.time;
    if (last === undefined || point.time > last) last = point.time;
  }
  if (first === undefined || last === undefined) return empty;
  const second = 1_000_000_000n;
  const startSecond = first / second - (first < 0n && first % second !== 0n ? 1n : 0n);
  const startNano = startSecond * second;
  const maxBins = 1000n;
  const step = (last - startNano + second * maxBins - 1n) / (second * maxBins);
  const durationDelta = Number(step > 0n ? step : 1n);
  const stepNano = BigInt(durationDelta) * second;
  const samples = Array<number>(Number((last - startNano) / stepNano) + 1).fill(0);
  for (const point of points) {
    if (point.time === undefined) continue;
    // Bucket before converting to numbers so a timestamp one nanosecond before a boundary stays in its bucket.
    const index = Number((point.time - startNano) / stepNano);
    const current = samples[index];
    if (current !== undefined) samples[index] = add(current, point.value);
  }
  const startTime = Number(startSecond);
  return { startTime, durationDelta, samples };
}

export function buildProfileData(rows: Row[], range?: AbsoluteTimeRange, executedQueryString?: string): ProfileData {
  const root = node('total');
  const observations: Point[] = [];
  let sampleType: string | undefined;
  let sampleUnit: string | undefined;
  const start = range ? BigInt(range.start.getTime()) * 1_000_000n : undefined;
  const end = range ? BigInt(range.end.getTime()) * 1_000_000n : undefined;
  if (start !== undefined && end !== undefined && end < start) throw new Error('Invalid profile time range');
  for (const row of rows) {
    const native = Object.hasOwn(row, 'FunctionNames');
    const type = text(row.SampleType ?? row.sampleType, 'SampleType', native ? '' : 'samples');
    const units = unit(text(row.SampleUnit ?? row.unit, 'SampleUnit', native ? '' : 'count'));
    if (native && (!type || !units)) {
      throw new Error('ClickHouse Collector profiles require SampleType and SampleUnit columns');
    }
    if ((sampleType !== undefined && sampleType !== type) || (sampleUnit !== undefined && sampleUnit !== units)) {
      throw new Error('ClickHouse profiles require one SampleType and SampleUnit; filter them in SQL');
    }
    sampleType = type;
    sampleUnit = units;
    const frames = stack(row, native);
    const selected = samplePoints(row, native).filter(
      ({ time }) =>
        time === undefined || ((start === undefined || time >= start) && (end === undefined || time <= end)),
    );
    const total = selected.reduce((sum, point) => add(sum, point.value), 0);
    for (const point of selected) observations.push(point);
    if (total === 0) continue;
    root.total = add(root.total, total);
    let current = root;
    for (const name of frames) {
      let child = current.children.get(name);
      if (!child) {
        child = node(name);
        current.children.set(name, child);
      }
      child.total = add(child.total, total);
      current = child;
    }
    current.self = add(current.self, total);
  }
  const { stackTrace, maxSelf } = layout(root);
  return {
    profile: { stackTrace },
    numTicks: root.total,
    maxSelf,
    timeline: timeline(observations, range),
    metadata: { spyName: '', sampleRate: 0, name: sampleType ?? '', units: sampleUnit ?? '', executedQueryString },
  };
}

export async function getProfileData(
  spec: ClickHouseProfileQuerySpec,
  context: ProfileQueryContext & { variableState?: VariableStateMap },
  signal?: AbortSignal,
): Promise<ProfileData> {
  if (!spec.query?.trim()) return buildProfileData([], context.absoluteTimeRange);
  if (!context.variableState && queryDependencies(spec).variables.length) {
    throw new Error('ClickHouse profile variables require a Perses host with profile variable support');
  }
  const { rows, executedQueryString } = await executeQuery(
    spec,
    { ...context, timeRange: context.absoluteTimeRange, variableState: context.variableState ?? {} },
    signal,
  );
  return buildProfileData(rows, context.absoluteTimeRange, executedQueryString);
}
