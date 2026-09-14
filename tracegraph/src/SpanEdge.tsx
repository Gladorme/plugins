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

import { BaseEdge } from '@xyflow/react';
import type { Edge, EdgeProps } from '@xyflow/react';
import type { ReactElement } from 'react';

export type SpanFlowEdge = Edge<{ lane: number }, 'span'>;

/** Separate curves make repeated calls and same-service spans individually selectable. */
export function SpanEdge(props: EdgeProps<SpanFlowEdge>): ReactElement {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    source,
    target,
    data,
    markerEnd,
    style,
    label,
    labelStyle,
    labelBgStyle,
  } = props;
  const lane = data?.lane ?? 0;
  const offset = 45 + lane * 36;
  let path: string;
  let labelX: number;
  let labelY: number;
  if (source === target) {
    path = `M ${sourceX} ${sourceY} C ${sourceX + offset} ${sourceY - offset * 2}, ${targetX - offset} ${targetY - offset * 2}, ${targetX} ${targetY}`;
    labelX = (sourceX + targetX) / 2;
    labelY = sourceY - offset * 1.5;
  } else {
    const bend = lane % 2 === 0 ? offset : -offset;
    labelX = (sourceX + targetX) / 2;
    labelY = (sourceY + targetY) / 2 + bend * 0.75;
    path = `M ${sourceX} ${sourceY} C ${labelX} ${sourceY + bend}, ${labelX} ${targetY + bend}, ${targetX} ${targetY}`;
  }
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      interactionWidth={24}
    />
  );
}
