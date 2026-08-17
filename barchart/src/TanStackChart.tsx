// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0

import { ChartHost, ChartHostOptions, ChartPoint, ChartValue, DomChartDefinition, mountChart } from '@tanstack/charts';
import { CSSProperties, ReactElement, useLayoutEffect, useMemo, useRef } from 'react';

export interface TanStackChartProps<TDatum, TXValue extends ChartValue, TYValue extends ChartValue> {
  definition: DomChartDefinition<TDatum, TXValue, TYValue>;
  width?: number;
  height: number;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
  onFocusChange?: (point: ChartPoint<TDatum, TXValue, TYValue> | null) => void;
  onSelect?: (point: ChartPoint<TDatum, TXValue, TYValue> | null) => void;
}

export function TanStackChart<TDatum, TXValue extends ChartValue, TYValue extends ChartValue>({
  definition,
  width,
  height,
  ariaLabel,
  className,
  style,
  onFocusChange,
  onSelect,
}: TanStackChartProps<TDatum, TXValue, TYValue>): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<ChartHost<TDatum, TXValue, TYValue>>();
  const options = useMemo<ChartHostOptions<TDatum, TXValue, TYValue>>(
    () => ({ definition, width, height, ariaLabel, className, onFocusChange, onSelect }),
    [ariaLabel, className, definition, height, onFocusChange, onSelect, width]
  );
  const initialOptions = useRef(options);

  useLayoutEffect((): (() => void) | undefined => {
    if (!containerRef.current) return;
    const host = mountChart(containerRef.current, initialOptions.current);
    hostRef.current = host;
    return () => {
      host.destroy();
      hostRef.current = undefined;
    };
  }, []);

  useLayoutEffect(() => {
    hostRef.current?.update(options);
  }, [options]);

  return <div ref={containerRef} style={{ width: width ?? '100%', height, ...style }} />;
}
