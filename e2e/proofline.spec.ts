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
          verification_uri_complete: 'https://proofline.sh/auth/device?user_code=ABCD-EFGH',
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
  const approvalPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Connect Proofline' }).click();
  const approvalPage = await approvalPromise;
  await approvalPage.waitForURL('https://proofline.sh/auth/device?user_code=ABCD-EFGH');
  await expect(page.getByText('ABCD-EFGH', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change account' })).toBeVisible({ timeout: 20000 });
  await expect.poll(() => approvalPage.isClosed()).toBe(true);
  const active = await background.evaluate(async () =>
    (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.url,
  );
  expect(active).toBe(extUrl(extensionId, 'options.html#proofline'));
  await expect(page.getByLabel('AI usage')).toHaveCount(0);
  await page.getByRole('link', { name: 'Services', exact: true }).click();
  await expect(page.getByLabel('AI usage')).toHaveValue('personal');
  await page.getByRole('button', { name: 'Use Proofline for AI and sharing' }).click();
  await expect(page.getByLabel('AI usage')).toHaveValue('proofline');
  await expect(page.getByLabel('Report hosting')).toHaveValue('proofline');
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.screenshot({
    path: '/tmp/recorder-proofline-account-light.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '/tmp/recorder-proofline-account-dark-narrow.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByRole('link', { name: 'Proofline', exact: true }).click();
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

test('offers Proofline credits instead of requiring a provider key after sign-in', async ({ context, background, extensionId }) => {
  await background.evaluate((settings) => chrome.storage.local.set({
    prooflineSettings: { ...settings, aiMode: 'personal', github: 'personal', publishing: 'personal' },
    micFromStart: true,
  }), connected());
  await context.route('https://proofline.sh/**', route => route.fulfill({ status: 503, json: { detail: 'Fixture: no provider calls' } }));
  const page = await context.newPage();
  await page.goto(extUrl(extensionId, 'sidepanel.html'));
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  const voice = page.getByRole('dialog', { name: 'Voice setup' });
  await expect(voice.getByRole('button', { name: 'Use Proofline credits' })).toBeVisible();
  await expect(voice.getByLabel('API key')).toHaveCount(0);
  await voice.getByRole('button', { name: 'Use a provider key' }).click();
  await expect(voice.getByLabel('API key')).toBeVisible();
  await voice.getByRole('button', { name: 'Back to voice options' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: '/tmp/recorder-proofline-voice-choice-dark.png', fullPage: true });
  await voice.getByRole('button', { name: 'Use Proofline credits' }).click();
  await expect(voice).toHaveCount(0);
  const stored = await background.evaluate(() => chrome.storage.local.get(['prooflineSettings', 'transcription']));
  expect(stored.prooflineSettings.aiMode).toBe('proofline');
  expect(stored.prooflineSettings.connection.organizationId).toBe(org);
  expect(stored.prooflineSettings.github).toBe('personal');
  expect(stored.prooflineSettings.publishing).toBe('personal');
  expect(stored.transcription).toBeUndefined();
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

test('changes the paying workspace only after matching browser approval', async ({
  context,
  background,
  extensionId,
}) => {
  const teamId = '10000000-0000-4000-8000-000000000002';
  const team = {
    id: teamId,
    login: 'team',
    name: 'Team workspace',
    is_personal: false,
  };
  const initial = connected();
  initial.connection.account = {
    ...account,
    organizations: [...account.organizations, team],
  };
  await background.evaluate(
    (settings) => chrome.storage.local.set({ prooflineSettings: settings }),
    initial,
  );
  let approvals = 0;
  await context.route('https://proofline.sh/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/auth/device/code') {
      expect(request.postDataJSON().organization_id).toBe(teamId);
      approvals++;
      await route.fulfill({
        json: {
          device_code: `device-${approvals}`,
          user_code: `APPROVAL-${approvals}`,
          verification_uri_complete: `https://proofline.sh/auth/device?user_code=APPROVAL-${approvals}`,
          expires_in: 600,
          interval: 5,
        },
      });
    } else if (path === '/auth/device/token') {
      await route.fulfill({
        json: {
          access_token: `approved-token-${approvals}`,
          // The browser can approve a different workspace from the URL hint.
          organization_id: approvals === 2 ? org : teamId,
          expires_in: 3600,
          scope: 'recorder:read recorder:ai recorder:reports recorder:issues',
        },
      });
    } else if (path.endsWith('/account')) {
      const approvedOrg = approvals === 2 ? org : teamId;
      expect(path).toBe(`/api/v1/organizations/${approvedOrg}/recorder/account`);
      expect(request.headers().authorization).toBe(`Bearer approved-token-${approvals}`);
      await route.fulfill({
        json: {
          ...initial.connection.account,
          organization: approvedOrg === org ? account.organization : team,
          repositories: approvedOrg === org ? account.repositories : [],
        },
      });
    } else if (path.startsWith('/auth/') || path.startsWith('/api/')) {
      throw new Error(`Unexpected Proofline request ${path}`);
    } else {
      await route.fulfill({ contentType: 'text/html', body: '<p>Approval fixture</p>' });
    }
  });
  const page = await context.newPage();
  await page.goto(extUrl(extensionId, 'options.html#proofline'));
  const workspace = page.getByLabel('Workspace paying for usage');
  const storedConnection = () =>
    background.evaluate(async () =>
      (await chrome.storage.local.get('prooflineSettings')).prooflineSettings.connection,
    );

  await workspace.selectOption(teamId);
  await expect(page.getByText('APPROVAL-1', { exact: true })).toBeVisible();
  await expect(workspace).toBeDisabled();
  expect((await storedConnection()).organizationId).toBe(org);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(workspace).toBeEnabled();
  await expect(workspace).toHaveValue(org);
  expect((await storedConnection()).accessToken).toBe('test-proofline-token');

  await workspace.selectOption(teamId);
  await expect(page.getByRole('alert')).toContainText('A different workspace was approved', {
    timeout: 20000,
  });
  await expect(workspace).toHaveValue(org);
  expect((await storedConnection()).accessToken).toBe('test-proofline-token');

  await workspace.selectOption(teamId);
  await expect(workspace).toHaveValue(teamId, { timeout: 20000 });
  await expect(workspace).toBeEnabled();
  const approved = await storedConnection();
  expect(approved.organizationId).toBe(teamId);
  expect(approved.accessToken).toBe('approved-token-3');
  expect(approved.account.repositories).toEqual([]);
  await page.reload();
  await expect(page.getByLabel('Workspace paying for usage')).toHaveValue(teamId);
});

for (const failure of [
  { name: 'exhausted credits', status: 402, message: 'no credits available' },
  { name: 'revoked access', status: 401, message: 'Reconnect to Proofline' },
  { name: 'expired connection', status: 0, message: 'connection has expired' },
  {
    name: 'workspace retention policy',
    status: 409,
    message: 'This organization requires zero-retention model routing.',
  },
] as const) {
  test(`filing stops on ${failure.name} without spending personal keys or publishing`, async ({
    context,
    background,
    extensionId,
  }) => {
    const demo = await context.newPage();
    await demo.goto('/');
    const recording = await dispatch<{ session: { id: string } }>(background, {
      kind: 'session/start',
      tabId: await tabIdForUrl(background, 'http://localhost:5319'),
    });
    await dispatch(background, { kind: 'session/stop' });
    const settings = connected();
    if (failure.status === 0) settings.connection.expiresAt = 0;
    await background.evaluate(
      (prooflineSettings) => chrome.storage.local.set({
        prooflineSettings,
        sharingSettings: {
          provider: 'openai',
          models: { openai: { apiKey: 'personal-key-must-not-be-used' } },
          repositories: [{ id: 'personal', repository: 'alice/product', token: 'personal-pat' }],
        },
      }),
      settings,
    );
    const requests: string[] = [];
    await context.route('https://**/*', async (route) => {
      const request = route.request();
      requests.push(request.url());
      expect(request.url()).toBe(`https://proofline.sh/api/v1/organizations/${org}/recorder/ai`);
      expect(request.headers().authorization).toBe('Bearer test-proofline-token');
      expect(request.postData()).not.toContain('personal-key-must-not-be-used');
      await route.fulfill({
        status: failure.status || 500,
        json: {
          status: failure.status,
          title: failure.message,
          detail: failure.message,
        },
      });
    });
    const page = await context.newPage();
    await page.goto(extUrl(extensionId, `share.html?session=${recording.session.id}`));
    await page.getByRole('button', { name: 'File GitHub issue', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(failure.message);
    await expect(page.getByRole('button', { name: 'File GitHub issue', exact: true })).toBeEnabled();
    await expect(page.getByRole('heading', { name: 'Filing your issue' })).toHaveCount(0);
    expect(requests).toHaveLength(failure.status === 0 ? 0 : 1);
    const stored = await background.evaluate(() =>
      chrome.storage.local.get(['prooflineSettings', 'sharingSettings']),
    );
    expect(stored.prooflineSettings.aiMode).toBe('proofline');
    expect(stored.prooflineSettings.publishing).toBe('proofline');
    expect(stored.sharingSettings.models.openai.apiKey).toBe('personal-key-must-not-be-used');
  });
}
