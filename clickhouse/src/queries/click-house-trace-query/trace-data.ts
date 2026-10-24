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

import type { otlpcommonv1, otlptracev1, TraceSearchResult } from '@perses-dev/spec';

import { isRecord } from '../../model/click-house-client';
import { stringValue, timestampNano } from '../../model/rows';

interface TraceSpan {
  // The shared OTLP model describes a subset; retain the exporter's trace state as well.
  span: otlptracev1.Span & { traceState: string; links: Array<otlptracev1.Link & { traceState: string }> };
  service: string;
  resource: otlpcommonv1.KeyValue[];
  scopeName: string;
  scopeVersion: string;
}

function anyValue(value: unknown): otlpcommonv1.AnyValue {
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(anyValue) } };
  if (isRecord(value)) return { kvlistValue: { values: attributes(value) } };
  return { stringValue: stringValue(value) };
}

function attributes(value: unknown): otlpcommonv1.KeyValue[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([key, item]) => ({ key, value: anyValue(item) }));
}

function nestedArray(row: Record<string, unknown>, group: string, key: string): unknown[] {
  const nested = row[group];
  const value = row[group + '.' + key] ?? (isRecord(nested) ? nested[key] : undefined);
  return Array.isArray(value) ? value : [];
}

function statusCode(value: unknown): otlptracev1.Status['code'] {
  const status = stringValue(value).toUpperCase();
  if (['ERROR', 'STATUS_CODE_ERROR', '2'].includes(status)) return 'STATUS_CODE_ERROR';
  if (['OK', 'STATUS_CODE_OK', '1'].includes(status)) return 'STATUS_CODE_OK';
  return 'STATUS_CODE_UNSET';
}

function durationNano(value: unknown): bigint {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) {
    throw new Error('ClickHouse trace queries must return Duration as an integer number of nanoseconds');
  }
  return BigInt(value);
}

function readSpan(row: Record<string, unknown>): TraceSpan {
  const traceId = stringValue(row.TraceId);
  const spanId = stringValue(row.SpanId);
  if (!/^[\da-f]{32}$/i.test(traceId) || !/^[\da-f]{16}$/i.test(spanId)) {
    throw new Error('ClickHouse trace queries must return TraceId (32 hex digits) and SpanId (16 hex digits)');
  }
  const start = timestampNano(row.Timestamp);
  const service = stringValue(row.ServiceName) || 'unknown';
  const eventsTime = nestedArray(row, 'Events', 'Timestamp');
  const eventsAttributes = nestedArray(row, 'Events', 'Attributes');
  const linkSpanIds = nestedArray(row, 'Links', 'SpanId');
  const linkTraceStates = nestedArray(row, 'Links', 'TraceState');
  const linkAttributes = nestedArray(row, 'Links', 'Attributes');
  const rawKind = stringValue(row.SpanKind)
    .toUpperCase()
    .replace(/^SPAN_KIND_/, '');
  const kind = ['INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER'].includes(rawKind)
    ? 'SPAN_KIND_' + rawKind
    : 'SPAN_KIND_UNSPECIFIED';
  return {
    service,
    resource: attributes({
      ...(isRecord(row.ResourceAttributes) ? row.ResourceAttributes : {}),
      'service.name': service,
    }),
    scopeName: stringValue(row.ScopeName),
    scopeVersion: stringValue(row.ScopeVersion),
    span: {
      traceId: traceId.toLowerCase(),
      traceState: stringValue(row.TraceState),
      spanId: spanId.toLowerCase(),
      parentSpanId: stringValue(row.ParentSpanId).toLowerCase(),
      name: stringValue(row.SpanName),
      kind,
      startTimeUnixNano: String(start),
      endTimeUnixNano: String(start + durationNano(row.Duration)),
      attributes: attributes(row.SpanAttributes),
      status: { code: statusCode(row.StatusCode), message: stringValue(row.StatusMessage) },
      events: nestedArray(row, 'Events', 'Name').map((name, i) => ({
        name: stringValue(name),
        timeUnixNano: String(timestampNano(eventsTime[i])),
        attributes: attributes(eventsAttributes[i]),
      })),
      links: nestedArray(row, 'Links', 'TraceId').map((id, i) => ({
        traceId: stringValue(id),
        spanId: stringValue(linkSpanIds[i]),
        traceState: stringValue(linkTraceStates[i]),
        attributes: attributes(linkAttributes[i]),
      })),
    },
  };
}

function readSpans(rows: Array<Record<string, unknown>>): TraceSpan[] {
  return rows
    .map(readSpan)
    .toSorted((a, b) => Number(BigInt(a.span.startTimeUnixNano) - BigInt(b.span.startTimeUnixNano)));
}

export function traceSearch(rows: Array<Record<string, unknown>>): TraceSearchResult[] {
  const traces = new Map<string, { result: TraceSearchResult; end: number; hasRoot: boolean }>();
  for (const { span, service } of readSpans(rows)) {
    const start = Number(BigInt(span.startTimeUnixNano)) / 1_000_000;
    const end = Number(BigInt(span.endTimeUnixNano)) / 1_000_000;
    const isRoot = !span.parentSpanId || /^0+$/.test(span.parentSpanId);
    let trace = traces.get(span.traceId);
    if (!trace) {
      trace = {
        result: {
          traceId: span.traceId,
          rootServiceName: service,
          rootTraceName: span.name,
          startTimeUnixMs: start,
          durationMs: 0,
          serviceStats: {},
        },
        end,
        hasRoot: false,
      };
      traces.set(span.traceId, trace);
    }
    trace.end = Math.max(trace.end, end);
    trace.result.durationMs = trace.end - trace.result.startTimeUnixMs;
    if (isRoot && !trace.hasRoot) {
      trace.result.rootServiceName = service;
      trace.result.rootTraceName = span.name;
      trace.hasRoot = true;
    }
    const stats = Object.hasOwn(trace.result.serviceStats, service) ? trace.result.serviceStats[service] : undefined;
    const errorCount = (stats?.errorCount ?? 0) + (span.status?.code === 'STATUS_CODE_ERROR' ? 1 : 0);
    Object.defineProperty(trace.result.serviceStats, service, {
      value: { spanCount: (stats?.spanCount ?? 0) + 1, ...(errorCount ? { errorCount } : {}) },
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return [...traces.values()].map(({ result }) => result).toSorted((a, b) => b.startTimeUnixMs - a.startTimeUnixMs);
}

export function traceDetail(rows: Array<Record<string, unknown>>): otlptracev1.TracesData {
  const spans = readSpans(rows);
  if (new Set(spans.map(({ span }) => span.traceId)).size > 1) {
    throw new Error('Trace detail must return one trace. Filter by TraceId or use Trace search mode.');
  }
  const groups = new Map<string, otlptracev1.ResourceSpan>();
  for (const { span, resource, scopeName, scopeVersion } of spans) {
    const key = JSON.stringify([resource, scopeName, scopeVersion]);
    const group = groups.get(key);
    if (group) {
      group.scopeSpans[0]?.spans.push(span);
    } else {
      groups.set(key, {
        resource: { attributes: resource },
        scopeSpans: [{ scope: { name: scopeName, version: scopeVersion }, spans: [span] }],
      });
    }
  }
  return { resourceSpans: [...groups.values()] };
}
