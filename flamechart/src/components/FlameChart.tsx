// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { Box, Divider, Menu, MenuItem, Stack, useTheme } from '@mui/material';
import { ProfileData } from '@perses-dev/spec';
import { defineChart, rect, text } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import ContentCopyIcon from 'mdi-material-ui/ContentCopy';
import EyeIcon from 'mdi-material-ui/EyeOutline';
import RefreshIcon from 'mdi-material-ui/Refresh';
import { PointerEvent, ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { buildSamples, findTotalSampleByName } from '../utils/data-transform';
import { generateTooltip } from '../utils/tooltip';
import { CustomBreadcrumb } from './CustomBreadcrumb';
import { TanStackChart } from './TanStackChart';

const ITEM_GAP = 0.08;
const CONTAINER_PADDING = 10;
const BREADCRUMB_SPACE = 50;
interface FlameRow {
  id: number;
  level: number;
  levelEnd: number;
  start: number;
  end: number;
  displayName: string;
  functionName: string;
  totalPercentage: number;
  selfPercentage: number;
  self: number;
  total: number;
  color: string;
}
export interface FlameChartProps {
  width: number;
  height: number;
  data: ProfileData;
  palette: 'package-name' | 'value';
  selectedId: number;
  searchValue: string;
  onSelectedIdChange: (newId: number) => void;
}

export function FlameChart({
  width,
  height,
  data,
  palette,
  selectedId,
  searchValue,
  onSelectedIdChange,
}: FlameChartProps): ReactElement {
  const theme = useTheme();
  const [menuPosition, setMenuPosition] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ id: number; name: string }>({ id: 0, name: '' });
  const [isCopied, setIsCopied] = useState(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const seriesData = useMemo(
    () => buildSamples(palette, data.metadata, data.profile.stackTrace, searchValue, selectedId),
    [data.metadata, data.profile.stackTrace, palette, searchValue, selectedId]
  );
  const rows = useMemo<FlameRow[]>(
    () =>
      seriesData.map((sample) => ({
        id: sample.name,
        level: sample.value[0],
        levelEnd: sample.value[0] + 1 - ITEM_GAP,
        start: sample.value[1],
        end: sample.value[2],
        displayName: sample.value[3],
        totalPercentage: sample.value[4],
        selfPercentage: sample.value[5],
        functionName: sample.value[6],
        self: sample.value[7],
        total: sample.value[8],
        color: sample.itemStyle.color,
      })),
    [seriesData]
  );
  const maxDepth = Math.max(1, ...rows.map((row) => row.levelEnd));
  const xMin = rows[0]?.start ?? 0;
  const xMax = rows[0]?.end ?? 1;
  const colors = useMemo(() => [...new Set(rows.map((row) => row.color))], [rows]);
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          rect(rows, { x1: 'start', x2: 'end', y1: 'level', y2: 'levelEnd', color: 'color', key: 'id' }),
          text(
            rows.filter((row) => row.displayName),
            {
              x: 'start',
              y: (row) => row.level + 0.46,
              text: 'displayName',
              key: 'id',
              fill: '#000',
              anchor: 'start',
              dx: 4,
              fontSize: 11,
            }
          ),
        ],
        x: { scale: scaleLinear().domain([xMin, xMax]), axis: false },
        y: { scale: scaleLinear().domain([0, maxDepth]), reverse: true, axis: false },
        color: { domain: colors, range: colors },
        guides: false,
        margin: { top: 5, right: 5, bottom: 5, left: 5 },
        theme: { foreground: theme.palette.text.primary, background: theme.palette.background.default },
        tooltip: { use: tooltip, format: (point) => generateTooltip(point.datum, data.metadata?.units) },
      }),
    [colors, data.metadata?.units, maxDepth, rows, theme.palette, xMax, xMin]
  );
  const handleSelect = useCallback((point: { datum: FlameRow } | null): void => {
    if (!point) return;
    setSelectedItem({ id: point.datum.id, name: point.datum.functionName });
    setMenuPosition({ mouseX: lastPointer.current.x - 2, mouseY: lastPointer.current.y - 4 });
  }, []);
  const handlePointer = (event: PointerEvent<HTMLDivElement>): void => {
    lastPointer.current = { x: event.clientX, y: event.clientY };
  };
  const handleClose = (): void => {
    setMenuPosition(null);
    setIsCopied(false);
  };
  const handleFocusBlock = (): void => {
    onSelectedIdChange(selectedItem.id);
    handleClose();
  };
  const handleCopyFunctionName = (): void => {
    if (selectedItem.name) void navigator.clipboard.writeText(selectedItem.name);
    setIsCopied(true);
  };
  const handleResetGraph = (): void => {
    if (selectedId) onSelectedIdChange(0);
    handleClose();
  };
  const chartHeight = Math.max(1, height - 2 * CONTAINER_PADDING - BREADCRUMB_SPACE);

  return (
    <Stack style={{ width, height }} alignItems="center">
      <CustomBreadcrumb
        totalValue={seriesData[0]?.value[3] || ''}
        totalSample={seriesData[0]?.value[8] || 0}
        otherItemSample={findTotalSampleByName(seriesData, selectedId)}
        onSelectedIdChange={onSelectedIdChange}
      />
      <Box onPointerDown={handlePointer}>
        {rows.length ? (
          <TanStackChart
            definition={definition}
            width={width}
            height={chartHeight}
            ariaLabel="Flame chart"
            onSelect={handleSelect}
          />
        ) : (
          <Box>No data</Box>
        )}
      </Box>
      <Menu
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            padding: '5px',
            paddingBottom: 0,
          },
          '& .MuiMenuItem-root:hover': { backgroundColor: theme.palette.action.hover },
        }}
        open={menuPosition !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={menuPosition ? { top: menuPosition.mouseY, left: menuPosition.mouseX } : undefined}
      >
        <Box sx={{ paddingLeft: '16px', paddingBottom: '8px' }}>{selectedItem.name}</Box>
        <Divider sx={{ backgroundColor: theme.palette.divider }} />
        <MenuItem onClick={handleFocusBlock}>
          <EyeIcon fontSize="small" color="secondary" sx={{ marginRight: '10px' }} />
          Focus block
        </MenuItem>
        <MenuItem onClick={handleCopyFunctionName} disabled={isCopied}>
          <ContentCopyIcon fontSize="small" color="secondary" sx={{ marginRight: '10px' }} />
          {isCopied ? 'Copied' : 'Copy function name'}
        </MenuItem>
        <MenuItem onClick={handleResetGraph}>
          <RefreshIcon fontSize="small" color="secondary" sx={{ marginRight: '10px' }} />
          Reset graph
        </MenuItem>
      </Menu>
    </Stack>
  );
}
