/**
 * Tracks tab lifecycle so a recording session can follow the user across tabs.
 *
 * Registers `chrome.tabs` listeners: a tab opened by a session tab is adopted
 * into the session; the active tab and closed tabs are reported to the caller.
 * `start()` attaches the listeners (storing bound refs) and `stop()` removes
 * them, so tracking can be toggled with the session lifecycle.
 */

export interface MultiTabDeps {
  isSessionTab: (tabId: number) => boolean;
  adopt: (tabId: number, openerTabId?: number) => Promise<void>;
  onActivated: (tabId: number) => void;
  onClosed: (tabId: number) => void;
}

export class MultiTabTracker {
  private readonly deps: MultiTabDeps;
  private started = false;

  // Bound listener refs, kept so stop() can remove the exact same functions.
  private readonly onCreated = (tab: chrome.tabs.Tab): void => {
    const { id, openerTabId } = tab;
    if (id === undefined || openerTabId === undefined) return;
    if (this.deps.isSessionTab(openerTabId)) {
      // adopt() is async; swallow rejections so a failed adopt can't break the
      // listener (Chrome ignores the return value anyway).
      void Promise.resolve(this.deps.adopt(id, openerTabId)).catch(() => {});
    }
  };

  private readonly onActivated = (
    info: chrome.tabs.TabActiveInfo,
  ): void => {
    this.deps.onActivated(info.tabId);
  };

  private readonly onRemoved = (
    tabId: number,
    _info: chrome.tabs.TabRemoveInfo,
  ): void => {
    this.deps.onClosed(tabId);
  };

  constructor(deps: MultiTabDeps) {
    this.deps = deps;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    chrome.tabs.onCreated.addListener(this.onCreated);
    chrome.tabs.onActivated.addListener(this.onActivated);
    chrome.tabs.onRemoved.addListener(this.onRemoved);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    chrome.tabs.onCreated.removeListener(this.onCreated);
    chrome.tabs.onActivated.removeListener(this.onActivated);
    chrome.tabs.onRemoved.removeListener(this.onRemoved);
  }
}
