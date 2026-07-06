/**
 * Multi-tab following: a noopener popup (no openerTabId, so only
 * webNavigation.onCreatedNavigationTarget can see it) is adopted into the
 * session, and closing it records tab-closed and re-points the session at a
 * live tab. Runs on the degraded path — under Playwright chrome.debugger can
 * never attach — which is exactly why adopt() must not abort on attach failure.
 */
import { test, expect, dispatch, tabIdForUrl } from './support';

type StartRes = { ok: boolean; session?: { id: string }; error?: string };
type EventsRes = { events: Array<{ type: string; tabId?: number; payload: any }> };
type StateRes = {
  session: {
    status: string;
    tabs: Array<{
      tabId: number;
      role: string;
      url: string;
      attached: boolean;
      detachedAt?: number;
    }>;
  } | null;
};

test('follows a noopener popup and books it out again on close', async ({
  context,
  background,
}) => {
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Demo');

  const tabId = await tabIdForUrl(background, 'http://localhost:5319');
  const started = await dispatch<StartRes>(background, {
    kind: 'session/start',
    tabId,
  });
  expect(started.ok).toBe(true);
  const sessionId = started.session!.id;
  await page.waitForTimeout(500);

  // Open a second demo page WITHOUT an opener relationship: chrome.tabs.onCreated
  // sees no openerTabId for this tab, so adoption must come from
  // webNavigation.onCreatedNavigationTarget.
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.evaluate(() => {
      window.open(`${location.origin}/?pop=1`, '_blank', 'noopener');
    }),
  ]);
  await popup.waitForLoadState();

  // The popup was adopted: tab-opened recorded, adopted TabInfo registered.
  await expect
    .poll(async () => {
      const { events } = await dispatch<EventsRes>(background, {
        kind: 'events/get',
        sessionId,
      });
      return events.filter((e) => e.type === 'tab-opened').length;
    })
    .toBeGreaterThan(0);

  const mid = await dispatch<StateRes>(background, { kind: 'session/getState' });
  const adopted = mid.session!.tabs.find((t) => t.role === 'adopted');
  expect(adopted).toBeTruthy();
  expect(adopted!.url).toContain('pop=1');
  const adoptedTabId = adopted!.tabId;

  // Interactions in the adopted tab flow into the session (content scripts run
  // there even though the debugger could not attach).
  await popup.waitForTimeout(500);
  await popup.click('h1');
  await expect
    .poll(async () => {
      const { events } = await dispatch<EventsRes>(background, {
        kind: 'events/get',
        sessionId,
      });
      return events.some((e) => e.type === 'click' && e.tabId === adoptedTabId);
    })
    .toBe(true);

  // Close the popup: tab-closed is recorded and the registry books the tab out.
  await popup.close();
  await expect
    .poll(async () => {
      const { events } = await dispatch<EventsRes>(background, {
        kind: 'events/get',
        sessionId,
      });
      return events.some(
        (e) => e.type === 'tab-closed' && e.tabId === adoptedTabId,
      );
    })
    .toBe(true);

  const after = await dispatch<StateRes>(background, { kind: 'session/getState' });
  expect(after.session!.status).toBe('recording');
  const closed = after.session!.tabs.find((t) => t.tabId === adoptedTabId);
  expect(closed!.attached).toBe(false);
  expect(closed!.detachedAt).toBeGreaterThan(0);

  await dispatch(background, { kind: 'session/stop' });
});
