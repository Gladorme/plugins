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

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/perses/plugins/scripts/npm"
	"github.com/sirupsen/logrus"
)

// Each plugin is its own Go module, so `go test ./...` from the repository root never reaches them.
func main() {
	var failed []string

	for _, workspace := range npm.MustGetWorkspaces(".") {
		goModPath := filepath.Join(workspace, "go.mod")
		if _, err := os.Stat(goModPath); os.IsNotExist(err) {
			logrus.Infof("skipping Go tests for %s (no go.mod)", workspace)
			continue
		}

		cmd := exec.Command("go", "test", "-count=1", "./...")
		cmd.Dir = workspace
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if execErr := cmd.Run(); execErr != nil {
			failed = append(failed, workspace)
			logrus.WithError(execErr).Errorf("Go tests failed for the plugin %s", workspace)
		} else {
			logrus.Infof("Go tests passed for the plugin %s", workspace)
		}
	}
	if len(failed) > 0 {
		logrus.Fatalf("Go tests failed for the plugins: %s", strings.Join(failed, ", "))
	}
	logrus.Info("all plugins passed the Go tests")
}
