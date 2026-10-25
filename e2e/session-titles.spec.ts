import { test, expect, dispatch, tabIdForUrl, extUrl } from './support';

test('names stopped sessions from annotations, updates the list, and preserves a manual rename', async ({ context, background, extensionId }) => {
  const demo = await context.newPage();
  await demo.goto('/');
  const tabId = await tabIdForUrl(background, 'http://localhost:5319');
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 390, height: 844 });
  await panel.emulateMedia({ colorScheme: 'dark' });
  await panel.goto(extUrl(extensionId, 'sidepanel.html'));
  await background.evaluate(async () => chrome.storage.local.set({ sharingSettings: {
    provider: 'openai', models: { openai: { apiKey: 'test-key', model: 'test-model', baseUrl: 'https://api.openai.com/v1' } },
  } }));
  const releases: Array<() => void> = [];
  let completed = 0;
  await context.route('https://api.openai.com/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.messages[0].content).toContain('Name this recorded session');
    expect(body.messages[1].content).toContain('Add help for finishing recipes');
    await new Promise<void>((resolve) => releases.push(resolve));
    await route.fulfill({ json: { choices: [{ message: { content: '{"title":"Finishing recipes: help and empty states"}' } }] } });
    completed++;
  });
  async function record() {
    const { session } = await dispatch<{ session: { id: string } }>(background, { kind: 'session/start', tabId });
    await dispatch(background, { kind: 'note/add', text: 'Add help for finishing recipes' });
    await dispatch(background, { kind: 'session/stop' });
    return session.id;
  }
  const first = await record();
  await expect.poll(() => releases.length).toBe(1);
  await expect(panel.getByText('Recording ready', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Open report', exact: true })).toHaveCount(0);
  releases[0]!();
  await expect(panel.locator('.session-row__name')).toHaveText('Finishing recipes: help and empty states');
  await panel.reload();
  await expect(panel.locator('.session-row__name')).toHaveText('Finishing recipes: help and empty states');
  await expect(panel.locator('.session-row__meta')).toContainText('Just now');
  await expect(panel.locator('.session-row__meta')).not.toContainText(/KB|MB/);
  await expect(panel.getByText('Sessions', { exact: true })).toHaveCount(0);
  await panel.screenshot({ path: '/tmp/recorder-session-titles.png' });
  const second = await record();
  await expect.poll(() => releases.length).toBe(2);
  await dispatch(background, { kind: 'session/rename', sessionId: second, name: 'My own session name' });
  releases[1]!();
  await expect.poll(() => completed).toBe(2);
  await expect.poll(async () => (await dispatch<{session:{name:string}}>(background, { kind: 'session/get', sessionId: second })).session.name).toBe('My own session name');
  await expect(panel.locator('.session-row__name')).toContainText(['My own session name', 'Finishing recipes: help and empty states']);
  expect(first).not.toBe(second);
});
