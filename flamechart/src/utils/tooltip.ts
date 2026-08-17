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

import { formatItemValue } from './format';

interface FlameTooltipDatum {
  functionName: string;
  totalPercentage: number;
  selfPercentage: number;
  self: number;
  total: number;
}

/**
 * Generates a tooltip for the flame chart items.
 */
export function generateTooltip(params: FlameTooltipDatum, unit: string | undefined): string {
  return `${params.functionName}\nTotal: ${formatItemValue(unit, params.total)} (${params.totalPercentage.toFixed(2)}%)\nSelf: ${formatItemValue(unit, params.self)} (${params.selfPercentage.toFixed(2)}%)\nSamples: ${params.total.toLocaleString()}`;
}
