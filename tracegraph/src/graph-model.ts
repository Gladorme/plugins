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

import type { TraceData } from '@perses-dev/spec';

// Derive OTLP types from the public spec export instead of importing its internals.
export type Trace = NonNullable<TraceData['trace']>;
type ResourceSpans = Trace['resourceSpans'][number];
export type OtlpSpan = ResourceSpans['scopeSpans'][number]['spans'][number];
export type Attributes = NonNullable<OtlpSpan['attributes']>;

export interface GraphSpan {
  id: string;
  serviceId: string;
  serviceName: string;
  parentId?: string;
  span: OtlpSpan;
  resourceAttributes: Attributes;
}

export interface Service {
  id: string;
  name: string;
  spans: GraphSpan[];
  position: { x: number; y: number };
}

export interface Connection {
  id: string;
  source: string;
  target: string;
  span: GraphSpan;
  lane: number;
}

export interface GraphModel {
  services: Map<string, Service>;
  spans: Map<string, GraphSpan>;
  connections: Connection[];
}

function spanKey(traceId: string, spanId: string): string {
  return JSON.stringify([traceId, spanId]);
}

export function buildGraph(trace: Trace): GraphModel {
  const spans = new Map<string, GraphSpan>();
  const services = new Map<string, Service>();
  for (const resource of trace.resourceSpans ?? []) {
    const attributes = resource.resource?.attributes ?? [];
    const serviceValue = attributes.find((attribute) => attribute.key === 'service.name')?.value;
    const serviceName = serviceValue && 'stringValue' in serviceValue ? serviceValue.stringValue : undefined;
    const name = serviceName || 'unknown service';
    const serviceId = JSON.stringify(['service', serviceName || null]);
    for (const scope of resource.scopeSpans ?? []) {
      for (const span of scope.spans ?? []) {
        if (!span.traceId || !span.spanId) continue;
        const id = spanKey(span.traceId, span.spanId);
        if (spans.has(id)) continue;
        const item: GraphSpan = {
          id,
          serviceId,
          serviceName: name,
          span,
          resourceAttributes: attributes,
          parentId: span.parentSpanId ? spanKey(span.traceId, span.parentSpanId) : undefined,
        };
        spans.set(id, item);
        let service = services.get(serviceId);
        if (!service) {
          service = { id: serviceId, name, spans: [], position: { x: 0, y: 0 } };
          services.set(serviceId, service);
        }
        service.spans.push(item);
      }
    }
  }

  const connections: Connection[] = [];
  const lanes = new Map<string, number>();
  const children = new Map<string, Set<string>>();
  const incoming = new Set<string>();
  for (const item of spans.values()) {
    const parent = item.parentId ? spans.get(item.parentId) : undefined;
    if (!parent || parent.id === item.id) continue;
    // Count both directions together so returning and repeated calls remain individually selectable.
    const pair = JSON.stringify([parent.serviceId, item.serviceId].toSorted());
    const lane = lanes.get(pair) ?? 0;
    lanes.set(pair, lane + 1);
    connections.push({ id: item.id, source: parent.serviceId, target: item.serviceId, span: item, lane });
    if (parent.serviceId !== item.serviceId) {
      const targets = children.get(parent.serviceId) ?? new Set<string>();
      targets.add(item.serviceId);
      children.set(parent.serviceId, targets);
      incoming.add(item.serviceId);
    }
  }

  // Breadth-first service layout, with a visited set for recursive calls and disconnected traces.
  const visited = new Set<string>();
  const rows = new Map<number, number>();
  const roots = [...services.keys()].filter((id) => !incoming.has(id));
  for (const root of [...roots, ...services.keys()]) {
    if (visited.has(root)) continue;
    const queue = [{ id: root, depth: 0 }];
    visited.add(root);
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      if (!current) continue;
      const service = services.get(current.id);
      const row = rows.get(current.depth) ?? 0;
      if (service) service.position = { x: current.depth * 340, y: row * 200 };
      rows.set(current.depth, row + 1);
      for (const child of children.get(current.id) ?? []) {
        if (visited.has(child)) continue;
        visited.add(child);
        queue.push({ id: child, depth: current.depth + 1 });
      }
    }
  }
  return { services, spans, connections };
}

/** Follow actual span parents, never all incoming service edges (which would include unrelated branches). */
export function getAncestorSpanIds(model: GraphModel, spanId: string): Set<string> {
  const path = new Set<string>();
  let current = model.spans.get(spanId);
  while (current && !path.has(current.id)) {
    path.add(current.id);
    current = current.parentId ? model.spans.get(current.parentId) : undefined;
  }
  return path;
}

export function durationLabel(span: OtlpSpan): string {
  if (!/^\d+$/.test(span.startTimeUnixNano) || !/^\d+$/.test(span.endTimeUnixNano)) return 'Unknown duration';
  const duration = BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano);
  if (duration < 0n) return 'Unknown duration';
  return `${(Number(duration) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 3 })} ms`;
}
