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

package sdk_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/perses/perses/go-sdk/annotation"
	corevariable "github.com/perses/perses/go-sdk/variable"
	listvariable "github.com/perses/perses/go-sdk/variable/list-variable"
	channotation "github.com/perses/plugins/clickhouse/sdk/go/annotation"
	chlog "github.com/perses/plugins/clickhouse/sdk/go/query/log"
	chprofile "github.com/perses/plugins/clickhouse/sdk/go/query/profile"
	chtrace "github.com/perses/plugins/clickhouse/sdk/go/query/trace"
	chvariable "github.com/perses/plugins/clickhouse/sdk/go/variable"
)

func TestTraceBuilder(t *testing.T) {
	option := chtrace.ClickHouseTraceQuery("SELECT * FROM otel_traces", chtrace.Mode("trace"), chtrace.Table("otel_traces"), chtrace.Datasource("$source"))
	if option.Error != nil {
		t.Fatal(option.Error)
	}
	data, err := json.Marshal(option.Plugin)
	if err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{`"kind":"ClickHouseTraceQuery"`, `"mode":"trace"`, `"table":"otel_traces"`, `"datasource":"$source"`} {
		if !strings.Contains(string(data), value) {
			t.Fatalf("missing %s in %s", value, data)
		}
	}
	if chtrace.ClickHouseTraceQuery("SELECT 1", chtrace.Mode("invalid")).Error == nil {
		t.Fatal("invalid mode accepted")
	}
	if chtrace.ClickHouseTraceQuery(" ").Error == nil {
		t.Fatal("empty query accepted")
	}
	if chtrace.ClickHouseTraceQuery("SELECT 1", chtrace.Datasource("$")).Error == nil {
		t.Fatal("invalid datasource variable accepted")
	}
}

func TestAnnotationBuilder(t *testing.T) {
	result, err := annotation.New("Deploys", channotation.ClickHouseAnnotationQuery("SELECT now() AS start", channotation.Datasource("clickhouse")))
	if err != nil {
		t.Fatal(err)
	}
	if result.Annotation.Plugin.Kind != "ClickHouseAnnotationQuery" {
		t.Fatal(result.Annotation.Plugin.Kind)
	}
	if _, err = annotation.New("Deploys", channotation.ClickHouseAnnotationQuery("")); err == nil {
		t.Fatal("empty query accepted")
	}
}

func TestVariableBuilder(t *testing.T) {
	result, err := corevariable.New("service", listvariable.List(chvariable.ClickHouseVariable(
		"SELECT service AS id, service AS name", chvariable.ValueColumn("id"), chvariable.LabelColumn("name"), chvariable.Datasource("$source"),
	)))
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{`"kind":"ClickHouseVariable"`, `"valueColumn":"id"`, `"labelColumn":"name"`, `"datasource":"$source"`} {
		if !strings.Contains(string(data), value) {
			t.Fatalf("missing %s in %s", value, data)
		}
	}
	if _, err = corevariable.New("service", listvariable.List(chvariable.ClickHouseVariable("SELECT 1", chvariable.ValueColumn("")))); err == nil {
		t.Fatal("empty value column accepted")
	}
}

func TestLogTimeColumn(t *testing.T) {
	result := chlog.ClickHouseLogQuery("SELECT event_time FROM logs", chlog.TimeColumn("event_time"))
	if result.Error != nil {
		t.Fatal(result.Error)
	}
	data, err := json.Marshal(result.Plugin)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"timeColumn":"event_time"`) {
		t.Fatal(string(data))
	}
}

func TestProfileBuilder(t *testing.T) {
	result := chprofile.ClickHouseProfileQuery("SELECT * FROM otel_profiles", chprofile.Datasource("$source"))
	if result.Error != nil {
		t.Fatal(result.Error)
	}
	if string(result.Kind) != "ProfileQuery" {
		t.Fatal(result.Kind)
	}
	data, err := json.Marshal(result.Plugin)
	if err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{`"kind":"ClickHouseProfileQuery"`, `"datasource":"$source"`} {
		if !strings.Contains(string(data), value) {
			t.Fatalf("missing %s in %s", value, data)
		}
	}
	if chprofile.ClickHouseProfileQuery(" ").Error == nil {
		t.Fatal("empty query accepted")
	}
	if chprofile.ClickHouseProfileQuery("SELECT 1", chprofile.Datasource("$")).Error == nil {
		t.Fatal("invalid datasource accepted")
	}
}
