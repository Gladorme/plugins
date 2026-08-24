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

export type OTelSignal = (typeof OTEL_SIGNALS)[number];
export type OTelAttributeOperator = '=' | '!=' | '=~' | '!~';

export interface OTelAttributeFilter {
  id: string;
  key: string;
  operator: OTelAttributeOperator;
  value: string;
}

export interface CreateOTelQueryArgs {
  datasource: DatasourceSelector;
  filters: OTelAttributeFilter[];
}

export interface OTelSignalCapability {
  createQuery: (args: CreateOTelQueryArgs) => QueryDefinition;
}

export type OTelSignalCapabilities = Partial<Record<OTelSignal, OTelSignalCapability>>;

/**
 * Structural extension implemented by datasource plugins that can translate the explorer's common OpenTelemetry
 * attribute filters to their native query language.
 */
export interface OTelExplorerDatasourcePlugin<Spec = UnknownSpec, Client = unknown> extends DatasourcePlugin<
  Spec,
  Client
> {
  otelExplorer: OTelSignalCapabilities;
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
    return (
      typeof signalCapability === 'object' &&
      signalCapability !== null &&
      'createQuery' in signalCapability &&
      typeof signalCapability.createQuery === 'function'
    );
  });
}

export function createOTelAttributeFilter(id: string): OTelAttributeFilter {
  return { id, key: '', operator: '=', value: '' };
}

export function validAttributeFilters(filters: OTelAttributeFilter[]): OTelAttributeFilter[] {
  return filters.filter(({ key, value }) => key.trim() !== '' && value.trim() !== '');
}
