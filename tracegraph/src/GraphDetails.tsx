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

import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import type { ReactElement } from 'react';
import { useCallback } from 'react';

import { durationLabel } from './graph-model';
import type { Attributes, GraphSpan, Service } from './graph-model';

export type Selection = { kind: 'service'; id: string } | { kind: 'span'; id: string };
interface GraphDetailsProps {
  service?: Service;
  span?: GraphSpan;
  onClose: () => void;
  onSelectSpan: (id: string) => void;
}

const detailsSx = {
  width: 320,
  maxWidth: '50%',
  flexShrink: 0,
  overflow: 'auto',
  p: 2,
  borderLeft: 1,
  borderColor: 'divider',
  wordBreak: 'break-word',
} as const;
const emptyAttributes: Attributes = [];
const attributeRowSx = { mb: 1 };
const closeButtonSx = { mb: 1 };
const spanButtonSx = { justifyContent: 'flex-start', textAlign: 'left' } as const;
const attributeSx = { m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;

function AttributeList({ attributes }: { attributes: Attributes }): ReactElement {
  return (
    <Box component="dl">
      {attributes.map((attribute) => (
        <Box key={attribute.key} sx={attributeRowSx}>
          <Typography component="dt" variant="subtitle2">
            {attribute.key}
          </Typography>
          <Box component="dd" sx={attributeSx}>
            {JSON.stringify(attribute.value)}
          </Box>
        </Box>
      ))}
      {attributes.length === 0 && <Typography color="text.secondary">No attributes</Typography>}
    </Box>
  );
}

function SpanDetails({ item }: { item: GraphSpan }): ReactElement {
  const { span } = item;
  return (
    <Stack spacing={1}>
      <Typography variant="h3">{span.name}</Typography>
      <Typography>Service: {item.serviceName}</Typography>
      <Typography>Trace ID: {span.traceId}</Typography>
      <Typography>Span ID: {span.spanId}</Typography>
      <Typography>Parent span ID: {span.parentSpanId || 'None (root span)'}</Typography>
      <Typography>Duration: {durationLabel(span)}</Typography>
      <Typography>Kind: {span.kind || 'Unspecified'}</Typography>
      <Typography>Status: {span.status?.code || 'STATUS_CODE_UNSET'}</Typography>
      {span.status?.message && <Typography>{span.status.message}</Typography>}
      <Typography>Start (Unix ns): {span.startTimeUnixNano}</Typography>
      <Typography>End (Unix ns): {span.endTimeUnixNano}</Typography>
      <Divider />
      <Typography variant="h4">Span attributes</Typography>
      <AttributeList attributes={span.attributes ?? emptyAttributes} />
      <Typography variant="h4">Resource attributes</Typography>
      <AttributeList attributes={item.resourceAttributes} />
      <Typography variant="h4">Events ({span.events?.length ?? 0})</Typography>
      <Box component="pre" sx={attributeSx}>
        {JSON.stringify(span.events ?? [], null, 2)}
      </Box>
      <Typography variant="h4">Links ({span.links?.length ?? 0})</Typography>
      <Box component="pre" sx={attributeSx}>
        {JSON.stringify(span.links ?? [], null, 2)}
      </Box>
    </Stack>
  );
}

function SpanButton({ item, onSelectSpan }: { item: GraphSpan; onSelectSpan: (id: string) => void }): ReactElement {
  const onClick = useCallback(() => onSelectSpan(item.id), [item.id, onSelectSpan]);
  return (
    <Button onClick={onClick} sx={spanButtonSx}>
      {item.span.name} · {durationLabel(item.span)}
    </Button>
  );
}

export function GraphDetails({ service, span, onClose, onSelectSpan }: GraphDetailsProps): ReactElement {
  return (
    <Box component="aside" aria-label="Trace details" sx={detailsSx}>
      <Button onClick={onClose} sx={closeButtonSx}>
        Close details
      </Button>
      {span && <SpanDetails item={span} />}
      {service && (
        <Stack spacing={1}>
          <Typography variant="h3">{service.name}</Typography>
          <Typography>{service.spans.length} spans</Typography>
          <Typography>
            {service.spans.filter((item) => item.span.status?.code === 'STATUS_CODE_ERROR').length} errors
          </Typography>
          <Divider />
          {service.spans.map((item) => (
            <SpanButton key={item.id} item={item} onSelectSpan={onSelectSpan} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
