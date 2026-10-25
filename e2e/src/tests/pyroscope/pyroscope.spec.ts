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

const baseURL = process.env.PYROSCOPE_E2E_URL;
const project = 'pyroscope-variables-e2e-' + Date.now();
const profileType = 'process_cpu:cpu:nanoseconds:cpu:nanoseconds';
test.use({ baseURL: baseURL ?? 'http://localhost:8080' });
test.skip(!baseURL, 'Requires a Perses server with the Pyroscope and FlameChart plugins loaded');

test.beforeAll(async ({ request }) => {
  const response = await request.post('/api/v1/projects', {
    data: { kind: 'Project', metadata: { name: project }, spec: {} },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  if (!baseURL) return;
  await request.delete('/api/v1/projects/' + project + '/dashboards/profiles');
  await request.delete('/api/v1/projects/' + project);
});

test('refreshes both Pyroscope requests when a dashboard variable changes', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const requests: Array<{ method: string; profileTypeID?: string; labelSelector?: string }> = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('http://pyroscope.test/**', async (route) => {
    const method = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    const body = route.request().postDataJSON();
    requests.push({ method, ...body });
    const service = body.labelSelector?.includes('"worker"') ? 'worker' : 'api';
    const responses: Record<string, unknown> = {
      SelectMergeStacktraces: {
        flamegraph: {
          names: ['root', service + '.work'],
          levels: [{ values: ['0', '3000000', '0', '0'] }, { values: ['0', '3000000', '3000000', '1'] }],
          total: '3000000',
          maxSelf: '3000000',
        },
      },
      SelectSeries: { series: [{ labels: [], points: [{ timestamp: 1735689600000, value: 3000000 }] }] },
      ProfileTypes: { profileTypes: [{ ID: profileType, name: 'process_cpu', sampleType: 'cpu' }] },
    };
    const response = responses[method] ?? { names: ['api', 'worker'] };
    await route.fulfill({ json: response });
  });
  const created = await request.post('/api/v1/projects/' + project + '/dashboards', {
    data: {
      kind: 'Dashboard',
      metadata: { name: 'profiles', project },
      spec: {
        duration: '1h',
        variables: [
          { kind: 'TextVariable', spec: { name: 'service', value: 'api' } },
          { kind: 'TextVariable', spec: { name: 'environment', value: 'production' } },
        ],
        datasources: {
          profiles: {
            default: true,
            plugin: { kind: 'PyroscopeDatasource', spec: { directUrl: 'http://pyroscope.test' } },
          },
        },
        panels: {
          profiles: {
            kind: 'Panel',
            spec: {
              display: { name: 'Pyroscope profiles' },
              plugin: {
                kind: 'FlameChart',
                spec: {
                  palette: 'package-name',
                  showSettings: true,
                  showTable: true,
                  showFlameGraph: true,
                  showSeries: true,
                },
              },
              queries: [
                {
                  kind: 'ProfileQuery',
                  spec: {
                    plugin: {
                      kind: 'PyroscopeProfileQuery',
                      spec: {
                        profileType,
                        service: '$service',
                        filters: [{ labelName: 'environment', labelValue: '$environment', operator: '=' }],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
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
  const panel = page.getByRole('region', { name: /^Pyroscope profiles(?: |$)/ });
  await expect(panel.getByRole('link', { name: 'api.work', exact: true })).toBeVisible();
  const service = page.getByRole('textbox', { name: 'service', exact: true });
  await service.fill('worker');
  await service.blur();
  await expect(panel.getByRole('link', { name: 'worker.work', exact: true })).toBeVisible();
  await expect(panel).not.toContainText('api.work');
  await Promise.all(
    ['SelectMergeStacktraces', 'SelectSeries'].map((method) =>
      expect
        .poll(() =>
          requests.some(
            (entry) =>
              entry.method === method &&
              entry.profileTypeID === profileType &&
              entry.labelSelector === '{service_name="worker",environment="production"}',
          ),
        )
        .toBeTruthy(),
    ),
  );
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'edit panel Pyroscope profiles', exact: true }).click();
  const editorService = page.getByRole('combobox', { name: 'Service', exact: true });
  await editorService.fill('$service');
  await editorService.press('Enter');
  await expect(editorService).toHaveValue('$service');
  await page.screenshot({ path: testInfo.outputPath('profile-variable-editor.png'), fullPage: true });
  expect(
    requests.filter((entry) => entry.method.startsWith('Select')).every((entry) => !entry.labelSelector?.includes('$')),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
