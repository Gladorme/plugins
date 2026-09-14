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

import { Box, Typography, useTheme } from '@mui/material';
import { Background, Controls, MarkerType, Position, ReactFlow, useReactFlow, useStore } from '@xyflow/react';
import type { Node, NodeMouseHandler, EdgeMouseHandler, OnNodesChange, OnEdgesChange } from '@xyflow/react';
import type { KeyboardEvent, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

// React Flow requires its global stylesheet for node positioning and edge interaction.
// oxlint-disable-next-line import/no-unassigned-import
import '@xyflow/react/dist/style.css';

import { buildGraph, durationLabel, getAncestorSpanIds } from './graph-model';
import type { GraphModel, Trace } from './graph-model';
import { GraphDetails } from './GraphDetails';
import type { Selection } from './GraphDetails';
import { SpanEdge } from './SpanEdge';
import type { SpanFlowEdge } from './SpanEdge';

const edgeTypes = { span: SpanEdge };
const fitViewOptions = { padding: 0.25, maxZoom: 1 };
const graphSx = { display: 'flex', height: '100%', minHeight: 0, width: '100%' } as const;
const canvasSx = { flex: 1, minWidth: 0, height: '100%' } as const;

interface GraphViewportProps {
  model: GraphModel;
}

function GraphViewport({ model }: GraphViewportProps): null {
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (width && height) void fitView(fitViewOptions);
  }, [width, height, model, fitView]);
  return null;
}

export function ServiceGraph({ trace }: { trace: Trace }): ReactElement {
  const theme = useTheme();
  const model = useMemo(() => buildGraph(trace), [trace]);
  // Bind selection to its dataset so a query refresh cannot show stale span details.
  const [selected, setSelected] = useState<{ trace: Trace; value: Selection }>();
  const selection = selected?.trace === trace ? selected.value : undefined;
  const span = selection?.kind === 'span' ? model.spans.get(selection.id) : undefined;
  const service = selection?.kind === 'service' ? model.services.get(selection.id) : undefined;
  const path = useMemo(() => (span ? getAncestorSpanIds(model, span.id) : new Set<string>()), [model, span]);
  const pathServices = useMemo(
    () =>
      new Set(
        [...path].flatMap((id) => {
          const item = model.spans.get(id);
          return item ? [item.serviceId] : [];
        }),
      ),
    [model, path],
  );
  const nodes = useMemo<Node[]>(
    () =>
      [...model.services.values()].map((item) => ({
        id: item.id,
        position: item.position,
        ariaRole: 'button',
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: { label: `${item.name} (${item.spans.length} spans)` },
        ariaLabel: `Service ${item.name}, ${item.spans.length} spans`,
        selected: service?.id === item.id || pathServices.has(item.id),
        style: {
          width: 180,
          minHeight: 60,
          fontFamily: theme.typography.fontFamily,
          background: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderColor: theme.palette.divider,
          opacity: span && !pathServices.has(item.id) ? 0.4 : 1,
        },
      })),
    [model, theme, service, span, pathServices],
  );
  const edges = useMemo<SpanFlowEdge[]>(
    () =>
      model.connections.map((connection) => {
        const highlighted = path.has(connection.id);
        const color = highlighted ? theme.palette.primary.main : theme.palette.text.secondary;
        return {
          id: connection.id,
          source: connection.source,
          target: connection.target,
          type: 'span',
          data: { lane: connection.lane },
          ariaRole: 'button',
          label: `${connection.span.span.name} · ${durationLabel(connection.span.span)}`,
          ariaLabel: `Span ${connection.span.span.name}, ${model.services.get(connection.source)?.name} to ${connection.span.serviceName}`,
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: { stroke: color, strokeWidth: highlighted ? 3 : 1.5, opacity: span && !highlighted ? 0.2 : 1 },
          labelStyle: { fill: theme.palette.text.primary, fontSize: 11, fontFamily: theme.typography.fontFamily },
          labelBgStyle: { fill: theme.palette.background.paper },
          selected: span?.id === connection.id,
          zIndex: highlighted ? 1 : 0,
          className: highlighted ? 'trace-graph-ancestor' : undefined,
        };
      }),
    [model, path, theme, span],
  );
  const closeDetails = useCallback(() => setSelected(undefined), []);
  const selectSpan = useCallback((id: string) => setSelected({ trace, value: { kind: 'span', id } }), [trace]);
  const onNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      setSelected({ trace, value: { kind: 'service', id: node.id } });
    },
    [trace],
  );
  const onEdgeClick = useCallback<EdgeMouseHandler<SpanFlowEdge>>((_, edge) => selectSpan(edge.id), [selectSpan]);

  const onNodesChange = useCallback<OnNodesChange>(
    (changes) => {
      const change = changes.find((item) => item.type === 'select' && item.selected);
      if (change?.type === 'select') setSelected({ trace, value: { kind: 'service', id: change.id } });
    },
    [trace],
  );
  const onEdgesChange = useCallback<OnEdgesChange<SpanFlowEdge>>(
    (changes) => {
      const change = changes.find((item) => item.type === 'select' && item.selected);
      if (change?.type === 'select') selectSpan(change.id);
    },
    [selectSpan],
  );
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetails();
    },
    [closeDetails],
  );

  if (nodes.length === 0) return <Typography>No spans found in this trace.</Typography>;
  return (
    <Box sx={graphSx}>
      <Box sx={canvasSx}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          colorMode={theme.palette.mode}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onKeyDown={onKeyDown}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={closeDetails}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          minZoom={0.1}
          maxZoom={2}
          aria-label="Trace service graph"
        >
          <GraphViewport model={model} />
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </Box>
      {(service || span) && (
        <GraphDetails service={service} span={span} onClose={closeDetails} onSelectSpan={selectSpan} />
      )}
    </Box>
  );
}
