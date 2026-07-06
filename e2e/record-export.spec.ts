/**
 * The crown-jewel E2E: record a real session against the demo page, then export
 * it through the actual side-panel UI and validate the zip's report.md.
 *
 * Recording is started via the `__srTest` hook with an explicit tab id. This is
 * deterministic and, as a bonus, exercises the graceful DEGRADED path: under
 * Playwright the extension's chrome.debugger cannot attach (Playwright already
 * holds the tab's CDP session), so deep capture (network/console/screenshots) is
 * unavailable — but interaction capture and the whole export pipeline still work,
 * which is exactly what we assert.
 */
import { unzipSync } from 'fflate';
import { test, expect, extUrl, dispatch, tabIdForUrl } from './support';
import type { Page } from '@playwright/test';

type StartRes = { ok: boolean; session?: { id: string; name: string }; error?: string };
type EventsRes = { events: Array<{ type: string; payload: any }> };

async function reachExportPanel(sp: Page): Promise<void> {
  const download = sp.getByRole('button', { name: /Download .zip/i });
  const row = sp.locator('.session-row__main').first();
  await Promise.race([
    download.waitFor({ state: 'visible' }).catch(() => {}),
    row.waitFor({ state: 'visible' }).catch(() => {}),
  ]);
  if (!(await download.isVisible().catch(() => false))) {
    await row.click();
  }
  await expect(download).toBeVisible();
}

test('records interactions and exports a readable, valid zip', async ({
  context,
  background,
  extensionId,
}) => {
  // 1) Open the demo page and let its content scripts load.
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Demo');

  // 2) Start recording against the demo tab (degraded-mode-safe).
  const tabId = await tabIdForUrl(background, 'http://localhost:5319');
  const started = await dispatch<StartRes>(background, {
    kind: 'session/start',
    tabId,
  });
  expect(started.ok).toBe(true);
  const sessionId = started.session!.id;

  // 3) Give the background a beat to activate the content script.
  await page.waitForTimeout(800);

  // 4) Interact with the page — these flow through the content script → funnel.
  await page.click('#btn-get');
  await page.click('#btn-log');
  await page.fill('#f-user', 'ada lovelace');
  await page.click('#btn-post');
  await page.fill('#f-pass', 'hunter2'); // must be redacted
  // Same-origin request so a net-request is captured deterministically, without
  // depending on the demo page's external endpoints being reachable.
  await page.evaluate(() => fetch(`/probe-${Date.now()}`).catch(() => {}));
  // Let the input debounce (800ms) flush, plus a click to blur.
  await page.waitForTimeout(1000);
  await page.click('#btn-console-error');
  await page.waitForTimeout(400);

  // 5) Drop a marker via the hook (explicit user signal).
  await dispatch(background, { kind: 'marker/add', name: 'BUG HERE' });

  // 6) Stop.
  await dispatch(background, { kind: 'session/stop' });

  // 7) Assert the captured events look right.
  const { events } = await dispatch<EventsRes>(background, {
    kind: 'events/get',
    sessionId,
  });
  const types = events.map((e) => e.type);
  expect(types).toContain('click');
  expect(types).toContain('marker');

  const clickTexts = events
    .filter((e) => e.type === 'click')
    .map((e) => e.payload?.descriptor?.text)
    .filter(Boolean);
  expect(clickTexts).toContain('GET fetch');

  // Password input, if captured, must be redacted (never the raw value).
  const inputs = events.filter((e) => e.type === 'input');
  for (const ev of inputs) {
    if (ev.payload?.redacted) {
      expect(ev.payload.value).not.toContain('hunter2');
    }
  }
  const serialized = JSON.stringify(events);
  expect(serialized).not.toContain('hunter2'); // not in value, text, or anywhere

  // The recorder adapts to its environment: either the debugger attached and we
  // have deep capture (net-request events), or it degraded and left a note.
  // Exactly one must hold — the session is never silently empty of both.
  const hasNet = types.includes('net-request');
  const hasDegradedNote = events.some(
    (e) => e.type === 'session-note' && /Deep capture unavailable/.test(e.payload?.text ?? ''),
  );
  expect(hasNet || hasDegradedNote).toBe(true);

  // 8) Export through the real side-panel UI.
  const sp = await context.newPage();
  await sp.goto(extUrl(extensionId, 'sidepanel.html'));
  await reachExportPanel(sp);

  // Four verbosity levels with token estimates are shown.
  await expect(sp.locator('input[name="verbosity"]')).toHaveCount(4);
  await expect(sp.locator('.level__tokens').first()).toBeVisible();

  // 9) Capture the real Download-button output by intercepting chrome.downloads.
  await sp.evaluate(() => {
    (window as any).__dl = null;
    chrome.downloads.download = (async (opts: { url: string; filename: string }) => {
      const buf = await fetch(opts.url).then((r) => r.arrayBuffer());
      (window as any).__dl = {
        name: opts.filename,
        bytes: Array.from(new Uint8Array(buf)),
      };
      return 1;
    }) as typeof chrome.downloads.download;
  });

  // Pick the Full (L0) level so bodies/labels are present, then download.
  await sp.locator('input[name="verbosity"][value="L0"]').check();
  await sp.getByRole('button', { name: /Download .zip/i }).click();
  await sp.waitForFunction(() => (window as any).__dl !== null, undefined, {
    timeout: 20_000,
  });

  const dl = (await sp.evaluate(() => (window as any).__dl)) as {
    name: string;
    bytes: number[];
  };
  expect(dl.name).toMatch(/\.zip$/);

  // 10) Unzip and validate report.md.
  const files = unzipSync(Uint8Array.from(dl.bytes));
  const reportKey = Object.keys(files).find((k) => k.endsWith('/report.md'));
  expect(reportKey, 'zip contains report.md').toBeTruthy();
  const report = new TextDecoder().decode(files[reportKey!]);

  expect(report).toContain('# Session Report');
  expect(report).toContain('GET fetch'); // a click we performed
  expect(report).toContain('BUG HERE'); // our marker
  expect(report).not.toContain('hunter2'); // redaction held
  // session.json is present and valid.
  const jsonKey = Object.keys(files).find((k) => k.endsWith('/session.json'));
  expect(jsonKey).toBeTruthy();
  JSON.parse(new TextDecoder().decode(files[jsonKey!]));
});
