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

import { EditorView } from '@codemirror/view';
import { useTheme, InputLabel, Stack } from '@mui/material';
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror';
import CodeMirror from '@uiw/react-codemirror';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

export type ClickQLEditorProps = Omit<ReactCodeMirrorProps, 'theme' | 'extensions'>;

const LABEL_SX = { fontWeight: 500, marginBottom: '4px', color: 'text.primary' };
const BASIC_SETUP = {
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  foldGutter: false,
  syntaxHighlighting: true,
};
const EXTENSIONS = [
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ 'aria-label': 'ClickHouse SQL query' }),
  EditorView.theme({ '.cm-content': { paddingTop: '8px', paddingBottom: '8px', paddingRight: '40px' } }),
];

export function ClickQLEditor({
  placeholder = 'Write ClickHouse SQL query here...',
  ...props
}: ClickQLEditorProps): ReactElement {
  const theme = useTheme();
  const style = useMemo(() => ({ border: '1px solid ' + theme.palette.divider }), [theme.palette.divider]);
  return (
    <Stack position="relative">
      <InputLabel sx={LABEL_SX}>ClickHouse Query</InputLabel>
      <CodeMirror
        {...props}
        style={style}
        theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
        basicSetup={BASIC_SETUP}
        extensions={EXTENSIONS}
        placeholder={placeholder}
      />
    </Stack>
  );
}
