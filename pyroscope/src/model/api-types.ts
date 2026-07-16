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

/**
 * Profile format specifying the format of the profile to be returned.
 * https://grafana.com/docs/pyroscope/latest/reference-server-api/#querying-profiling-data
 */
export type ProfileFormat =
  | 'PROFILE_FORMAT_UNSPECIFIED'
  | 'PROFILE_FORMAT_FLAMEGRAPH'
  | 'PROFILE_FORMAT_TREE'
  | 'PROFILE_FORMAT_DOT';

/**
 * Request body of Pyroscope Connect API endpoint
 * POST /querier.v1.QuerierService/SelectMergeStacktraces
 * https://grafana.com/docs/pyroscope/latest/reference-server-api/#querierv1querierserviceselectmergestacktraces
 */
export interface SelectMergeStacktracesParameters {
  /** Profile Type ID string in the form <name>:<type>:<unit>:<period_type>:<period_unit>. */
  profileTypeID: string;
  /** Label selector string. Ex: {service_name="my_service"} */
  labelSelector: string;
  /** Query from this point in time, given in milliseconds since epoch. */
  start: number;
  /** Query to this point in time, given in milliseconds since epoch. */
  end: number;
  /** Limit the nodes returned to only show the node with the max_node's biggest total. */
  maxNodes?: number;
  /** Format of the profile to be returned, default: PROFILE_FORMAT_FLAMEGRAPH. */
  format?: ProfileFormat;
}

/**
 * Response of Pyroscope Connect API endpoint
 * POST /querier.v1.QuerierService/SelectMergeStacktraces
 */
export interface SelectMergeStacktracesResponse {
  flamegraph: FlameGraph;
}

export interface FlameGraph {
  names: string[];
  levels: Level[];
  /** int64, serialized as string in the Connect JSON encoding. */
  total: number | string;
  /** int64, serialized as string in the Connect JSON encoding. */
  maxSelf: number | string;
}

export interface Level {
  /** Flat array of [offset, total, self, nameIndex] tuples. int64, serialized as strings. */
  values: Array<number | string>;
}

/**
 * Request body of Pyroscope Connect API endpoint
 * POST /querier.v1.QuerierService/SelectSeries
 * https://grafana.com/docs/pyroscope/latest/reference-server-api/#querierv1querierserviceselectseries
 */
export interface SelectSeriesParameters {
  /** Profile Type ID string in the form <name>:<type>:<unit>:<period_type>:<period_unit>. */
  profileTypeID: string;
  /** Label selector string. Ex: {service_name="my_service"} */
  labelSelector: string;
  /** Query from this point in time, given in milliseconds since epoch. */
  start: number;
  /** Query to this point in time, given in milliseconds since epoch. */
  end: number;
  /** Query resolution step width in seconds. */
  step: number;
  /** One or more label names to group the time series by. */
  groupBy?: string[];
}

/**
 * Response of Pyroscope Connect API endpoint
 * POST /querier.v1.QuerierService/SelectSeries
 */
export interface SelectSeriesResponse {
  series: Series[];
}

export interface Series {
  labels: LabelPair[];
  points: Point[];
}

export interface LabelPair {
  name: string;
  value: string;
}

export interface Point {
  value: number;
  /** Milliseconds unix timestamp. int64, serialized as string in the Connect JSON encoding. */
  timestamp: number | string;
}

/**
 * Request parameters of Pyroscope HTTP API endpoint POST /querier.v1.QuerierService/ProfileTypes
 */
export type SearchProfileTypesParameters = Record<string, never>;

/**
 * Response of Pyroscope HTTP API endpoint POST /querier.v1.QuerierService/ProfileTypes
 */
export interface SearchProfileTypesResponse {
  profileTypes: ProfileType[];
}

export interface ProfileType {
  ID: string;
  name: string;
  sampleType: string;
  sampleUnit: string;
  periodType: string;
  periodUnit: string;
}

/**
 * Request parameters of Pyroscope HTTP API endpoint POST /querier.v1.QuerierService/LabelNames
 */
export type SearchLabelNamesParameters = Record<string, never>;

/**
 * Response of Pyroscope HTTP API endpoint POST /querier.v1.QuerierService/LabelNames
 */
export interface SearchLabelNamesResponse {
  names: string[];
}

/**
 * Request parameters of Pyroscope HTTP API endpoint POST /querier.v1.QuerierService/LabelValues
 */
export type SearchLabelValuesParameters = Record<string, never>;

/**
 * Response of Pyroscope HTTP API endpoint POST /querier.v1.QuerierService/LabelValues
 */
export interface SearchLabelValuesResponse {
  names: string[];
}
