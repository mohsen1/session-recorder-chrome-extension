/**
 * Smoke tests: the extension loads with a live service worker, a sane manifest,
 * and its React pages render.
 */
import { test, expect, extUrl } from './support';

test('loads with a service worker and the expected manifest', async ({
  background,
  extensionId,
}) => {
  expect(extensionId).toMatch(/^[a-z]{32}$/);

  const manifest = await background.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.name).toBe('Session Recorder');
  expect(manifest.permissions).toEqual(
    expect.arrayContaining(['debugger', 'sidePanel', 'downloads', 'offscreen']),
  );
  // Side panel + both keyboard commands wired.
  expect((manifest as Record<string, any>).side_panel?.default_path).toBe(
    'sidepanel.html',
  );
  expect(Object.keys((manifest as Record<string, any>).commands ?? {})).toEqual(
    expect.arrayContaining(['toggle-annotation', 'add-marker']),
  );

  // The test hook is installed on the SW global.
  const hasHook = await background.evaluate(
    () => typeof (globalThis as any).__srTest === 'function',
  );
  expect(hasHook).toBe(true);
});

test('side panel renders the Record button', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(extUrl(extensionId, 'sidepanel.html'));
  await expect(
    page.getByRole('button', { name: /record/i }),
  ).toBeVisible();
});

test('options page renders its settings sections', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(extUrl(extensionId, 'options.html'));
  await expect(page.getByRole('heading', { name: 'Transcription' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Redaction' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Capture' })).toBeVisible();
});
