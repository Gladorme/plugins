// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0

import { ChartHost, ChartHostOptions, ChartValue, DomChartDefinition, mountChart } from '@tanstack/charts';
import { ReactElement, useLayoutEffect, useMemo, useRef } from 'react';

interface Props<TDatum, TXValue extends ChartValue, TYValue extends ChartValue> {
  definition: DomChartDefinition<TDatum, TXValue, TYValue>;
  height: number;
  ariaLabel: string;
}
export function TanStackChart<TDatum, TXValue extends ChartValue, TYValue extends ChartValue>({
  definition,
  height,
  ariaLabel,
}: Props<TDatum, TXValue, TYValue>): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<ChartHost<TDatum, TXValue, TYValue>>();
  const options = useMemo<ChartHostOptions<TDatum, TXValue, TYValue>>(
    () => ({ definition, height, ariaLabel }),
    [ariaLabel, definition, height]
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
  useLayoutEffect(() => hostRef.current?.update(options), [options]);
  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}
