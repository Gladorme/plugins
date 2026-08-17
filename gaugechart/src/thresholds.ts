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

import { FormatOptions, StepOptions, ThresholdColorPalette, ThresholdOptions } from '@perses-dev/components';
import zip from 'lodash/zip';

export type GaugeColorStop = [number, string];

export type GaugeAxisLineColors = GaugeColorStop[];

export const defaultThresholdInput: ThresholdOptions = { steps: [{ value: 0 }] };

export function convertThresholds(
  thresholds: ThresholdOptions,
  unit: FormatOptions,
  max: number,
  palette: ThresholdColorPalette
): GaugeAxisLineColors {
  const defaultThresholdColor = thresholds.defaultColor ?? palette.defaultColor;
  const defaultThresholdSteps: GaugeAxisLineColors = [[0, defaultThresholdColor]];

  if (thresholds.steps !== undefined) {
    // Color segment stops are normalized between 0 and 1.
    const segmentMax = 1;
    const valuesArr: number[] = thresholds.steps.map((step: StepOptions) => {
      if (thresholds.mode === 'percent') {
        return step.value / 100;
      }
      return step.value / max;
    });
    valuesArr.push(segmentMax);

    const colorsArr = thresholds.steps.map((step: StepOptions, index) => step.color ?? palette.palette[index]);
    colorsArr.unshift(defaultThresholdColor);

    const zippedArr = zip(valuesArr, colorsArr);
    return zippedArr.map((elem) => {
      const convertedValues = elem[0] ?? segmentMax;
      const convertedColors = elem[1] ?? defaultThresholdColor;
      return [convertedValues, convertedColors];
    });
  } else {
    return defaultThresholdSteps;
  }
}
