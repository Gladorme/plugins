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

import { expect, test } from '@playwright/test';

import dashboard from '../../../../clickhouse/dev/dashboard.json' with { type: 'json' };

const baseURL = process.env.CLICKHOUSE_E2E_URL;
const project = 'clickhouse-e2e-' + Date.now();
test.use({ baseURL: baseURL ?? 'http://localhost:8080' });
test.skip(!baseURL, 'Requires the ClickHouse dev fixture and a Perses server with the plugins loaded');

test.beforeAll(async ({ request }) => {
  const response = await request.post('/api/v1/projects', {
    data: { kind: 'Project', metadata: { name: project }, spec: {} },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const created = await request.post('/api/v1/projects/' + project + '/dashboards', {
    data: { ...dashboard, metadata: { ...dashboard.metadata, project } },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  if (!baseURL) return;
  await request.delete('/api/v1/projects/' + project + '/dashboards/clickhouse');
  await request.delete('/api/v1/projects/' + project + '/dashboards/database');
  await request.delete('/api/v1/projects/' + project + '/dashboards/profiles');
  await request.delete('/api/v1/projects/' + project);
});

test('renders all signals, annotations and variables and edits a trace query', async ({ page }, testInfo) => {
  // Render all eight panels before checking them; offscreen panels are mounted lazily.
  await page.setViewportSize({ width: 1440, height: 1600 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const queries: string[] = [];
  page.on('request', (request) => {
    const query = new URL(request.url()).searchParams.get('query');
    if (query) queries.push(query);
  });
  await page.goto('/projects/' + project + '/dashboards/clickhouse?start=1735689600000&end=1735693200000');
  await expect(page.getByRole('region', { name: 'ClickHouse logs', exact: true })).toContainText('request failed');
  await expect(page.getByRole('region', { name: 'ClickHouse logs', exact: true })).toContainText(
    '2025-01-01T00:00:00.123Z',
  );
  await expect(page.getByRole('region', { name: 'ClickHouse traces', exact: true })).toContainText('2 spans');
  await expect(page.getByRole('region', { name: 'ClickHouse traces', exact: true })).toContainText('1 error');
  await expect(page.getByRole('region', { name: 'ClickHouse trace detail', exact: true })).toContainText(
    'api: GET / (1s)',
  );
  await expect.poll(() => queries.some((query) => query.includes('AS title'))).toBeTruthy();
  await expect.poll(() => queries.some((query) => query.includes('avg(Value)'))).toBeTruthy();
  async function checkNativePanel(name: string): Promise<void> {
    const panel = page.getByRole('region', { name, exact: true });
    await panel.scrollIntoViewIfNeeded();
    await expect(panel.locator('canvas').first()).toBeVisible();
    await expect(panel).not.toContainText('No data available');
  }
  await checkNativePanel('ClickHouse histogram');
  await checkNativePanel('ClickHouse heatmap');
  await checkNativePanel('ClickHouse exemplars');
  await checkNativePanel('ClickHouse exponential histogram');
  await page.getByRole('combobox', { name: 'service', exact: true }).click();
  await expect(page.getByRole('option', { name: 'worker', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'worker', exact: true }).click();
  await expect(page.getByRole('region', { name: 'ClickHouse logs', exact: true })).toContainText('ready');
  await expect(page.getByRole('region', { name: 'ClickHouse logs', exact: true })).not.toContainText('request failed');
  await expect.poll(() => queries.some((query) => query.includes("ServiceName IN ('worker')"))).toBeTruthy();
  await page.getByRole('combobox', { name: 'service', exact: true }).click();
  await page.getByRole('option', { name: 'api', exact: true }).click();
  await expect(page.getByRole('region', { name: 'ClickHouse traces', exact: true })).toContainText('2 spans');
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'edit panel ClickHouse traces', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /^Result type/ })).toContainText('Trace search');
  await page.getByRole('textbox', { name: 'ClickHouse SQL query', exact: true }).fill('SELECT * FROM otel_traces');
  await page.getByRole('button', { name: 'Run Query', exact: true }).click();
  await expect.poll(() => queries.includes('SELECT * FROM otel_traces')).toBeTruthy();
  await page.getByRole('combobox', { name: /^Result type/ }).click();
  await expect(page.getByRole('option', { name: 'Trace detail', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: testInfo.outputPath('trace-editor.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('honors the database configured on the upstream proxy URL', async ({ page, request }) => {
  const spec = structuredClone(dashboard.spec);
  spec.datasources.clickhouse.plugin.spec.proxy.spec.url = 'http://127.0.0.1:18123/?database=system';
  const created = await request.post('/api/v1/projects/' + project + '/dashboards', {
    data: {
      ...dashboard,
      metadata: { name: 'database', project },
      spec: {
        ...spec,
        panels: {},
        layouts: [],
        annotations: [],
        variables: [
          {
            kind: 'ListVariable',
            spec: {
              name: 'database',
              plugin: { kind: 'ClickHouseVariable', spec: { query: 'SELECT currentDatabase() AS value' } },
            },
          },
        ],
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  await page.goto('/projects/' + project + '/dashboards/database');
  await expect(page.getByRole('combobox', { name: 'database', exact: true })).toHaveValue('system');
});

test('renders profile stacks, weights and timeline, refreshes service filters, and edits profile SQL', async ({
  page,
  request,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const created = await request.post('/api/v1/projects/' + project + '/dashboards', {
    data: {
      ...dashboard,
      metadata: { name: 'profiles', project },
      spec: {
        ...dashboard.spec,
        annotations: [],
        // Profile service options must remain available when the time range excludes the service's log rows.
        variables: [
          {
            kind: 'ListVariable',
            spec: {
              name: 'service',
              allowMultiple: false,
              plugin: {
                kind: 'ClickHouseVariable',
                spec: { query: 'SELECT DISTINCT ServiceName AS value FROM otel_profiles ORDER BY value' },
              },
            },
          },
        ],
        panels: { profiles: dashboard.spec.panels.profiles },
        layouts: [
          {
            kind: 'Grid',
            spec: { items: [{ x: 0, y: 0, width: 24, height: 20, content: { $ref: '#/spec/panels/profiles' } }] },
          },
        ],
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  await page.goto('/projects/' + project + '/dashboards/profiles?start=1735689600000&end=1735693200000');
  const panel = page.getByRole('region', { name: /^ClickHouse profiles(?: |$)/ });
  await expect(panel.getByRole('link', { name: 'api.parse (api.go:42)', exact: true })).toBeVisible();
  await expect(panel).toContainText('35ms');
  await expect(panel).not.toContainText('samples');
  await expect(panel.locator('canvas')).toHaveCount(2);
  await expect(panel.locator('canvas').first()).toBeVisible();
  await expect(panel.locator('canvas').last()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('profiles.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'service', exact: true }).click();
  await page.getByRole('option', { name: 'worker', exact: true }).click();
  await expect(panel.getByRole('link', { name: 'worker.process (worker.go:12)', exact: true })).toBeVisible();
  await expect(panel).not.toContainText('api.parse');
  await expect(panel).toContainText('7ms');
  // Restore the service, then narrow the range: exclude the first 10ms observation, retaining 25ms.
  await page.goto(
    '/projects/' + project + '/dashboards/profiles?start=1735689601000&end=1735693200000&var-service=api',
  );
  await expect(panel).toContainText('25ms');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'edit panel ClickHouse profiles', exact: true }).click();
  const sql = page.getByRole('textbox', { name: 'ClickHouse SQL query', exact: true });
  await expect(sql).toContainText('FROM otel_profiles');
  await sql.fill("SELECT ['main', 'custom.allocate'] AS stack, 4096 AS value, 'bytes' AS unit");
  await page.getByRole('button', { name: 'Run Query', exact: true }).click();
  await expect(page.getByRole('link', { name: 'custom.allocate', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('profile-editor.png'), fullPage: true });
  expect(errors).toEqual([]);
});
