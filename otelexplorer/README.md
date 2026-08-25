# OpenTelemetry Explorer Plugin

The OpenTelemetry Explorer provides one place to move between metrics, logs, traces, and profiles while retaining a
shared set of OpenTelemetry attribute filters. The signal tabs are always available, so an investigation can move to a
different signal without losing its common filters or the inputs previously used on either tab.

The explorer is datasource-neutral. Datasource plugins opt in by exposing an `otelExplorer` capability on their
`DatasourcePlugin`; the capability declares supported signals and translates the common filters into native Perses
query definitions. Provider-specific query editors are not rendered: provider details remain behind the capability
boundary while the explorer owns the complete filtering experience.

Each signal has a small set of queryless controls for its most common investigation workflow:

- Metrics: optional metric name and Range/Instant query mode. Range results use a time series chart; Instant results use
  a time series table.
- Logs: optional service, log-line text, and severity filters.
- Traces: optional service, span, status, and minimum/maximum duration filters.
- Profiles: optional service and required profile type.

Datasources may provide metric names, semantic signal-field values, attribute names, and attribute values. The
explorer displays suggestions as free-form autocomplete inputs, so users can still enter values when a backend does not
provide discovery APIs. Attribute names load when a filter row is added; attribute values load after an attribute name
is selected. Disabled suggestion queries do not display a loading state.

```ts
import type { OTelExplorerDatasourcePlugin } from '@perses-dev/otel-explorer-plugin';

export const ExampleDatasource: OTelExplorerDatasourcePlugin<ExampleSpec, ExampleClient> = {
  createClient,
  createInitialOptions: () => ({ directUrl: '' }),
  otelExplorer: {
    metrics: {
      createQuery: ({ datasource, filters, metricName, metricsQueryMode }) => {
        // Build and return a TimeSeriesQuery definition using the datasource's native query language.
      },
      getMetricNames: async ({ client, filters, start, end, abortSignal }) => [],
      getSignalFieldValues: async ({ client, field, filters, start, end, abortSignal }) => [],
      getAttributeNames: async ({ client, filters, start, end, abortSignal }) => [],
      getAttributeValues: async ({ client, attribute, filters, start, end, abortSignal }) => [],
    },
  },
};
```

Attribute names and values are intentionally free-form. A provider can therefore expose OpenTelemetry attributes as-is
or translate them to the backend's storage conventions.

`getSignalFieldValues` receives semantic field names such as `trace.service.name`, `trace.span.name`, `profile.type`, or
`log.severity`; the datasource is responsible for translating those names to its storage model. Query creation follows
the same boundary. For example, Tempo translates trace controls to TraceQL, Loki translates log text and level to a
LogQL pipeline, and Pyroscope translates the Profiles controls to its service and profile-type query fields.

For compatibility with existing explorer URLs, the built-in Pyroscope capability still accepts an equality attribute
filter named `profile.type` when the dedicated Profile type input is empty.

## Development

```bash
npm run dev
npm run lint
npm run type-check
npm run test
```
