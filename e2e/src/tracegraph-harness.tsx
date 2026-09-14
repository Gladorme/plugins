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

import { Box, Button, CssBaseline, createTheme, ThemeProvider } from '@mui/material';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { trace } from '../../tracegraph/src/test/trace';
import { TraceGraphPanel } from '../../tracegraph/src/TraceGraphPanel';

const theme = createTheme();
const darkTheme = createTheme({ palette: { mode: 'dark' } });
const definition = { kind: 'TraceQuery' as const, spec: { plugin: { kind: 'TempoTraceQuery', spec: {} } } };
const spec = {};
const panelSx = { height: 650, width: '100%', bgcolor: 'background.default', color: 'text.primary' };
const initialResults = [{ definition, data: { trace } }];

function Harness(): ReactElement {
  const [results, setResults] = useState(initialResults);
  const [dark, setDark] = useState(false);
  const refresh = useCallback(() => setResults([{ definition, data: { trace: structuredClone(trace) } }]), []);
  const toggleTheme = useCallback(() => setDark((value) => !value), []);
  return (
    <ThemeProvider theme={dark ? darkTheme : theme}>
      <CssBaseline />
      <Button onClick={refresh}>Refresh trace</Button>
      <Button onClick={toggleTheme}>Toggle theme</Button>
      <Box sx={panelSx}>
        <TraceGraphPanel spec={spec} queryResults={results} />
      </Box>
    </ThemeProvider>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Harness />);
