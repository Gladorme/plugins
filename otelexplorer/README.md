# OpenTelemetry Explorer Plugin

The OpenTelemetry Explorer provides one place to move between metrics, logs, traces, and profiles while retaining a
shared set of OpenTelemetry attribute filters.

The explorer is datasource-neutral. Datasource plugins opt in by exposing an `otelExplorer` capability on their
`DatasourcePlugin`; the capability declares supported signals and translates the common filters into native Perses
query definitions. The datasource's normal query editor remains available for backend-specific controls.

```ts
import type { OTelExplorerDatasourcePlugin } from '@perses-dev/otel-explorer-plugin';

export const ExampleDatasource: OTelExplorerDatasourcePlugin<ExampleSpec, ExampleClient> = {
  createClient,
  createInitialOptions: () => ({ directUrl: '' }),
  otelExplorer: {
    logs: {
      queryType: 'LogQuery',
      queryPluginKind: 'ExampleLogQuery',
      applyAttributeFilters: ({ datasource, filters, previousFilters, query }) => {
        // Return a LogQuery definition using the datasource's native query language.
      },
    },
  },
};
```

Attribute names and values are intentionally free-form. A provider can therefore expose OpenTelemetry attributes as-is
or translate them to the backend's storage conventions.

## Development

```bash
npm run dev
npm run lint
npm run type-check
npm run test
```
