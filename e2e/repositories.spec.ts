import { test, expect, extUrl, dispatch, tabIdForUrl } from './support';

test('configures separate repository credentials and remembers the destination for new reports', async ({ context, background, extensionId }) => {
  await context.route('https://api.github.com/repos/**', async (route) => {
    const first = route.request().url().endsWith('/owner/first');
    expect(route.request().headers().authorization).toBe(`Bearer ${first ? 'first-key' : 'second-key'}`);
    await route.fulfill({ json: { has_issues: true } });
  });
  const options = await context.newPage();
  await options.goto(extUrl(extensionId, 'options.html#github'));
  for (const [repository, token] of [['owner/first', 'first-key'], ['team/second', 'second-key']] as const) {
    await options.getByRole('button', { name: 'Add repository' }).click();
    await options.getByLabel('GitHub repository', { exact: true }).last().fill(repository);
    await options.getByLabel('GitHub API token', { exact: true }).last().fill(token);
  }
  await options.getByRole('button', { name: 'Save GitHub settings' }).click();
  await expect(options.getByRole('status')).toHaveText('Repositories verified and saved.');
  await options.reload();
  await expect(options.getByLabel('GitHub repository', { exact: true })).toHaveCount(2);
  await expect(options.getByLabel('GitHub API token', { exact: true }).last()).toHaveValue('second-key');
  await options.screenshot({ path: '/tmp/recorder-repositories-settings.png', fullPage: true });
  const demo = await context.newPage();
  await demo.goto('/');
  const tabId = await tabIdForUrl(background, 'http://localhost:5319');
  const first = await dispatch<{session: {id: string}}>(background, { kind: 'session/start', tabId });
  await dispatch(background, { kind: 'session/stop' });
  const report = await context.newPage();
  await report.goto(extUrl(extensionId, `share.html?session=${first.session.id}`));
  await expect(report.getByLabel('Issue repository', { exact: true })).toHaveValue('owner/first');
  await report.getByLabel('Issue repository', { exact: true }).selectOption('team/second');
  await expect.poll(() => background.evaluate(async () => (await chrome.storage.local.get('lastIssueRepository')).lastIssueRepository)).toBe('team/second');
  await report.reload();
  await expect(report.getByLabel('Issue repository', { exact: true })).toHaveValue('team/second');
  const next = await dispatch<{session: {id: string}}>(background, { kind: 'session/start', tabId });
  await dispatch(background, { kind: 'session/stop' });
  await report.goto(extUrl(extensionId, `share.html?session=${next.session.id}`));
  await expect(report.getByLabel('Issue repository', { exact: true })).toHaveValue('team/second');
});

test('full-page filing can be cancelled and retried without losing a published report', async ({ context, background, extensionId }) => {
  const demo = await context.newPage();
  await demo.goto('/');
  const recording = await dispatch<{session: {id: string}}>(background, {
    kind: 'session/start', tabId: await tabIdForUrl(background, 'http://localhost:5319'),
  });
  await dispatch(background, { kind: 'session/stop' });
  await background.evaluate(async (id) => {
    await chrome.storage.local.set({
      sharingSettings: { repositories: [{ id: 'one', repository: 'team/second', token: 'second-key' }] },
      [`shareDraft:${id}`]: {
        repository: 'team/second', draft: { title: 'Saved title', body: 'Saved summary' }, draftSource: 'edited',
        publication: { level: 'L1', destination: {}, deployment: {
          id: 'existing', url: 'https://existing.reports.pages.dev', environment: 'preview',
          latest_stage: { name: 'deploy', status: 'success' },
        } },
      },
    });
  }, recording.session.id);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let wait = true;
  let issues = 0;
  await context.route('https://api.github.com/repos/team/second**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer second-key');
    if (route.request().method() === 'POST') {
      issues++;
      expect(route.request().postDataJSON().body).toContain('https://existing.reports.pages.dev');
      await route.fulfill({ status: 201, json: { number: 8, html_url: 'https://github.com/team/second/issues/8' } });
    } else {
      if (wait) await gate;
      await route.fulfill({ json: { has_issues: true } }).catch(() => {});
    }
  });
  await context.route('https://github.com/team/second/issues/8', (route) => route.fulfill({ body: '<h1>Created issue</h1>', contentType: 'text/html' }));
  const report = await context.newPage();
  await report.setViewportSize({ width: 390, height: 844 });
  await report.goto(extUrl(extensionId, `share.html?session=${recording.session.id}`));
  await report.getByRole('button', { name: 'File GitHub issue', exact: true }).click();
  await expect(report.getByRole('heading', { name: 'Filing your issue' })).toBeInViewport();
  await expect(report.getByRole('navigation', { name: 'Report navigation' })).toHaveCount(0);
  await expect(report.getByRole('status')).toHaveText('Checking GitHub connection…');
  await expect(report.locator('.filing-issue-title')).toHaveText('Saved title');
  await report.screenshot({ path: '/tmp/recorder-filing-fullscreen.png', animations: 'disabled' });
  await report.setViewportSize({ width: 1280, height: 900 });
  await report.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(report.locator('.filing-packet')).toHaveCSS('animation-name', 'none');
  await report.screenshot({ path: '/tmp/recorder-filing-desktop.png', animations: 'disabled' });
  await report.getByRole('button', { name: 'Cancel', exact: true }).click();
  wait = false;
  release();
  await expect(report.getByRole('alert')).toContainText('Cancelled.');
  expect(issues).toBe(0);
  await expect(report.getByLabel('Issue title')).toHaveValue('Saved title');
  await report.getByRole('button', { name: 'File GitHub issue', exact: true }).click();
  await expect(report.getByRole('link', { name: 'View issue #8' })).toBeVisible();
  expect(issues).toBe(1);
});
