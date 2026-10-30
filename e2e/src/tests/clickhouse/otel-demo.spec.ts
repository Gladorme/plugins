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

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import type { Locator, Page, Request } from '@playwright/test';

const baseURL = process.env.OTEL_DEMO_E2E_URL;
const directory = fileURLToPath(new URL('../../../../clickhouse/dev/otel-demo/dashboards/', import.meta.url));
const dashboards = readdirSync(directory).filter((file) => file.endsWith('.json'));
test.use({ baseURL: baseURL ?? 'http://localhost:18080', viewport: { width: 1600, height: 1200 } });
test.skip(!baseURL, 'Requires the running OTel demo and provisioned ClickHouse dashboards');

async function scrollToPanel(page: Page, name: string): Promise<Locator> {
  const panel = page.getByRole('region', { name: new RegExp('^' + name + '(?: |$)') });
  await expect
    .poll(async (): Promise<boolean> => {
      if (await panel.count()) return true;
      await page.mouse.wheel(0, 500);
      return false;
    })
    .toBeTruthy();
  await panel.scrollIntoViewIfNeeded();
  return panel;
}

for (const file of dashboards) {
  test('loads every panel of ' + file, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const dashboard = JSON.parse(readFileSync(directory + '/' + file, 'utf8'));
    const errors: string[] = [];
    const queries: Array<{ sql: string; rows?: number }> = [];
    const responses: Array<Promise<void>> = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      const sql = new URL(response.url()).searchParams.get('query');
      if (!sql) return;
      responses.push(
        (async (): Promise<void> => {
          try {
            if (!response.ok()) {
              errors.push(response.status() + ': ' + (await response.text()));
              return;
            }
            const body = await response.json();
            queries.push({ sql, rows: body.rows });
          } catch (error) {
            errors.push(String(error));
          }
        })(),
      );
    });
    await page.goto('/projects/otel-demo/dashboards/' + dashboard.metadata.name);
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await page.waitForTimeout(2000);
    // Panels mount only when visible. Traverse the entire page and verify each title was rendered.
    const seen = new Set<string>();
    async function scanPage(remaining: number): Promise<void> {
      const panels = await page.getByTestId('panel').all();
      const texts = await Promise.all(panels.map((panel) => panel.innerText()));
      for (const text of texts) {
        seen.add(text.split('\n')[0] ?? '');
        expect(text).not.toMatch(/Error loading|Something went wrong|ClickHouse.*requires|DB::Exception/i);
      }
      const atEnd = await page.evaluate(
        () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3,
      );
      if (atEnd) return;
      expect(remaining, 'Dashboard scroll did not reach the bottom').toBeGreaterThan(0);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(350);
      await scanPage(remaining - 1);
    }
    await scanPage(100);
    await page.waitForTimeout(1000);
    await Promise.all(responses);
    for (const panel of Object.values(dashboard.spec.panels) as Array<{ spec: { display: { name: string } } }>) {
      expect(
        [...seen].some((title) =>
          title.replace(/\s+/g, ' ').trim().startsWith(panel.spec.display.name.replace(/\s+/g, ' ').trim()),
        ),
        panel.spec.display.name,
      ).toBeTruthy();
    }
    expect(queries.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await testInfo.attach('queries', { body: JSON.stringify(queries, null, 2), contentType: 'application/json' });
  });
}

test('updates every signal and dependent variables, and refreshes cached absolute-range queries', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const queries: string[] = [];
  const pendingQueries = new Set<Request>();
  page.on('requestfinished', (request) => pendingQueries.delete(request));
  page.on('requestfailed', (request) => pendingQueries.delete(request));
  page.on('request', (request) => {
    const sql = new URL(request.url()).searchParams.get('query');
    if (sql) {
      queries.push(sql);
      pendingQueries.add(request);
    }
  });
  const end = Date.now() - 60_000;
  const start = end - 15 * 60_000;
  await page.goto('/projects/otel-demo/dashboards/signal-validation?start=' + start + '&end=' + end);
  await expect(page.getByRole('combobox', { name: 'service', exact: true })).toHaveValue('checkout');
  await expect(page.getByRole('combobox', { name: 'metric', exact: true })).toHaveValue('go.memory.used');
  const logs = await scrollToPanel(page, 'Live application logs');
  await expect(logs).toContainText(/order|payment|PlaceOrder|sending/i);
  await expect(await scrollToPanel(page, 'Live trace search')).toContainText('spans');
  await expect(await scrollToPanel(page, 'Latest trace detail')).toContainText('Trace ID:');
  async function checkChart(title: string): Promise<void> {
    const panel = await scrollToPanel(page, title);
    await expect(panel.locator('canvas').first()).toBeVisible();
    await expect(panel).not.toContainText('No data');
    await expect.poll(() => pendingQueries.size).toBe(0);
    // Lazy mounting resizes ECharts asynchronously; capture only once it fits below the panel header.
    await expect
      .poll(async (): Promise<boolean> => {
        const [container, canvas] = await Promise.all([
          panel.boundingBox(),
          panel.locator('canvas').first().boundingBox(),
        ]);
        return (
          !!container &&
          !!canvas &&
          canvas.y >= container.y + 30 &&
          canvas.y + canvas.height <= container.y + container.height
        );
      })
      .toBeTruthy();
    await panel.screenshot({ path: testInfo.outputPath(title.replaceAll(' ', '-') + '.png') });
  }
  await checkChart('Native explicit histogram');
  await checkChart('Native histogram over time');
  await checkChart('Mean cart latency and trace exemplars');
  await checkChart('Native exponential histogram');
  const profile = await scrollToPanel(page, 'Live eBPF profiles');
  await expect(profile).toContainText('runtime.');
  await expect.poll(() => profile.locator('canvas').count()).toBeGreaterThanOrEqual(2);
  await profile.screenshot({ path: testInfo.outputPath('profile.png') });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('combobox', { name: 'service', exact: true }).click();
  const mark = queries.length;
  await page.getByRole('option', { name: 'product-catalog', exact: true }).click();
  await Promise.all(
    ['otel_metrics_sum', 'otel_logs', 'otel_traces', 'otel_profiles'].map((table) =>
      expect
        .poll(() => queries.slice(mark).some((q) => q.includes(table) && q.includes("ServiceName = 'product-catalog'")))
        .toBeTruthy(),
    ),
  );
  await expect
    .poll(() => queries.slice(mark).some((q) => q.includes('DISTINCT MetricName') && q.includes("'product-catalog'")))
    .toBeTruthy();
  await expect
    .poll(() => queries.slice(mark).some((q) => q.includes('AS title') && q.includes("'product-catalog'")))
    .toBeTruthy();
  // Finish requests started by the variable change before testing explicit cache invalidation.
  await expect.poll(() => pendingQueries.size).toBe(0);
  const beforeRefresh = queries.length;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => queries.length).toBeGreaterThan(beforeRefresh);
  await expect
    .poll(() =>
      ['otel_metrics_sum', 'otel_logs', 'otel_traces', 'otel_profiles', 'AS title', 'DISTINCT MetricName'].filter(
        (fragment) => !queries.slice(beforeRefresh).some((q) => q.includes(fragment)),
      ),
    )
    .toEqual([]);
  const beforeZoom = queries.length;
  const oldProfileQuery = queries.findLast((q) => q.includes('FROM otel_profiles'));
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect
    .poll(() => queries.slice(beforeZoom).some((q) => q.includes('FROM otel_profiles') && q !== oldProfileQuery))
    .toBeTruthy();
  await testInfo.attach('signal-queries', { body: JSON.stringify(queries, null, 2), contentType: 'application/json' });
});
