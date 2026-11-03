// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package datasource

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/perses/perses/go-sdk/datasource"
)

func TestPrometheusDatasourceBuilder(t *testing.T) {
	builder, err := create(DirectURL("https://prometheus.demo.do.prometheus.io"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if builder.DirectURL != "https://prometheus.demo.do.prometheus.io" {
		t.Errorf("directUrl mismatch: %s", builder.DirectURL)
	}
	if builder.Exemplars != nil {
		t.Errorf("exemplars should not be set: %v", builder.Exemplars)
	}
}

func TestEnableExemplars(t *testing.T) {
	builder, err := create(
		DirectURL("https://prometheus.demo.do.prometheus.io"),
		EnableExemplars(),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if builder.Exemplars == nil || !builder.Exemplars.Enable {
		t.Fatalf("exemplars should be enabled: %v", builder.Exemplars)
	}

	raw, err := json.Marshal(builder.PluginSpec)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	exemplars, ok := out["exemplars"].(map[string]any)
	if !ok {
		t.Fatalf("exemplars section is missing in the serialized spec: %v", out)
	}
	if enable, ok := exemplars["enable"].(bool); !ok || !enable {
		t.Errorf("exemplars.enable mismatch: %v", exemplars["enable"])
	}
}

func TestMetricsUsage(t *testing.T) {
	for _, enable := range []bool{true, false} {
		config := MetricsUsage{Enable: enable, URL: "/metrics-usage"}
		builder, err := create(DirectURL("/prometheus"), WithMetricsUsage(config))
		if err != nil {
			t.Fatal(err)
		}
		raw, err := json.Marshal(builder.PluginSpec)
		if err != nil {
			t.Fatal(err)
		}
		var result PluginSpec
		if err := json.Unmarshal(raw, &result); err != nil {
			t.Fatal(err)
		}
		if result.MetricsUsage == nil || *result.MetricsUsage != config {
			t.Fatalf("unexpected metric usage configuration: %+v", result.MetricsUsage)
		}
	}
}

func TestMetricsUsageRequiresURLWhenEnabled(t *testing.T) {
	if _, err := create(WithMetricsUsage(MetricsUsage{Enable: true, URL: "  "})); err == nil {
		t.Fatal("expected empty URL to be rejected")
	}
	var spec PluginSpec
	if err := json.Unmarshal([]byte(`{"directUrl":"/prom","metricsUsage":{"enable":true,"url":""}}`), &spec); err == nil {
		t.Fatal("expected invalid persisted configuration to be rejected")
	}
	if _, err := create(WithMetricsUsage(MetricsUsage{Enable: false})); err != nil {
		t.Fatal(err)
	}
}

func TestMetricsUsageDatasourceReference(t *testing.T) {
	config := MetricsUsage{Enable: true, Datasource: &datasource.StaticSelector{Kind: "MetricsUsageDatasource", Name: "usage"}}
	builder, err := create(DirectURL("http://prometheus:9090"), WithMetricsUsage(config))
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(builder.PluginSpec)
	if err != nil {
		t.Fatal(err)
	}
	var result PluginSpec
	if err := json.Unmarshal(raw, &result); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(result.MetricsUsage, &config) {
		t.Fatalf("unexpected reference: %+v", result.MetricsUsage)
	}
	for _, kind := range []string{"PrometheusDatasource", ""} {
		if _, err := create(WithMetricsUsage(MetricsUsage{Enable: true, Datasource: &datasource.StaticSelector{Kind: kind}})); err == nil {
			t.Fatalf("accepted invalid kind %q", kind)
		}
	}
	if err := json.Unmarshal([]byte(`{"directUrl":"http://prometheus:9090","metricsUsage":{"enable":true,"datasource":{"kind":"PrometheusDatasource"}}}`), &result); err == nil {
		t.Fatal("accepted invalid persisted datasource reference")
	}
}
