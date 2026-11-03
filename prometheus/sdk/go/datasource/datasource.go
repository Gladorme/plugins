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
	"fmt"
	"strings"

	"github.com/perses/perses/go-sdk/datasource"
	"github.com/perses/spec/go/common"
	"github.com/perses/spec/go/datasource/proxy/http"
)

const (
	PluginKind = "PrometheusDatasource"
)

type PluginSpec struct {
	DirectURL      string            `json:"directUrl,omitempty" yaml:"directUrl,omitempty"`
	Proxy          *http.Proxy       `json:"proxy,omitempty" yaml:"proxy,omitempty"`
	ScrapeInterval common.Duration   `json:"scrapeInterval,omitempty" yaml:"scrapeInterval,omitempty"`
	QueryParams    map[string]string `json:"queryParams,omitempty" yaml:"queryParams,omitempty"`
	MetricsUsage   *MetricsUsage     `json:"metricsUsage,omitempty" yaml:"metricsUsage,omitempty"`
	Exemplars      *Exemplars        `json:"exemplars,omitempty" yaml:"exemplars,omitempty"`
}

// MetricsUsage configures the browser-accessible Metrics Usage service used by Metric Finder.
type MetricsUsage struct {
	Enable bool   `json:"enable" yaml:"enable"`
	URL    string `json:"url" yaml:"url"`
}

// Exemplars mirrors the exemplars section of the PrometheusDatasource CUE schema.
// When enabled, the Prometheus query plugin also queries the /api/v1/query_exemplars endpoint.
type Exemplars struct {
	Enable bool `json:"enable" yaml:"enable"`
}

func (s *PluginSpec) UnmarshalJSON(data []byte) error {
	type plain PluginSpec
	var tmp PluginSpec
	if err := json.Unmarshal(data, (*plain)(&tmp)); err != nil {
		return err
	}
	if err := (&tmp).validate(); err != nil {
		return err
	}
	*s = tmp
	return nil
}

func (s *PluginSpec) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var tmp PluginSpec
	type plain PluginSpec
	if err := unmarshal((*plain)(&tmp)); err != nil {
		return err
	}
	if err := (&tmp).validate(); err != nil {
		return err
	}
	*s = tmp
	return nil
}

func (s *PluginSpec) validate() error {
	if s.MetricsUsage != nil && s.MetricsUsage.Enable && strings.TrimSpace(s.MetricsUsage.URL) == "" {
		return fmt.Errorf("metricsUsage.url cannot be empty when enabled")
	}
	if len(s.DirectURL) == 0 && s.Proxy == nil {
		return fmt.Errorf("directUrl or proxy cannot be empty")
	}
	if len(s.DirectURL) > 0 && s.Proxy != nil {
		return fmt.Errorf("at most directUrl or proxy must be configured")
	}
	return nil
}

type Option func(plugin *Builder) error

func create(options ...Option) (Builder, error) {
	builder := &Builder{
		PluginSpec: PluginSpec{},
	}

	var defaults []Option

	for _, opt := range append(defaults, options...) {
		if err := opt(builder); err != nil {
			return *builder, err
		}
	}

	return *builder, nil
}

type Builder struct {
	PluginSpec `json:",inline" yaml:",inline"`
}

func Prometheus(options ...Option) datasource.Option {
	return func(builder *datasource.Builder) error {
		plugin, err := create(options...)
		if err != nil {
			return err
		}

		builder.Spec.Plugin.Kind = PluginKind
		builder.Spec.Plugin.Spec = plugin.PluginSpec
		return nil
	}
}

func Selector(name string) (*datasource.Selector, error) {
	return datasource.NewSelector(PluginKind, name)
}
