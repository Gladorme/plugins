# Time Series Chart

The Time Series Chart plugin displays time series data as line charts in Perses dashboards. This panel plugin is one of the most commonly used visualization types for monitoring metrics over time.

![TimeSeriesChart example](./timeserieschart.png)

## Main customizations
 
- **General settings**: configure legend, various visual settings, Y axis, thresholds..
- **Query settings**: define per-query customizations to have e.g different styling or unit for different trends.

Enable exemplars in the panel's general settings to fetch and display diamond markers. The setting is disabled by
default. Hover a marker to inspect its labels, including trace and span IDs. When the Prometheus datasource has an
associated Tempo or Jaeger datasource, the tooltip retrieves an additional trace summary lazily. Click the marker to pin
the tooltip.

## References

See also technical docs related to this plugin:

- [Data model](./model.md)
- [Dashboard-as-Code Go lib](./go-sdk.md)
