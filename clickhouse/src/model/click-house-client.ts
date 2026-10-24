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

import type { FetchFn, RequestHeaders } from '@perses-dev/client';

export interface ClickHouseQueryParams {
  query: string;
  start?: string;
  end?: string;
  database?: string;
}

export interface ClickHouseQueryOptions {
  datasourceUrl: string;
  headers?: RequestHeaders;
  fetch?: FetchFn;
  signal?: AbortSignal;
}

export interface ClickHouseColumn {
  name: string;
  type: string;
}

export interface ClickHouseQueryResponse {
  status: 'success' | 'error';
  data: unknown;
  meta?: ClickHouseColumn[];
}

export interface ClickHouseClient {
  query: (
    params: ClickHouseQueryParams,
    headers?: RequestHeaders,
    signal?: AbortSignal,
  ) => Promise<ClickHouseQueryResponse>;
}

export function replaceTimeRangePlaceholders(sql: string, start?: string, end?: string): string {
  return sql.replaceAll('{start}', start ?? '{start}').replaceAll('{end}', end ?? '{end}');
}

export function formatClickHouseDateTime(date: Date): string {
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/(?:\.000)?Z$/, '');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isColumn(value: unknown): value is ClickHouseColumn {
  return isRecord(value) && typeof value.name === 'string' && typeof value.type === 'string';
}

export function getRows(response: ClickHouseQueryResponse): Array<Record<string, unknown>> {
  if (response.status === 'error') {
    throw new Error('ClickHouse query failed');
  }
  if (!Array.isArray(response.data) || !response.data.every(isRecord)) {
    throw new Error('ClickHouse queries must return JSON rows. Remove any FORMAT clause or use FORMAT JSON.');
  }
  return response.data;
}

export async function query(
  params: ClickHouseQueryParams,
  queryOptions: ClickHouseQueryOptions,
): Promise<ClickHouseQueryResponse> {
  const { datasourceUrl, headers, fetch: customFetch, signal } = queryOptions;
  if (!params.query.trim()) {
    throw new Error('No query provided in params');
  }
  const url = new URL(datasourceUrl, globalThis.location?.origin);
  url.searchParams.set('query', replaceTimeRangePlaceholders(params.query.trim(), params.start, params.end));
  // A URL setting avoids mistaking SQL identifiers, strings or comments for a FORMAT clause.
  url.searchParams.set('default_format', 'JSON');
  url.searchParams.set('date_time_output_format', 'iso');
  // Keep UInt64 timestamps and addresses exact before JSON.parse converts numeric literals to doubles.
  url.searchParams.set('output_format_json_quote_64bit_integers', '1');
  if (params.database !== undefined) {
    url.searchParams.set('database', params.database);
  }

  const response = await (customFetch ?? fetch)(url.toString(), { method: 'GET', headers, signal });
  if (!response.ok) {
    throw new Error('ClickHouse query failed (' + response.status + '): ' + (await response.text()).slice(0, 2000));
  }
  const body: unknown = await response.json();
  const result: ClickHouseQueryResponse = {
    status: 'success',
    data: isRecord(body) ? body.data : body,
    meta: isRecord(body) && Array.isArray(body.meta) && body.meta.every(isColumn) ? body.meta : undefined,
  };
  getRows(result);
  return result;
}
