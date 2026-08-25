# TimeSeriesChart Panel Plugin

The chart displays Prometheus exemplars as interactive diamond markers. Without a tracing datasource, the tooltip shows
the exemplar labels, including trace and span IDs. When a tracing datasource is configured, additional trace details are
loaded lazily from Tempo or Jaeger when a marker is selected.

### How to install

This plugin requires react and react-dom 18

Install peer dependencies:

```bash
npm install react@18 react-dom@18
```

Install the plugin:

```bash
npm install @perses-dev/timeseries-chart-plugin
```

## Development

### Setup

Install dependencies:

```bash
npm install
```

### Get Started

Start the dev server:

```bash
npm run dev
```

Build the plugin for distribution:

```bash
npm run build
```
