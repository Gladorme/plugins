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

import { applyPyroscopeAttributeFilters } from './pyroscope-otel-explorer';

const serviceFilter = {
  key: 'service_name',
  operator: '=' as const,
  value: 'checkout',
};

describe('applyPyroscopeAttributeFilters', () => {
  it('adds filters while retaining native profile filters', () => {
    expect(
      applyPyroscopeAttributeFilters([{ labelName: 'env', labelValue: 'prod', operator: '=' }], [serviceFilter], []),
    ).toEqual([
      { labelName: 'env', labelValue: 'prod', operator: '=' },
      { labelName: 'service_name', labelValue: 'checkout', operator: '=' },
    ]);
  });

  it('replaces previously applied filters', () => {
    expect(
      applyPyroscopeAttributeFilters(
        [{ labelName: 'service_name', labelValue: 'checkout', operator: '=' }],
        [{ ...serviceFilter, value: 'payments' }],
        [serviceFilter],
      ),
    ).toEqual([{ labelName: 'service_name', labelValue: 'payments', operator: '=' }]);
  });
});
