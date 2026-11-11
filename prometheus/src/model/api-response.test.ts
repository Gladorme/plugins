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

import { assertSuccessResponse } from './api-response';
import type { ApiResponse } from './api-types';

describe('assertSuccessResponse', () => {
  it('should not throw when the response is a success', () => {
    const response: ApiResponse<string[]> = { status: 'success', data: ['job'] };

    expect(() => assertSuccessResponse(response)).not.toThrow();
  });

  it('should not throw when the response has no status', () => {
    const response = { data: [] } as unknown as ApiResponse<string[]>;

    expect(() => assertSuccessResponse(response)).not.toThrow();
  });

  it('should throw the error text of an error body', () => {
    const response: ApiResponse<string[]> = { status: 'error', errorType: 'bad_data', error: 'invalid parameter' };

    expect(() => assertSuccessResponse(response)).toThrow('invalid parameter');
  });

  it('should throw a fallback message when the error body has no error text', () => {
    const response = { status: 'error', errorType: 'bad_data' } as unknown as ApiResponse<string[]>;

    expect(() => assertSuccessResponse(response)).toThrow('Prometheus query failed (bad_data)');
  });

  it('should throw a fallback message when the error body has neither an error text nor an error type', () => {
    const response = { status: 'error' } as unknown as ApiResponse<string[]>;

    expect(() => assertSuccessResponse(response)).toThrow('Prometheus query failed (unknown error)');
  });
});
