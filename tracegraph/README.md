# Trace Graph

The Trace Graph panel displays an OTLP trace using React Flow. Each node represents a service (the resource's
`service.name`). Each arrow represents a child span and points from its parent's service to its own service.

Select **Trace Graph** in the panel editor, add one trace query (for example, Tempo or Jaeger), and enter a trace ID.
Trace searches and multiple queries are not supported. Perses provides the query editor, loading indicator, and query
error handling. The panel has no additional configuration options.

- Click a service to see its span count, error count, and list of spans in the right-hand details pane.
- Click an arrow to see the span's IDs, operation, duration, status, timestamps, attributes, events, and links.
- Selecting a span highlights its parent chain through the selected connection. Other branches are dimmed, even when
  they connect the same services. The chain stops at a missing parent; cyclic parent references cannot loop indefinitely.
- Calls between the same services remain separate arrows. Spans whose parent belongs to the same service use loops.
- Root spans and spans whose parent is unavailable have no incoming arrow. Select them from the service's span list.
  Resources without a service name are grouped under **unknown service**. Duplicate trace/span ID pairs are shown once.
- Pan and zoom with React Flow controls. Tab to a service or arrow and press Enter or Space to open details. Escape,
  **Close details**, or clicking the canvas clears the selection. Refreshing trace data clears stale selections.

The layout groups services from left to right. Recursive service calls and disconnected branches are supported.
This is a view of individual spans in a trace, not an aggregated service dependency or throughput graph.

## Configuration

```yaml
kind: TraceGraph
spec: {}
```

## Installation and development

The plugin requires React and React DOM 18, matching the other Perses trace panels.
The package name is `@perses-dev/trace-graph-plugin`.

From the repository root:

```sh
npm ci
npm run dev -w tracegraph
npm run build -w tracegraph
npm run lint -w tracegraph
npm run type-check -w tracegraph
npm run test -w tracegraph
npm run test:tracegraph -w e2e
```

The browser tests start a standalone panel harness; they do not require a Perses backend. Install the Playwright Chromium
browser with `npx playwright install chromium` before running them. To load the plugin in Perses, follow the repository's
[development setup](../README.md#development) and run `percli plugin start /path/to/plugins/tracegraph`.

## Dashboard-as-Code

```go
import (
    "github.com/perses/perses/go-sdk/panel"
    tracegraph "github.com/perses/plugins/tracegraph/sdk/go"
)

panel.New("Trace", tracegraph.Chart())
```

Add a trace query with the chosen datasource's Go SDK. `Chart()` sets the plugin kind to `TraceGraph` and its spec to `{}`.
