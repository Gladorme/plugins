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

import { TextField } from '@mui/material';
import type { OptionsEditorProps } from '@perses-dev/plugin-system';
import type { ReactElement, ChangeEvent } from 'react';
import { useCallback } from 'react';

import { ClickHouseQueryEditor } from '../../components/ClickHouseQueryEditor';
import { LOGS_EXAMPLE } from '../../components/query-examples';
import type { ClickHouseLogQuerySpec } from './click-house-log-query-types';

export function ClickHouseLogQueryEditor(props: OptionsEditorProps<ClickHouseLogQuerySpec>): ReactElement {
  const { value, onChange } = props;
  const handleTimeColumn = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, timeColumn: event.target.value || undefined });
    },
    [value, onChange],
  );
  return (
    <ClickHouseQueryEditor {...props} examples={LOGS_EXAMPLE}>
      <TextField
        label="Timestamp column"
        value={value.timeColumn ?? ''}
        placeholder="Timestamp"
        helperText="Set for custom SQL aliases and log volume queries."
        onChange={handleTimeColumn}
      />
    </ClickHouseQueryEditor>
  );
}
