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

import { Box, Stack, Typography } from '@mui/material';
import { createModEnterHandler } from '@perses-dev/dashboards';
import type { OptionsEditorProps, DatasourceSelectProps } from '@perses-dev/plugin-system';
import { DatasourceSelect, isVariableDatasource } from '@perses-dev/plugin-system';
import type { ReactElement, ReactNode } from 'react';
import { useCallback } from 'react';

import type { ClickHouseQuerySpec } from '../model/query';
import { DATASOURCE_KIND, DEFAULT_DATASOURCE } from '../queries/constants';
import { useQueryState } from '../queries/query-editor-model';
import { ClickQLEditor } from './ClickQLEditor';

const SUMMARY_SX = { cursor: 'pointer' };
const EXAMPLES_SX = { overflow: 'auto', whiteSpace: 'pre-wrap', bgcolor: 'action.hover', p: 1 };

export interface ClickHouseQueryEditorProps<T extends ClickHouseQuerySpec> extends OptionsEditorProps<T> {
  examples: string;
  children?: ReactNode;
}

export function ClickHouseQueryEditor<T extends ClickHouseQuerySpec>(
  props: ClickHouseQueryEditorProps<T>,
): ReactElement {
  const { value, onChange, examples, children } = props;
  const { query, handleQueryChange, handleQueryBlur } = useQueryState(props);
  const handleDatasourceChange = useCallback<DatasourceSelectProps['onChange']>(
    (datasource) => {
      if (isVariableDatasource(datasource) || datasource.kind === DATASOURCE_KIND) {
        onChange({ ...value, datasource });
      }
    },
    [value, onChange],
  );
  return (
    <Stack spacing={1.5}>
      <DatasourceSelect
        datasourcePluginKind={DATASOURCE_KIND}
        value={value.datasource ?? DEFAULT_DATASOURCE}
        onChange={handleDatasourceChange}
        label="ClickHouse Datasource"
        notched
      />
      {children}
      <ClickQLEditor
        value={query}
        onChange={handleQueryChange}
        onBlur={handleQueryBlur}
        onKeyDown={createModEnterHandler(handleQueryBlur)}
      />
      <Typography variant="caption" color="text.secondary">
        Use {'{start}'} and {'{end}'} for UTC time bounds, {'{step}'} for the interval in seconds, and{' '}
        {'${variable:sqlstring}'} for SQL string values.
      </Typography>
      <Box component="details">
        <Box component="summary" sx={SUMMARY_SX}>
          Query examples
        </Box>
        <Box component="pre" sx={EXAMPLES_SX}>
          {examples}
        </Box>
      </Box>
    </Stack>
  );
}
