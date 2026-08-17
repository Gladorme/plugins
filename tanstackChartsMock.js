// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0

const mark = (data, options) => ({ data, options });
const layout = (options) => ({ options });

const scale = () => {
  const instance = (value) => value;
  instance.base = () => instance;
  instance.domain = () => instance;
  instance.padding = () => instance;
  instance.range = () => instance;
  return instance;
};

module.exports = {
  areaY: mark,
  barX: mark,
  barY: mark,
  cell: mark,
  colorGradientLegend: layout,
  colorLegend: layout,
  controlledSignal: (value) => value,
  crosshair: layout,
  defineChart: (definition) => definition,
  dot: mark,
  group: layout,
  lineY: mark,
  mountChart: () => ({ destroy: () => undefined, update: () => undefined }),
  pie: (data) => data,
  polar: layout,
  radialArc: mark,
  radialRule: mark,
  radialText: mark,
  rect: mark,
  ruleX: mark,
  scaleBand: scale,
  scaleLinear: scale,
  scaleLog: scale,
  stack: layout,
  text: mark,
  tooltip: {},
  zoomX: layout,
};
