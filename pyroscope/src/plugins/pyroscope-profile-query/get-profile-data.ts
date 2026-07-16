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

import { ProfileQueryPlugin } from '@perses-dev/plugin-system';
import { getUnixTime } from 'date-fns';
import { AbsoluteTimeRange, ProfileData, StackTrace } from '@perses-dev/spec';
import {
  PyroscopeProfileQuerySpec,
  PYROSCOPE_DATASOURCE_KIND,
  PyroscopeDatasourceSelector,
  PyroscopeClient,
  SelectMergeStacktracesParameters,
  SelectMergeStacktracesResponse,
  SelectSeriesParameters,
  SelectSeriesResponse,
} from '../../model';
import { computeFilterExpr } from '../../utils/types';

// Pyroscope's Connect API expects timestamps in milliseconds, but the time range from Perses is in seconds.
const MILLISECONDS = 1_000;
// The default time range used when none is provided (last hour).
const DEFAULT_RANGE_MS = 60 * 60 * MILLISECONDS;
// The Pyroscope render endpoint used a minimum timeline resolution of 10 seconds.
const MIN_STEP_SECONDS = 10;
// Target number of points for the timeline series, used to derive the query step.
const TARGET_TIMELINE_POINTS = 300;

export function getUnixTimeRange(timeRange: AbsoluteTimeRange): { start: number; end: number } {
  const { start, end } = timeRange;
  return {
    start: Math.ceil(getUnixTime(start)),
    end: Math.ceil(getUnixTime(end)),
  };
}

/**
 * Derives the query resolution step (in seconds) from the time range, keeping at least
 * the 10 second minimum resolution that the legacy render endpoint enforced.
 */
function computeStep(startMs: number, endMs: number): number {
  const durationSeconds = (endMs - startMs) / MILLISECONDS;
  return Math.max(MIN_STEP_SECONDS, Math.floor(durationSeconds / TARGET_TIMELINE_POINTS));
}

export const getProfileData: ProfileQueryPlugin<PyroscopeProfileQuerySpec>['getProfileData'] = async (
  spec,
  context
) => {
  const defaultPyroscopeDatasource: PyroscopeDatasourceSelector = {
    kind: PYROSCOPE_DATASOURCE_KIND,
  };

  const client: PyroscopeClient = await context.datasourceStore.getDatasourceClient(
    spec.datasource ?? defaultPyroscopeDatasource
  );

  // The Connect API splits the profile type and the label selectors, unlike the legacy
  // render endpoint that expected a single PromQL-like query string.
  const buildLabelSelector = (): string => {
    const parts: string[] = [];
    if (spec.service) {
      parts.push(`service_name="${spec.service}"`);
    }
    if (spec.filters && spec.filters.length > 0) {
      const filterExpr = computeFilterExpr(spec.filters);
      if (filterExpr !== '') {
        parts.push(filterExpr);
      }
    }
    return `{${parts.join(',')}}`;
  };

  // Resolve the time range (in milliseconds) from the UI selection, defaulting to the last hour.
  let startMs: number;
  let endMs: number;
  if (context.absoluteTimeRange) {
    const { start, end } = getUnixTimeRange(context.absoluteTimeRange);
    startMs = start * MILLISECONDS;
    endMs = end * MILLISECONDS;
  } else {
    endMs = Date.now();
    startMs = endMs - DEFAULT_RANGE_MS;
  }

  const labelSelector = buildLabelSelector();
  const step = computeStep(startMs, endMs);

  const stacktracesParams: SelectMergeStacktracesParameters = {
    profileTypeID: spec.profileType,
    labelSelector,
    start: startMs,
    end: endMs,
  };
  if (spec.maxNodes) {
    stacktracesParams.maxNodes = spec.maxNodes;
  }

  const seriesParams: SelectSeriesParameters = {
    profileTypeID: spec.profileType,
    labelSelector,
    start: startMs,
    end: endMs,
    step,
  };

  // The flame graph and the timeline come from two distinct Connect endpoints. Both are
  // required to reconstruct the ProfileData that the legacy render endpoint returned in one call.
  const [stacktracesResponse, seriesResponse] = await Promise.all([
    client.selectMergeStacktraces(stacktracesParams),
    client.selectSeries(seriesParams),
  ]);

  return transformProfileResponse(stacktracesResponse, seriesResponse, spec.profileType, step);
};

/**
 * Extracts the display unit from a profile type ID of the form
 * <name>:<sample_type>:<sample_unit>:<period_type>:<period_unit>.
 * The sample unit (third segment) is what the flame graph uses for value formatting.
 */
function extractUnits(profileTypeID: string): string {
  return profileTypeID.split(':')[2] ?? '';
}

/**
 * Transforms the Connect API responses (flame graph + time series) into the Perses profile format.
 */
function transformProfileResponse(
  stacktracesResponse: SelectMergeStacktracesResponse,
  seriesResponse: SelectSeriesResponse,
  profileTypeID: string,
  step: number
): ProfileData {
  const newResponse: ProfileData = {
    profile: {
      stackTrace: {} as StackTrace,
    },
    numTicks: 0,
    maxSelf: 0,
    metadata: {
      spyName: '',
      sampleRate: 0,
      units: extractUnits(profileTypeID),
      name: profileTypeID,
    },
    timeline: {
      startTime: 0,
      samples: [],
      durationDelta: 0,
    },
  };

  const flamegraph = stacktracesResponse?.flamegraph;
  if (!flamegraph) {
    return newResponse;
  }

  const stackTraces: StackTrace[][] = [];

  // stackTraces id from 1
  let id = 1;
  // Set the profile stackTrace property
  for (let i = 0; i < flamegraph.levels.length; i++) {
    let current = 0;
    const row: StackTrace[] = [];

    const level = flamegraph.levels[i];

    if (!level) {
      continue;
    }

    const values = level.values;

    for (let j = 0; j < values.length; j += 4) {
      const temp: StackTrace = {} as StackTrace;
      temp.id = id;
      id += 1;
      const indexInNamesArray = values[j + 3]; // index in names array
      if (indexInNamesArray !== undefined) {
        const name = flamegraph.names[Number(indexInNamesArray)];

        if (name) {
          temp.name = name;
        }
      }
      temp.level = i;

      const total = values[j + 1];
      if (total !== undefined) {
        temp.total = Number(total);
      }

      const self = values[j + 2];

      if (self !== undefined) {
        temp.self = Number(self);
      }

      // start and end
      const offset = values[j];
      if (offset !== undefined) {
        current += Number(offset); // current += offset
      }
      temp.start = current;
      if (total !== undefined) {
        current += Number(total); // current += total
      }
      temp.end = current;

      temp.children = [];

      row.push(temp);
    }

    stackTraces.push(row);
  }

  addChildren(stackTraces); // adding children to nodes
  if (stackTraces[0]?.[0]) {
    newResponse.profile.stackTrace = stackTraces[0][0];
  }

  // Set other properties
  newResponse.numTicks = Number(flamegraph.total);
  newResponse.maxSelf = Number(flamegraph.maxSelf);

  // Build the timeline from the SelectSeries response. The legacy render endpoint returned a
  // single aggregated timeline, so we use the first (aggregated) series here.
  const points = seriesResponse?.series?.[0]?.points ?? [];
  if (points.length > 0 && points[0] !== undefined) {
    const startTimeMs = Number(points[0].timestamp);
    // Prefer the actual spacing between points when available, falling back to the requested step.
    let durationDelta = step;
    if (points.length >= 2 && points[1] !== undefined) {
      durationDelta = Math.round((Number(points[1].timestamp) - startTimeMs) / MILLISECONDS);
    }

    newResponse.timeline = {
      // The series chart works in seconds and multiplies by 1000 when rendering.
      startTime: Math.floor(startTimeMs / MILLISECONDS),
      samples: points.map((point) => point.value),
      durationDelta,
    };
  }

  return newResponse;
}

// todo: optimize this method as soon as possible
function addChildren(stackTraces: StackTrace[][]): void {
  // for (let i = stackTraces.length - 1; i > 0; i--) {
  for (let i = 1; i < stackTraces.length; i++) {
    const currentLevel = stackTraces[i];
    const parentLevel = stackTraces[i - 1];

    if (!currentLevel || !parentLevel) {
      continue;
    }

    for (let j = 0; j < currentLevel.length; j++) {
      const currentStack = currentLevel[j];
      if (!currentStack) {
        continue;
      }

      for (let k = 0; k < parentLevel.length; k++) {
        const parentStack = parentLevel[k];
        if (!parentStack) {
          continue;
        }

        if (currentStack.start >= parentStack.start && currentStack.end <= parentStack.end) {
          parentStack.children.push(currentStack);
          break;
        }
      }
    }
  }
}
