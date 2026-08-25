# Time Series Chart

The Time Series Chart plugin displays time series data as line charts in Perses dashboards. This panel plugin is one of the most commonly used visualization types for monitoring metrics over time.

![TimeSeriesChart example](./timeserieschart.png)

## Main customizations
 
- **General settings**: configure legend, various visual settings, Y axis, thresholds..
- **Query settings**: define per-query customizations to have e.g different styling or unit for different trends.

Prometheus exemplars are displayed as diamond markers when the Prometheus datasource has an associated tracing
datasource. Hover a marker to inspect its labels and lazily retrieve a trace summary from Tempo or Jaeger; click the
marker to pin the tooltip.

## References

See also technical docs related to this plugin:

- [Data model](./model.md)
- [Dashboard-as-Code Go lib](./go-sdk.md)
