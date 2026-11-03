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

package metricsusage

import (
	"encoding/json"
	"testing"

	"github.com/perses/perses/go-sdk/datasource"
)

func TestMetricsUsage(t *testing.T) {
	for _, option := range []Option{DirectURL("https://usage.example.com"), HTTPProxy("http://metrics-usage:8080")} {
		var builder datasource.Builder
		if err := MetricsUsage(option)(&builder); err != nil {
			t.Fatal(err)
		}
		if builder.Spec.Plugin.Kind != PluginKind {
			t.Fatal("incorrect plugin kind")
		}
		raw, err := json.Marshal(builder.Spec.Plugin.Spec)
		if err != nil {
			t.Fatal(err)
		}
		var spec PluginSpec
		if err := json.Unmarshal(raw, &spec); err != nil {
			t.Fatal(err)
		}
	}
}

func TestConnectionValidation(t *testing.T) {
	for _, options := range [][]Option{nil, {DirectURL("https://usage.example.com"), HTTPProxy("http://metrics-usage:8080")}} {
		if _, err := create(options...); err == nil {
			t.Fatal("expected invalid connection to be rejected")
		}
	}
	for _, raw := range []string{`{}`, `{"directUrl":"https://usage.example.com","proxy":{"kind":"HTTPProxy","spec":{"url":"http://metrics-usage:8080"}}}`} {
		var spec PluginSpec
		if err := json.Unmarshal([]byte(raw), &spec); err == nil {
			t.Fatal("expected invalid persisted connection to be rejected")
		}
	}
}
