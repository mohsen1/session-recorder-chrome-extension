/**
 * Playwright fixtures for driving the loaded extension.
 *
 * `context` launches a persistent Chromium with the built extension; `background`
 * is its MV3 service worker (used to read the manifest and to drive the recorder
 * through the test-only `__srTest` hook); `extensionId` is derived from the SW URL.
 */
import {
  test as base,
  chromium,
  expect as pwExpect,
  type BrowserContext,
  type Worker,
} from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
export const EXT_PATH = path.resolve(dir, '..', '.output', 'chrome-mv3');

type Fixtures = {
  context: BrowserContext;
  background: Worker;
  extensionId: string;
};

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const headed = !!process.env.HEADED;
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !headed,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    await use(context);
    await context.close();
  },
  background: async ({ context }, use) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw);
  },
  extensionId: async ({ background }, use) => {
    await use(new URL(background.url()).host);
  },
});

export const expect = pwExpect;

export function extUrl(extensionId: string, page: string): string {
  return `chrome-extension://${extensionId}/${page}`;
}

/** Drive the background's real message dispatcher via the test hook. */
export async function dispatch<T = unknown>(
  background: Worker,
  msg: Record<string, unknown>,
  senderTabId?: number,
): Promise<T> {
  return background.evaluate(
    (arg) =>
      (globalThis as unknown as { __srTest: (m: unknown, t?: number) => Promise<T> }).__srTest(
        arg.msg,
        arg.tabId,
      ),
    { msg, tabId: senderTabId },
  );
}

/** Resolve the chrome tab id of the first tab whose URL starts with `prefix`. */
export async function tabIdForUrl(
  background: Worker,
  prefix: string,
): Promise<number> {
  return background.evaluate(async (p) => {
    const tabs = await chrome.tabs.query({});
    const t = tabs.find((tab) => tab.url && tab.url.startsWith(p));
    if (!t || t.id === undefined) throw new Error(`No tab for ${p}`);
    return t.id;
  }, prefix);
}
