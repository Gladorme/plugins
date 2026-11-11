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

import type { ApiResponse, SuccessResponse } from './api-types';

/**
 * Throws the error sent by Prometheus when the response is an error body.
 *
 * Non-2xx responses are already turned into an error by fetchJson. Some backends and proxies are not compliant with
 * the Prometheus spec and answer a failed request with a 2xx status and an error body, which must not be read as an
 * empty result.
 * A response without status is accepted: the client answers such an object itself when it does not query Prometheus.
 */
export function assertSuccessResponse<T>(response: ApiResponse<T>): asserts response is SuccessResponse<T> {
  if (response.status === 'error') {
    throw new Error(response.error || `Prometheus query failed (${response.errorType || 'unknown error'})`);
  }
}
