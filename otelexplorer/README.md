# OpenTelemetry Explorer Plugin

The OpenTelemetry Explorer provides one place to move between metrics, logs, traces, and profiles while retaining a
shared set of OpenTelemetry attribute filters.

The explorer is datasource-neutral. Datasource plugins opt in by exposing an `otelExplorer` capability on their
`DatasourcePlugin`; the capability declares supported signals and translates the common filters into native Perses
query definitions. Provider-specific query editors are not rendered: provider details remain behind the capability
boundary while the explorer owns the complete filtering experience.

```ts
import type { OTelExplorerDatasourcePlugin } from '@perses-dev/otel-explorer-plugin';

export const ExampleDatasource: OTelExplorerDatasourcePlugin<ExampleSpec, ExampleClient> = {
  createClient,
  createInitialOptions: () => ({ directUrl: '' }),
  otelExplorer: {
    logs: {
      createQuery: ({ datasource, filters }) => {
        // Build and return a LogQuery definition using the datasource's native query language.
      },
    },
  },
};
```

Attribute names and values are intentionally free-form. A provider can therefore expose OpenTelemetry attributes as-is
or translate them to the backend's storage conventions.

The built-in Pyroscope capability treats an equality filter named `profile.type` as the required profile type and
translates all other filters to Pyroscope label filters.

## Development

```bash
npm run dev
npm run lint
npm run type-check
npm run test
```
