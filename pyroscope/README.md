# Perses Datasource Plugin

## Setup

Install dependencies:

```bash
npm install
```

## Get Started

Start the dev server:

```bash
npm run dev
```

Build the plugin for distribution:

```bash
npm run build
```

## Variables

Profile queries interpolate dashboard variables in service, profile type, filter names and values, and datasource
names. See the [query model](../docs/pyroscope/model.md#pyroscopeprofilequery) for examples.

For the browser regression test, start a Perses host with the local shared packages and the Pyroscope and FlameChart
plugins loaded, then run:

```bash
PYROSCOPE_E2E_URL=http://localhost:8080 npm exec -w e2e -- playwright test src/tests/pyroscope
```

The test intercepts the Pyroscope API, so no Pyroscope server is required.
