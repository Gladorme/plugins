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

import { Box, Chip, IconButton, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useSelectionItemActions } from '@perses-dev/dashboards';
import type { ItemAction } from '@perses-dev/plugin-system';
import { useAllVariableValues } from '@perses-dev/plugin-system';
import CloseIcon from 'mdi-material-ui/Close';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import type { CustomLinks } from '../../gantt-chart-model';
import { getSpanActionData } from '../span-actions';
import type { Span, Trace } from '../trace';
import { TraceAttributes } from './Attributes';
import { SpanEventList } from './SpanEvents';
import { SpanLinkList } from './SpanLinks';

export interface DetailPaneProps {
  customLinks?: CustomLinks;
  trace: Trace;
  span: Span;
  /** item actions executed with the data of the span */
  actions?: ItemAction[];
  onCloseBtnClick: () => void;
}

/**
 * DetailPane renders a sidebar showing the span attributes etc.
 */
export function DetailPane(props: DetailPaneProps): ReactElement {
  const { customLinks, trace, span, actions, onCloseBtnClick } = props;
  const variableValues = useAllVariableValues();
  const { getItemActionButtons, confirmDialog } = useSelectionItemActions({ actions, variableState: variableValues });
  const actionButtons = useMemo(
    () => (actions?.length ? getItemActionButtons({ id: span.spanId, data: getSpanActionData(trace, span) }) : []),
    [actions, getItemActionButtons, trace, span],
  );
  const [tab, setTab] = useState<'attributes' | 'events' | 'links'>('attributes');

  // if the events tab is selected, and then a span without events is clicked,
  // we need to switch the current selected tab back to the attributes tab.
  if (tab === 'events' && span.events.length === 0) {
    setTab('attributes');
  }
  // same as above, but for span links
  if (tab === 'links' && span.links.length === 0) {
    setTab('attributes');
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ float: 'right' }}>
        {actionButtons}
        <IconButton onClick={onCloseBtnClick} aria-label="close">
          <CloseIcon />
        </IconButton>
      </Stack>
      {confirmDialog}
      <Typography sx={{ wordBreak: 'break-word' }}>{span.resource.serviceName}</Typography>
      <Typography variant="h2" sx={{ wordBreak: 'break-word' }}>
        {span.name}
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, tab) => setTab(tab)} variant="scrollable">
          <Tab sx={{ p: 0 }} value="attributes" label="Attributes" />
          {span.events.length > 0 && (
            <Tab
              value="events"
              label="Events"
              icon={<Chip label={span.events.length} />}
              iconPosition="end"
              sx={{ minHeight: 48, height: 48 }} // MUI Tabs with icon are bigger than those without by default
            />
          )}
          {span.links.length > 0 && (
            <Tab
              value="links"
              label="Links"
              icon={<Chip label={span.links.length} />}
              iconPosition="end"
              sx={{ minHeight: 48, height: 48 }} // MUI Tabs with icon are bigger than those without by default
            />
          )}
        </Tabs>
      </Box>
      {tab === 'attributes' && <TraceAttributes customLinks={customLinks} trace={trace} span={span} />}
      {tab === 'events' && <SpanEventList customLinks={customLinks} trace={trace} span={span} />}
      {tab === 'links' && <SpanLinkList customLinks={customLinks} span={span} />}
    </Box>
  );
}
