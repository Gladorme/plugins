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

package labelvalues

import (
	"github.com/perses/perses/go-sdk/datasource"
	listvariable "github.com/perses/perses/go-sdk/variable/list-variable"
)

const PluginKind = "ClickHouseLabelValuesVariable"

type PluginSpec struct {
	Datasource *datasource.Selector `json:"datasource,omitempty" yaml:"datasource,omitempty"`
	Query      string               `json:"query" yaml:"query"`
	LabelName  string               `json:"labelName" yaml:"labelName"`
}

type Option func(plugin *Builder) error

func create(expr string, labelName string, options ...Option) (Builder, error) {
	builder := &Builder{}
	for _, opt := range append([]Option{Query(expr), LabelName(labelName)}, options...) {
		if err := opt(builder); err != nil {
			return *builder, err
		}
	}
	return *builder, nil
}

func ClickHouseLabelValues(expr string, labelName string, options ...Option) listvariable.Option {
	return func(builder *listvariable.Builder) error {
		variable, err := create(expr, labelName, options...)
		if err != nil {
			return err
		}
		builder.ListVariableSpec.Plugin.Kind = PluginKind
		builder.ListVariableSpec.Plugin.Spec = variable
		return nil
	}
}

type Builder struct {
	PluginSpec `json:",inline" yaml:",inline"`
}
