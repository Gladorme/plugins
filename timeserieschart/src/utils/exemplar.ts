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

import type { DatasourceSelector, TimeSeries, TimeSeriesData, TimeSeriesValueTuple } from '@perses-dev/spec';
import type { LineSeriesOption } from 'echarts';

export interface TimeSeriesExemplar {
  labels: Record<string, string>;
  seriesLabels: Record<string, string>;
  timestamp: number;
  tracingDatasource?: DatasourceSelector;
  value: number;
}

export interface TraceSummary {
  durationMs?: number;
  operationName?: string;
  serviceName?: string;
  spanCount: number;
}

interface TimeSeriesResult {
  data: TimeSeriesData;
}

const DIMMED_EXEMPLAR_OPACITY = 0.3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

export function isDatasourceSelector(value: unknown): value is DatasourceSelector {
  return (
    isRecord(value) && typeof value.kind === 'string' && (value.name === undefined || typeof value.name === 'string')
  );
}

export function getTimeSeriesExemplars(queryResults: TimeSeriesResult[]): TimeSeriesExemplar[] {
  return queryResults.flatMap(({ data }) => {
    const metadata = data.metadata;
    if (!metadata) return [];
    return parseTimeSeriesExemplars(metadata.exemplars, metadata.tracingDatasource);
  });
}

export function parseTimeSeriesExemplars(
  exemplarData: unknown,
  tracingDatasourceValue?: unknown,
): TimeSeriesExemplar[] {
  if (!Array.isArray(exemplarData)) return [];
  const tracingDatasource = isDatasourceSelector(tracingDatasourceValue) ? tracingDatasourceValue : undefined;

  return exemplarData.flatMap((group) => {
    if (!isRecord(group) || !isStringRecord(group.seriesLabels) || !Array.isArray(group.exemplars)) return [];
    const seriesLabels = group.seriesLabels;

    return group.exemplars.flatMap((exemplar) => {
      if (
        !isRecord(exemplar) ||
        !isStringRecord(exemplar.labels) ||
        typeof exemplar.value !== 'string' ||
        typeof exemplar.timestamp !== 'number'
      ) {
        return [];
      }

      const value = Number(exemplar.value);
      if (!Number.isFinite(value)) return [];

      return [
        {
          labels: exemplar.labels,
          seriesLabels,
          timestamp: exemplar.timestamp * 1000,
          ...(tracingDatasource ? { tracingDatasource } : {}),
          value,
        },
      ];
    });
  });
}

export function getExemplarTraceId(exemplar: TimeSeriesExemplar): string | undefined {
  return exemplar.labels.trace_id ?? exemplar.labels.traceID ?? exemplar.labels.traceId;
}

/** Build a dedicated mark-point series so exemplar interaction does not affect metric datasets. */
export function buildExemplarSeries(
  exemplars: TimeSeriesExemplar[],
  color: string,
  timeSeries: TimeSeries[] = [],
  activeExemplar?: TimeSeriesExemplar | null,
): LineSeriesOption[] {
  if (exemplars.length === 0) return [];

  const seriesByLabels = new Map<string, TimeSeries>();
  const labeledTimeSeries: TimeSeries[] = [];
  for (const series of timeSeries) {
    if (series.labels) {
      seriesByLabels.set(getLabelsKey(series.labels), series);
      labeledTimeSeries.push(series);
    }
  }
  const activeExemplarIndex = getActiveExemplarIndex(exemplars, activeExemplar);

  return [
    {
      id: '__perses_exemplars',
      type: 'line',
      data: [],
      silent: false,
      z: 100,
      markPoint: {
        silent: false,
        symbol: 'diamond',
        symbolSize: 12,
        label: { show: false },
        data: exemplars.map((exemplar, exemplarIndex) => {
          const matchingSeries = getMatchingTimeSeries(exemplar.seriesLabels, seriesByLabels, labeledTimeSeries);
          return {
            name: getExemplarTraceId(exemplar) ?? `Exemplar ${exemplarIndex + 1}`,
            coord: [exemplar.timestamp, getRenderedValue(matchingSeries?.values, exemplar.timestamp) ?? exemplar.value],
            exemplarIndex,
            itemStyle: {
              color,
              ...(activeExemplarIndex >= 0
                ? { opacity: exemplarIndex === activeExemplarIndex ? 1 : DIMMED_EXEMPLAR_OPACITY }
                : {}),
            },
          };
        }),
      },
    },
  ];
}

function getActiveExemplarIndex(
  exemplars: TimeSeriesExemplar[],
  activeExemplar: TimeSeriesExemplar | null | undefined,
): number {
  if (!activeExemplar) return -1;

  const referenceIndex = exemplars.findIndex((exemplar) => exemplar === activeExemplar);
  if (referenceIndex >= 0) return referenceIndex;

  const activeKey = getExemplarKey(activeExemplar);
  return exemplars.findIndex((exemplar) => getExemplarKey(exemplar) === activeKey);
}

function getExemplarKey(exemplar: TimeSeriesExemplar): string {
  return `${exemplar.timestamp}:${exemplar.value}:${getLabelsKey(exemplar.seriesLabels)}:${getLabelsKey(exemplar.labels)}`;
}

function getMatchingTimeSeries(
  exemplarLabels: Record<string, string>,
  seriesByLabels: Map<string, TimeSeries>,
  timeSeries: TimeSeries[],
): TimeSeries | undefined {
  const exactMatch = seriesByLabels.get(getLabelsKey(exemplarLabels));
  if (exactMatch) return exactMatch;

  let bestMatch: TimeSeries | undefined;
  let bestScore = 0;
  for (const series of timeSeries) {
    let score = 0;
    let conflict = false;
    for (const [labelName, labelValue] of Object.entries(series.labels ?? {})) {
      const exemplarValue = exemplarLabels[labelName];
      if (exemplarValue === undefined) continue;
      if (exemplarValue !== labelValue) {
        conflict = true;
        break;
      }
      score += 1;
    }
    if (!conflict && score > bestScore) {
      bestMatch = series;
      bestScore = score;
    }
  }

  return bestMatch ?? timeSeries[0];
}

function getLabelsKey(labels: Record<string, string>): string {
  return JSON.stringify(Object.entries(labels).toSorted(([left], [right]) => left.localeCompare(right)));
}

function getRenderedValue(values: TimeSeriesValueTuple[] | undefined, timestamp: number): number | undefined {
  if (!values || values.length === 0) return undefined;

  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const middleTimestamp = values[middle]?.[0];
    if (middleTimestamp !== undefined && middleTimestamp < timestamp) low = middle + 1;
    else high = middle;
  }

  const next = values[low];
  const previous = values[low - 1];
  const nextValue = typeof next?.[1] === 'number' ? next[1] : undefined;
  const previousValue = typeof previous?.[1] === 'number' ? previous[1] : undefined;
  if (next?.[0] === timestamp) return nextValue;
  if (previousValue === undefined) return nextValue;
  if (nextValue === undefined || next === undefined || previous === undefined) return previousValue;

  const interval = next[0] - previous[0];
  if (interval <= 0) return previousValue;
  return previousValue + ((nextValue - previousValue) * (timestamp - previous[0])) / interval;
}

export interface TraceClient {
  getTrace?: (traceId: string) => Promise<unknown>;
  query?: (params: { traceId: string }) => Promise<unknown>;
}

export async function loadTraceSummary(client: TraceClient, traceId: string): Promise<TraceSummary> {
  if (client.query) {
    return summarizeTempoTrace(await client.query({ traceId }));
  }
  if (client.getTrace) {
    return summarizeJaegerTrace(await client.getTrace(traceId));
  }
  throw new Error('The selected datasource does not support trace lookup');
}

function summarizeTempoTrace(response: unknown): TraceSummary {
  if (!isRecord(response) || !isRecord(response.trace) || !Array.isArray(response.trace.resourceSpans)) {
    throw new Error('The tracing datasource returned an invalid trace');
  }

  let serviceName: string | undefined;
  const spans: Array<Record<string, unknown>> = [];
  for (const resourceSpan of response.trace.resourceSpans) {
    if (!isRecord(resourceSpan)) continue;
    if (!serviceName && isRecord(resourceSpan.resource) && Array.isArray(resourceSpan.resource.attributes)) {
      serviceName = findOtlpStringAttribute(resourceSpan.resource.attributes, 'service.name');
    }
    if (!Array.isArray(resourceSpan.scopeSpans)) continue;
    for (const scopeSpan of resourceSpan.scopeSpans) {
      if (isRecord(scopeSpan) && Array.isArray(scopeSpan.spans)) {
        spans.push(...scopeSpan.spans.filter(isRecord));
      }
    }
  }

  const rootSpan = spans.find((span) => isEmptySpanId(span.parentSpanId)) ?? spans[0];
  const start = rootSpan ? toFiniteNumber(rootSpan.startTimeUnixNano) : undefined;
  const end = rootSpan ? toFiniteNumber(rootSpan.endTimeUnixNano) : undefined;
  return {
    serviceName,
    operationName: rootSpan && typeof rootSpan.name === 'string' ? rootSpan.name : undefined,
    durationMs: start !== undefined && end !== undefined ? (end - start) / 1_000_000 : undefined,
    spanCount: spans.length,
  };
}

function summarizeJaegerTrace(response: unknown): TraceSummary {
  if (!isRecord(response) || !Array.isArray(response.data) || !isRecord(response.data[0])) {
    throw new Error('The tracing datasource returned an invalid trace');
  }
  const trace = response.data[0];
  const spans = Array.isArray(trace.spans) ? trace.spans.filter(isRecord) : [];
  const rootSpan =
    spans.find(
      (span) =>
        !Array.isArray(span.references) ||
        !span.references.some((reference) => isRecord(reference) && reference.refType === 'CHILD_OF'),
    ) ?? spans[0];

  let serviceName: string | undefined;
  if (rootSpan && typeof rootSpan.processID === 'string' && isRecord(trace.processes)) {
    const process = trace.processes[rootSpan.processID];
    if (isRecord(process) && typeof process.serviceName === 'string') serviceName = process.serviceName;
  }

  const durationMicros = rootSpan ? toFiniteNumber(rootSpan.duration) : undefined;
  return {
    serviceName,
    operationName: rootSpan && typeof rootSpan.operationName === 'string' ? rootSpan.operationName : undefined,
    durationMs: durationMicros === undefined ? undefined : durationMicros / 1000,
    spanCount: spans.length,
  };
}

function findOtlpStringAttribute(attributes: unknown[], key: string): string | undefined {
  const attribute = attributes.find((item) => isRecord(item) && item.key === key);
  if (!isRecord(attribute) || !isRecord(attribute.value)) return undefined;
  return typeof attribute.value.stringValue === 'string' ? attribute.value.stringValue : undefined;
}

function isEmptySpanId(value: unknown): boolean {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
