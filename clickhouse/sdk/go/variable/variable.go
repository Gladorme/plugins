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

package variable

import (
	"errors"
	"strings"

	"github.com/perses/perses/go-sdk/datasource"
	listvariable "github.com/perses/perses/go-sdk/variable/list-variable"
)

const PluginKind = "ClickHouseVariable"

type PluginSpec struct {
	ValueColumn string `json:"valueColumn,omitempty" yaml:"valueColumn,omitempty"`
	LabelColumn string `json:"labelColumn,omitempty" yaml:"labelColumn,omitempty"`

	Datasource *datasource.Selector `json:"datasource,omitempty" yaml:"datasource,omitempty"`
	Query      string               `json:"query" yaml:"query"`
}

type Option func(plugin *Builder) error

func create(query string, options ...Option) (Builder, error) {
	builder := &Builder{
		PluginSpec: PluginSpec{},
	}

	defaults := []Option{
		Query(query),
	}

	for _, opt := range append(defaults, options...) {
		if err := opt(builder); err != nil {
			return *builder, err
		}
	}

	if strings.TrimSpace(builder.Query) == "" {
		return *builder, errors.New("query cannot be empty")
	}
	return *builder, nil
}

type Builder struct {
	PluginSpec `json:",inline" yaml:",inline"`
}

// ClickHouseVariable configures a query-backed list variable.
func ClickHouseVariable(expr string, options ...Option) listvariable.Option {
	return func(builder *listvariable.Builder) error {
		plg, err := create(expr, options...)
		if err != nil {
			return err
		}
		builder.ListVariableSpec.Plugin.Kind = PluginKind
		builder.ListVariableSpec.Plugin.Spec = plg
		return nil
	}
}
