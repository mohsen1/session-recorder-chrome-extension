import { test, expect, extUrl, dispatch, tabIdForUrl } from './support';
const org = '10000000-0000-4000-8000-000000000001';
const reportId = '20000000-0000-4000-8000-000000000001';
const account = {
  user: { id: 'u1', login: 'alice' },
  organization: {
    id: org,
    login: 'alice',
    name: 'Personal workspace',
    is_personal: true,
  },
  organizations: [
    { id: org, login: 'alice', name: 'Personal workspace', is_personal: true },
  ],
  default_organization_id: org,
  credits: { balance_microcredits: 10000000000, microcredits_per_credit: 1000000 },
  repositories: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      full_name: 'alice/product',
      github_repository_id: 1,
    },
  ],
};
const connected = () => ({
  aiMode: 'proofline',
  github: 'proofline',
  publishing: 'proofline',
  model: '',
  connection: {
    accessToken: 'test-proofline-token',
    organizationId: org,
    expiresAt: Date.now() + 3600000,
    account,
  },
});

test('connects by browser approval and requires an explicit switch from personal keys', async ({
  context,
  background,
  extensionId,
}) => {
  await background.evaluate(() =>
    chrome.storage.local.set({
      sharingSettings: { models: { openai: { apiKey: 'existing-key' } } },
    }),
  );
  await context.route('https://proofline.sh/**', async (route) => {
    const url = route.request().url();
    const json = url.endsWith('/auth/device/code')
      ? {
          device_code: 'private-device-code',
          user_code: 'ABCD-EFGH',
          verification_uri_complete: 'https://proofline.sh/device?user_code=ABCD-EFGH',
          expires_in: 600,
          interval: 5,
        }
      : url.endsWith('/auth/device/token')
        ? {
            access_token: 'test-proofline-token',
            organization_id: org,
            expires_in: 3600,
            scope: 'recorder:read recorder:ai recorder:reports recorder:issues',
          }
        : url.endsWith('/account')
          ? account
          : null;
    await route.fulfill(
      json
        ? { json }
        : { contentType: 'text/html', body: '<p>Browser approval fixture</p>' },
    );
  });
  const page = await context.newPage();
  await page.goto(extUrl(extensionId, 'options.html#proofline'));
  await page.getByRole('button', { name: 'Connect Proofline' }).click();
  await expect(page.getByText('ABCD-EFGH', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Use Proofline for AI and sharing' }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByLabel('AI usage')).toHaveValue('personal');
  await page.getByRole('button', { name: 'Use Proofline for AI and sharing' }).click();
  await expect(page.getByLabel('AI usage')).toHaveValue('proofline');
  await expect(page.getByLabel('Report hosting')).toHaveValue('proofline');
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.screenshot({
    path: '/tmp/recorder-proofline-account-light.png',
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/tmp/recorder-proofline-account-dark-narrow.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Connect Proofline', exact: true }),
  ).toBeVisible();
  const stored = await background.evaluate(() =>
    chrome.storage.local.get(['sharingSettings', 'prooflineSettings']),
  );
  expect(stored.sharingSettings.models.openai.apiKey).toBe('existing-key');
  expect(stored.prooflineSettings.aiMode).toBe('proofline');
  expect(stored.prooflineSettings.connection).toBeUndefined();
});

test('files through Proofline with managed AI and private attachment uploads', async ({
  context,
  background,
  extensionId,
}) => {
  const demo = await context.newPage();
  await demo.goto('/');
  const started = await dispatch<{ ok: boolean; session: { id: string } }>(background, {
    kind: 'session/start',
    tabId: await tabIdForUrl(background, 'http://localhost:5319'),
  });
  await dispatch(background, {
    kind: 'marker/add',
    name: 'Explain the empty recipes screen',
  });
  await dispatch(background, { kind: 'session/stop' });
  await background.evaluate(
    (settings) => chrome.storage.local.set({ prooflineSettings: settings }),
    connected(),
  );
  const paths: string[] = [];
  await context.route('https://proofline.sh/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    paths.push(path);
    expect(request.headers().authorization).toBe('Bearer test-proofline-token');
    let json: unknown;
    if (path.endsWith('/ai')) {
      const input = request.postDataJSON();
      expect(input.input.annotations.join('')).not.toContain('test-proofline-token');
      json = {
        id: input.request_id,
        status: 'completed',
        result: {
          title: 'Clarify the recipes empty state',
          markdown: 'Explain how to create the first recipe.',
        },
      };
    } else if (path.endsWith('/reports'))
      json = {
        id: reportId,
        url: `https://proofline.sh/recorder/reports/${org}/${reportId}`,
      };
    else if (path.endsWith('/attachments')) {
      const body = request.postDataJSON();
      expect(body.name).not.toMatch(/\.html$/);
      json = { id: 'asset' };
    } else if (path.endsWith('/issue'))
      json = {
        request_id: request.postDataJSON().request_id,
        status: 'complete',
        number: 42,
        url: 'https://github.com/alice/product/issues/42',
      };
    else throw new Error(`Unexpected Proofline request ${path}`);
    await route.fulfill({ json });
  });
  await context.route('https://github.com/alice/product/issues/42', (route) =>
    route.fulfill({ body: 'Issue fixture' }),
  );
  const page = await context.newPage();
  await page.goto(extUrl(extensionId, `share.html?session=${started.session.id}`));
  await expect(page.getByLabel('Issue repository')).toHaveValue('alice/product');
  await page.getByRole('button', { name: 'File GitHub issue', exact: true }).click();
  await expect(page.getByRole('link', { name: 'View issue #42' })).toBeVisible({
    timeout: 30000,
  });
  expect(paths.filter((path) => path.endsWith('/issue'))).toHaveLength(1);
  expect(paths.some((path) => path.endsWith('/attachments'))).toBe(true);
  await expect(page.getByLabel('Issue title')).toHaveValue(
    'Clarify the recipes empty state',
  );
  const panel = await context.newPage();
  await panel.goto(extUrl(extensionId, 'sidepanel.html'));
  await panel.setViewportSize({ width: 380, height: 740 });
  await panel.emulateMedia({ colorScheme: 'dark' });
  await expect(panel.getByRole('button', { name: 'Start recording' })).toBeVisible();
  await expect(panel.locator('.app')).toHaveCount(1);
  await expect(panel.getByRole('link', { name: 'Website', exact: true })).toBeVisible();
  await panel.screenshot({
    path: '/tmp/recorder-proofline-panel-dark.png',
    animations: 'disabled',
  });
});
