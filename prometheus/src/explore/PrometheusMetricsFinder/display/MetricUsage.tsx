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

import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import type { DatasourceSelector } from '@perses-dev/spec';
import { useQuery } from '@tanstack/react-query';
import BellOutlineIcon from 'mdi-material-ui/BellOutline';
import CloseIcon from 'mdi-material-ui/Close';
import FunctionVariantIcon from 'mdi-material-ui/FunctionVariant';
import LinkVariantIcon from 'mdi-material-ui/LinkVariant';
import OpenInNewIcon from 'mdi-material-ui/OpenInNew';
import ViewDashboardOutlineIcon from 'mdi-material-ui/ViewDashboardOutline';
import type { ReactElement } from 'react';
import { useId, useState } from 'react';

import type { MetricUsageProvider } from '../../../model';

export interface MetricUsageProps {
  metricName: string;
  datasource: DatasourceSelector;
  provider: MetricUsageProvider;
}

function categoryIcon(id: string): ReactElement {
  switch (id) {
    case 'dashboards':
      return <ViewDashboardOutlineIcon fontSize="small" />;
    case 'alerts':
      return <BellOutlineIcon fontSize="small" />;
    case 'recordingRules':
      return <FunctionVariantIcon fontSize="small" />;
    default:
      return <LinkVariantIcon fontSize="small" />;
  }
}

function referenceLinkLabel(id: string): string {
  switch (id) {
    case 'dashboards':
      return 'Open dashboard';
    case 'alerts':
      return 'Open alert';
    case 'recordingRules':
      return 'Open recording rule';
    default:
      return 'Open reference';
  }
}

// Usage URLs come from external collectors. Render other schemes as plain text.
function safeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

export function MetricUsage({ metricName, datasource, provider }: MetricUsageProps): ReactElement | null {
  const [categoryId, setCategoryId] = useState<string>();
  const titleId = useId();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['metricUsage', provider.queryKey, datasource, metricName],
    queryFn: async ({ signal }) => ({ categories: await provider.getUsage({ metricName, datasource, signal }) }),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) return <Skeleton aria-label={`Loading usage for ${metricName}`} width={180} />;
  if (isError) return <Typography color="text.secondary">Usage unavailable</Typography>;
  if (!data?.categories) return <Typography color="text.secondary">Usage unknown</Typography>;
  const categories = data.categories.filter(({ references }) => references.length > 0);
  if (categories.length === 0) return null;

  const categoryIndex = categories.findIndex(({ id }) => id === categoryId);
  const category = categories[categoryIndex];
  return (
    <>
      <Stack direction="row" gap={0.5} sx={{ width: 'max-content' }} aria-label={`Usage for ${metricName}`}>
        {categories.map(({ id, label, references }) => (
          <Tooltip key={id} title={`${label}: ${references.length}`}>
            <Chip
              size="small"
              icon={categoryIcon(id)}
              label={references.length}
              aria-label={`${label}: ${references.length} for ${metricName}`}
              onClick={() => setCategoryId(id)}
            />
          </Tooltip>
        ))}
      </Stack>
      <Drawer
        anchor="right"
        open={!!category}
        onClose={() => setCategoryId(undefined)}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': titleId,
            sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100%', p: 3 },
          },
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Typography id={titleId} variant="h3" sx={{ overflowWrap: 'anywhere' }}>
            Where {metricName} is used
          </Typography>
          <IconButton aria-label="Close metric usage" onClick={() => setCategoryId(undefined)}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Tabs
          value={category ? category.id : false}
          onChange={(_, id: string) => setCategoryId(id)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Metric usage categories"
          sx={{ borderBottom: 1, borderColor: 'divider', mt: 2, flexShrink: 0 }}
        >
          {categories.map(({ id, label, references }, index) => (
            <Tab
              key={id}
              id={`${titleId}-tab-${index}`}
              aria-controls={`${titleId}-panel-${index}`}
              value={id}
              label={`${label}: ${references.length}`}
            />
          ))}
        </Tabs>
        {category && (
          <Box
            role="tabpanel"
            id={`${titleId}-panel-${categoryIndex}`}
            aria-labelledby={`${titleId}-tab-${categoryIndex}`}
            sx={{ overflowY: 'auto' }}
          >
            <List>
              {category.references.map((reference) => {
                const url = safeUrl(reference.url);
                return (
                  <ListItem key={JSON.stringify(reference)} disableGutters divider sx={{ display: 'block', py: 2 }}>
                    <ListItemText
                      sx={{ overflowWrap: 'anywhere' }}
                      primary={reference.name}
                      secondary={reference.description}
                    />
                    {url ? (
                      <Button
                        component="a"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        endIcon={<OpenInNewIcon />}
                        aria-label={`${referenceLinkLabel(category.id)}: ${reference.name}`}
                      >
                        {referenceLinkLabel(category.id)}
                      </Button>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No link configured
                      </Typography>
                    )}
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
      </Drawer>
    </>
  );
}
