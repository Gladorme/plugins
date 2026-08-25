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

import { DatasourcePlugin } from '@perses-dev/plugin-system';
import { DatasourceSelector, QueryDefinition, UnknownSpec } from '@perses-dev/spec';

export const OTEL_SIGNALS = ['metrics', 'logs', 'traces', 'profiles'] as const;
const OTEL_SUGGESTION_METHODS = [
  'getAttributeNames',
  'getAttributeValues',
  'getMetricNames',
  'getSignalFieldValues',
] as const;

export type OTelSignal = (typeof OTEL_SIGNALS)[number];
export type OTelAttributeOperator = '=' | '!=' | '=~' | '!~';
export type OTelMetricsQueryMode = 'range' | 'instant';
export type OTelTraceStatus = '' | 'unset' | 'ok' | 'error';
export type OTelSignalField =
  | 'log.service.name'
  | 'log.severity'
  | 'trace.service.name'
  | 'trace.span.name'
  | 'profile.service.name'
  | 'profile.type';

export interface OTelAttributeFilter {
  id: string;
  key: string;
  operator: OTelAttributeOperator;
  value: string;
}

export interface OTelSignalInputs {
  logSearch: string;
  logServiceName: string;
  logSeverity: string;
  metricName: string;
  metricsQueryMode: OTelMetricsQueryMode;
  profileServiceName: string;
  profileType: string;
  traceMaxDuration: string;
  traceMinDuration: string;
  traceServiceName: string;
  traceSpanName: string;
  traceStatus: OTelTraceStatus;
}

export interface CreateOTelQueryArgs extends Partial<OTelSignalInputs> {
  datasource: DatasourceSelector;
  filters: OTelAttributeFilter[];
}

export interface OTelSuggestionArgs<Client = unknown> extends CreateOTelQueryArgs {
  abortSignal?: AbortSignal;
  client: Client;
  end: Date;
  start: Date;
}

export interface OTelAttributeValueSuggestionArgs<Client = unknown> extends OTelSuggestionArgs<Client> {
  attribute: string;
}

export interface OTelSignalFieldValueSuggestionArgs<Client = unknown> extends OTelSuggestionArgs<Client> {
  field: OTelSignalField;
}

export interface OTelSignalCapability<Client = unknown> {
  createQuery: (args: CreateOTelQueryArgs) => QueryDefinition;
  getAttributeNames?: (args: OTelSuggestionArgs<Client>) => Promise<string[]>;
  getAttributeValues?: (args: OTelAttributeValueSuggestionArgs<Client>) => Promise<string[]>;
  getMetricNames?: (args: OTelSuggestionArgs<Client>) => Promise<string[]>;
  getSignalFieldValues?: (args: OTelSignalFieldValueSuggestionArgs<Client>) => Promise<string[]>;
}

export type OTelSignalCapabilities<Client = unknown> = Partial<Record<OTelSignal, OTelSignalCapability<Client>>>;

/**
 * Structural extension implemented by datasource plugins that translate the explorer's common OpenTelemetry filters
 * to their native query language and can optionally provide autocomplete suggestions.
 */
export interface OTelExplorerDatasourcePlugin<Spec = UnknownSpec, Client = unknown> extends DatasourcePlugin<
  Spec,
  Client
> {
  otelExplorer: OTelSignalCapabilities<Client>;
}

export function isOTelExplorerDatasourcePlugin(
  plugin: DatasourcePlugin,
): plugin is OTelExplorerDatasourcePlugin<UnknownSpec, unknown> {
  const capability = (plugin as DatasourcePlugin & { otelExplorer?: unknown }).otelExplorer;
  if (typeof capability !== 'object' || capability === null) {
    return false;
  }

  return OTEL_SIGNALS.some((signal) => {
    const signalCapability = (capability as Record<string, unknown>)[signal];
    if (typeof signalCapability !== 'object' || signalCapability === null) {
      return false;
    }
    const methods = signalCapability as Record<string, unknown>;
    return (
      typeof methods.createQuery === 'function' &&
      OTEL_SUGGESTION_METHODS.every((method) => methods[method] === undefined || typeof methods[method] === 'function')
    );
  });
}

export function createOTelAttributeFilter(id: string): OTelAttributeFilter {
  return { id, key: '', operator: '=', value: '' };
}

export function validAttributeFilters(filters: OTelAttributeFilter[]): OTelAttributeFilter[] {
  return filters.filter(({ key, value }) => key.trim() !== '' && value.trim() !== '');
}

const OTEL_DURATION_PATTERN = /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:ns|us|ms|s|m|h)$/;

export function isValidOTelDuration(value: string): boolean {
  return value === '' || OTEL_DURATION_PATTERN.test(value);
}
