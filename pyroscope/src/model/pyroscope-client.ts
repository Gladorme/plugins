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

import { DatasourceClient } from '@perses-dev/plugin-system';
import { RequestHeaders } from '@perses-dev/client';
import {
  SelectMergeStacktracesParameters,
  SelectMergeStacktracesResponse,
  SelectSeriesParameters,
  SelectSeriesResponse,
  SearchProfileTypesParameters,
  SearchProfileTypesResponse,
  SearchLabelNamesParameters,
  SearchLabelNamesResponse,
  SearchLabelValuesParameters,
  SearchLabelValuesResponse,
} from './api-types';

interface PyroscopeClientOptions {
  datasourceUrl: string;
  headers?: RequestHeaders;
}

export interface PyroscopeClient extends DatasourceClient {
  options: PyroscopeClientOptions;
  selectMergeStacktraces(
    params: SelectMergeStacktracesParameters,
    headers?: RequestHeaders
  ): Promise<SelectMergeStacktracesResponse>;
  selectSeries(params: SelectSeriesParameters, headers?: RequestHeaders): Promise<SelectSeriesResponse>;
  searchProfileTypes(
    params: SearchProfileTypesParameters,
    headers: RequestHeaders,
    body: Record<string, string | number>
  ): Promise<SearchProfileTypesResponse>;
  searchLabelNames(
    params: SearchLabelNamesParameters,
    headers: RequestHeaders,
    body: Record<string, string | number>
  ): Promise<SearchLabelNamesResponse>;
  searchLabelValues(
    params: SearchLabelValuesParameters,
    headers: RequestHeaders,
    body: Record<string, string | number>
  ): Promise<SearchLabelValuesResponse>;
  searchServices(
    params: SearchLabelValuesParameters,
    headers: RequestHeaders,
    body: Record<string, string | number>
  ): Promise<SearchLabelValuesResponse>;
}

export interface QueryOptions {
  datasourceUrl: string;
  headers?: RequestHeaders;
}

export const executeRequest = async <T>(...args: Parameters<typeof global.fetch>): Promise<T> => {
  const response = await fetch(...args);
  try {
    return await response.json();
  } catch (e) {
    console.error('Invalid response from server', e);
    throw new Error('Invalid response from server');
  }
};

function fetchWithPost<T, TResponse, TBody = Record<string, unknown>>(
  apiURI: string,
  params: T | null,
  queryOptions: QueryOptions,
  body: TBody
): Promise<TResponse> {
  const { datasourceUrl, headers = {} } = queryOptions;

  let url = `${datasourceUrl}${apiURI}`;
  if (params) {
    url += '?' + new URLSearchParams(params);
  }
  const init = {
    method: 'POST',
    // The Connect API expects a JSON body. Callers may still override the content-type if needed.
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };

  return executeRequest<TResponse>(url, init);
}

/**
 * Returns matching profiles aggregated in a flame graph format.
 * Connect API: POST /querier.v1.QuerierService/SelectMergeStacktraces
 */
export function selectMergeStacktraces(
  params: SelectMergeStacktracesParameters,
  queryOptions: QueryOptions
): Promise<SelectMergeStacktracesResponse> {
  return fetchWithPost<null, SelectMergeStacktracesResponse, SelectMergeStacktracesParameters>(
    '/querier.v1.QuerierService/SelectMergeStacktraces',
    null,
    queryOptions,
    params
  );
}

/**
 * Returns a time series for the total sum of the requested profiles.
 * Connect API: POST /querier.v1.QuerierService/SelectSeries
 */
export function selectSeries(
  params: SelectSeriesParameters,
  queryOptions: QueryOptions
): Promise<SelectSeriesResponse> {
  return fetchWithPost<null, SelectSeriesResponse, SelectSeriesParameters>(
    '/querier.v1.QuerierService/SelectSeries',
    null,
    queryOptions,
    params
  );
}

/**
 * Returns a list of all profile types.
 */
export function searchProfileTypes(
  params: SearchProfileTypesParameters,
  queryOptions: QueryOptions,
  body: Record<string, string | number>
): Promise<SearchProfileTypesResponse> {
  return fetchWithPost<SearchProfileTypesParameters, SearchProfileTypesResponse>(
    '/querier.v1.QuerierService/ProfileTypes',
    params,
    queryOptions,
    body
  );
}

/**
 * Returns a list of all label names.
 */
export function searchLabelNames(
  params: SearchLabelNamesParameters,
  queryOptions: QueryOptions,
  body: Record<string, string | number>
): Promise<SearchLabelNamesResponse> {
  return fetchWithPost<SearchLabelNamesParameters, SearchLabelNamesResponse>(
    '/querier.v1.QuerierService/LabelNames',
    params,
    queryOptions,
    body
  );
}

/**
 * Returns a list of all label values for a given label name.
 */
export function searchLabelValues(
  params: SearchLabelValuesParameters,
  queryOptions: QueryOptions,
  body: Record<string, string | number>
): Promise<SearchLabelValuesResponse> {
  return fetchWithPost<SearchLabelValuesParameters, SearchLabelValuesResponse>(
    '/querier.v1.QuerierService/LabelValues',
    params,
    queryOptions,
    body
  );
}

/**
 * Returns a list of all services.
 * This is a special case of label values where the label name is "service_name".
 */
export function searchServices(
  params: SearchLabelValuesParameters,
  queryOptions: QueryOptions,
  body: Record<string, string | number>
): Promise<SearchLabelValuesResponse> {
  return fetchWithPost<SearchLabelValuesParameters, SearchLabelValuesResponse>(
    '/querier.v1.QuerierService/LabelValues',
    params,
    queryOptions,
    { name: 'service_name', ...body }
  );
}
