# Plugin Module: click-house

### How to install

This plugin requires react and react-dom 18

Install peer dependencies:

```bash
npm install react@18 react-dom@18
```

Install the plugin:

```bash
npm install @my-org/click-house
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

The package provides the `ClickHouseQueryVariable`, `ClickHouseLabelNamesVariable`, and
`ClickHouseLabelValuesVariable` list-variable plugins in addition to its datasource, time-series query, and log query
plugins. Variable SQL supports chained Perses variables and the `{start}` / `{end}` time-range placeholders.
