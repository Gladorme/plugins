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

test('shows details and highlights only the parent path, including internal spans', async ({ page }) => {
  await page.goto('/');
  const insert = page.getByRole('button', { name: 'Span insert, api to database', exact: true });
  await expect(insert).toBeVisible();
  await insert.locator('.react-flow__edge-text').click();
  const details = page.getByRole('complementary', { name: 'Trace details' });
  await expect(details.getByRole('heading', { name: 'insert', exact: true })).toBeVisible();
  await expect(details.getByText('Write failed')).toBeVisible();
  await expect
    .poll(async () => {
      const nodeBox = await page.getByRole('button', { name: 'Service database, 2 spans', exact: true }).boundingBox();
      const graphBox = await page.getByLabel('Trace service graph', { exact: true }).boundingBox();
      return nodeBox && graphBox ? nodeBox.x + nodeBox.width <= graphBox.x + graphBox.width : false;
    })
    .toBe(true);

  await expect(details.getByText('db.operation.name')).toBeVisible();
  await expect(page.locator('.trace-graph-ancestor')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Span checkout, frontend to api', exact: true })).toHaveClass(
    /trace-graph-ancestor/,
  );
  await expect(page.getByRole('button', { name: 'Span prepare, frontend to frontend', exact: true })).toHaveClass(
    /trace-graph-ancestor/,
  );
  await expect(page.getByRole('button', { name: 'Span catalog, frontend to api', exact: true })).not.toHaveClass(
    /trace-graph-ancestor/,
  );
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(details).toHaveCount(0);
  await expect(page.locator('.trace-graph-ancestor')).toHaveCount(0);

  await page.getByRole('button', { name: 'Service api, 2 spans', exact: true }).click();
  await expect(details.getByRole('heading', { name: 'api', exact: true })).toBeVisible();
  await details.getByRole('button', { name: 'catalog · 1 ms', exact: true }).click();
  await expect(page.locator('.trace-graph-ancestor')).toHaveCount(1);
  await expect(details.getByRole('heading', { name: 'catalog', exact: true })).toBeVisible();
});

test('supports keyboard selection, resets after refresh, and renders in dark mode', async ({ page }) => {
  await page.goto('/');
  const frontend = page.getByRole('button', { name: 'Service frontend, 2 spans', exact: true });
  await frontend.focus();
  await frontend.press('Enter');
  const details = page.getByRole('complementary', { name: 'Trace details' });
  await expect(details.getByRole('heading', { name: 'frontend', exact: true })).toBeVisible();
  const catalog = page.getByRole('button', { name: 'Span catalog, frontend to api', exact: true });
  await catalog.focus();
  await catalog.press('Space');
  await expect(details.getByRole('heading', { name: 'catalog', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh trace', exact: true }).click();
  await expect(details).toHaveCount(0);
  await expect(page.locator('.trace-graph-ancestor')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click();
  await expect(page.locator('.react-flow.dark')).toBeVisible();
});
