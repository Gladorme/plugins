# Prometheus Plugin

Time series charts can opt in to fetching Prometheus exemplars from their panel settings. The option is disabled by
default. The datasource editor can optionally associate a Tempo or Jaeger datasource to load trace details only when an
exemplar is selected.

### How to install

This plugin requires react and react-dom 18

Install peer dependencies:

```bash
npm install react@18 react-dom@18
```

Install the plugin:

```bash
npm install @perses-dev/prometheus-plugin
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
