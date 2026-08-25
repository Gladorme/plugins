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

import { Box, CircularProgress, Divider, Portal, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import {
  assembleTransform,
  CursorCoordinates,
  getDateAndTime,
  getTooltipStyles,
  TOOLTIP_BG_COLOR_FALLBACK,
  TOOLTIP_MAX_WIDTH,
  useMousePosition,
} from '@perses-dev/components';
import { useDatasourceStore } from '@perses-dev/plugin-system';
import { useEffect, useMemo, useState } from 'react';
import useResizeObserver from 'use-resize-observer';

import { getExemplarTraceId, loadTraceSummary } from '../utils/exemplar';
import type { TimeSeriesExemplar, TraceClient, TraceSummary } from '../utils/exemplar';

export interface ExemplarTooltipProps {
  color: string;
  containerId?: string;
  exemplar?: TimeSeriesExemplar;
  formatWithUserTimeZone: (date: Date, formatString: string) => string;
  pinnedPos: CursorCoordinates | null;
  onUnpinClick: () => void;
}

interface TraceState {
  error?: string;
  loading?: boolean;
  summary?: TraceSummary;
}

const STACK_SX = { maxWidth: TOOLTIP_MAX_WIDTH };
const TITLE_SX = { flexGrow: 1 };
const UNPIN_SX = { cursor: 'pointer' };
const TRACE_ID_SX = { overflowWrap: 'anywhere' };
const MARGIN_TOP_SX = { mt: 1 };
const HEADER_SX: SxProps<Theme> = (theme) => ({
  padding: theme.spacing(1.5, 2, 0.5),
  backgroundColor: theme.palette.designSystem?.grey[800] ?? TOOLTIP_BG_COLOR_FALLBACK,
});
const DIVIDER_SX: SxProps<Theme> = (theme) => ({ mt: 0.5, borderColor: theme.palette.grey['500'] });
const BODY_SX: SxProps<Theme> = (theme) => ({ padding: theme.spacing(0.5, 2, 1.5) });

export function ExemplarTooltip(props: ExemplarTooltipProps): JSX.Element | null {
  const { color, containerId, exemplar, formatWithUserTimeZone, onUnpinClick, pinnedPos } = props;
  const datasourceStore = useDatasourceStore();
  const mousePos = useMousePosition();
  const { height, width, ref: tooltipRef } = useResizeObserver<HTMLDivElement>();
  const traceId = exemplar ? getExemplarTraceId(exemplar) : undefined;
  const datasourceKind = exemplar?.tracingDatasource.kind;
  const datasourceName = exemplar?.tracingDatasource.name;
  const [traceState, setTraceState] = useState<TraceState>({ loading: traceId !== undefined });

  useEffect((): (() => void) | undefined => {
    if (!traceId || !datasourceKind) {
      return;
    }

    let active = true;
    datasourceStore
      .getDatasourceClient<TraceClient>({ kind: datasourceKind, name: datasourceName })
      .then((client) => loadTraceSummary(client, traceId))
      .then((summary) => {
        if (active) setTraceState({ summary });
      })
      .catch((error: unknown) => {
        if (active) setTraceState({ error: error instanceof Error ? error.message : 'Unable to load trace' });
      });

    return (): void => {
      active = false;
    };
  }, [datasourceKind, datasourceName, datasourceStore, traceId]);

  const containerElement = containerId ? document.querySelector(containerId) : undefined;
  const maxHeight = containerElement ? containerElement.getBoundingClientRect().height : undefined;
  const transform =
    pinnedPos !== null || mousePos !== null
      ? assembleTransform(mousePos, pinnedPos, height ?? 0, width ?? 0, containerElement)
      : '';
  const tooltipSx: SxProps<Theme> = useMemo(
    () => (theme) => getTooltipStyles(theme, pinnedPos, maxHeight),
    [maxHeight, pinnedPos],
  );
  const tooltipStyle = useMemo(() => ({ transform }), [transform]);
  const markerSx = useMemo(
    () => ({ width: 9, height: 9, transform: 'rotate(45deg)', backgroundColor: color }),
    [color],
  );

  if (!exemplar || (pinnedPos === null && mousePos === null)) return null;

  const date = getDateAndTime(exemplar.timestamp, formatWithUserTimeZone);

  return (
    <Portal container={containerElement}>
      <Box ref={tooltipRef} sx={tooltipSx} style={tooltipStyle}>
        <Stack spacing={0.5} sx={STACK_SX}>
          <Box sx={HEADER_SX}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={markerSx} />
              <Typography variant="caption" sx={TITLE_SX}>
                {date.formattedDate} - <strong>{date.formattedTime}</strong>
              </Typography>
              {pinnedPos !== null && (
                <Typography variant="caption" component="button" onClick={onUnpinClick} sx={UNPIN_SX}>
                  Unpin
                </Typography>
              )}
            </Stack>
            <Divider sx={DIVIDER_SX} />
          </Box>
          <Box sx={BODY_SX}>
            <Typography variant="caption" display="block">
              Value: {exemplar.value}
            </Typography>
            {traceId && (
              <Typography variant="caption" display="block" sx={TRACE_ID_SX}>
                Trace ID: {traceId}
              </Typography>
            )}
            {Object.entries(exemplar.labels)
              .filter(([key]) => !['trace_id', 'traceID', 'traceId'].includes(key))
              .map(([key, value]) => (
                <Typography key={key} variant="caption" display="block">
                  {key}: {value}
                </Typography>
              ))}
            {traceState.loading && <CircularProgress size={14} sx={MARGIN_TOP_SX} aria-label="Loading trace" />}
            {traceState.error && (
              <Typography variant="caption" color="error" display="block" sx={MARGIN_TOP_SX}>
                {traceState.error}
              </Typography>
            )}
            {traceState.summary && (
              <Box sx={MARGIN_TOP_SX}>
                {traceState.summary.serviceName && (
                  <Typography variant="caption" display="block">
                    Service: {traceState.summary.serviceName}
                  </Typography>
                )}
                {traceState.summary.operationName && (
                  <Typography variant="caption" display="block">
                    Operation: {traceState.summary.operationName}
                  </Typography>
                )}
                <Typography variant="caption" display="block">
                  Spans: {traceState.summary.spanCount}
                </Typography>
                {traceState.summary.durationMs !== undefined && (
                  <Typography variant="caption" display="block">
                    Duration: {traceState.summary.durationMs.toLocaleString()} ms
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Stack>
      </Box>
    </Portal>
  );
}
