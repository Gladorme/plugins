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

import { applyPrometheusAttributeFilters } from './prometheus-otel-explorer';

const serviceFilter = {
  key: 'service_name',
  operator: '=' as const,
  value: 'checkout',
};

describe('applyPrometheusAttributeFilters', () => {
  it('adds filters while retaining manual matchers', () => {
    expect(applyPrometheusAttributeFilters('http_requests_total{method="GET"}', [serviceFilter], [])).toBe(
      'http_requests_total{method="GET",service_name="checkout"}',
    );
  });

  it('replaces previously applied filters', () => {
    expect(
      applyPrometheusAttributeFilters(
        'http_requests_total{method="GET",service_name="checkout"}',
        [{ ...serviceFilter, value: 'payments' }],
        [serviceFilter],
      ),
    ).toBe('http_requests_total{method="GET",service_name="payments"}');
  });
});
