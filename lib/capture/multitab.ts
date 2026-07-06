/**
 * Tracks tab lifecycle so a recording session can follow the user across tabs.
 *
 * Registers `chrome.tabs` listeners: a tab opened by a session tab is adopted
 * into the session; the active tab and closed tabs are reported to the caller.
 * `chrome.webNavigation.onCreatedNavigationTarget` covers tabs created without
 * an `openerTabId` (window.open with noopener, rel=noopener _blank links) —
 * both creation paths funnel through a pending-adoption guard so the double
 * fire for ordinary _blank links adopts only once.
 * `start()` attaches the listeners (storing bound refs) and `stop()` removes
 * them, so tracking can be toggled with the session lifecycle.
 */

export interface MultiTabDeps {
  isSessionTab: (tabId: number) => boolean;
  adopt: (tabId: number, openerTabId?: number, urlHint?: string) => Promise<void>;
  onActivated: (tabId: number) => void;
  onClosed: (tabId: number) => void;
}

export class MultiTabTracker {
  private readonly deps: MultiTabDeps;
  private started = false;

  // Tabs with an adopt() in flight. tabs.onCreated and onCreatedNavigationTarget
  // both fire for ordinary _blank links, and adopt()'s own isSessionTab guard
  // only runs after its first await — so dedupe synchronously here.
  private readonly pendingAdopt = new Set<number>();

  // Bound listener refs, kept so stop() can remove the exact same functions.
  private readonly onCreated = (tab: chrome.tabs.Tab): void => {
    const { id, openerTabId } = tab;
    if (id === undefined || openerTabId === undefined) return;
    if (this.deps.isSessionTab(openerTabId)) {
      this.requestAdopt(id, openerTabId, tab.pendingUrl);
    }
  };

  // Fires for tabs a session page opens even when Chrome omits openerTabId
  // (noopener). Carries the target URL, which the tab itself may not know yet.
  private readonly onCreatedNavTarget = (
    details: chrome.webNavigation.WebNavigationSourceCallbackDetails,
  ): void => {
    if (this.deps.isSessionTab(details.sourceTabId)) {
      this.requestAdopt(details.tabId, details.sourceTabId, details.url);
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

  private requestAdopt(tabId: number, openerTabId?: number, urlHint?: string): void {
    if (this.pendingAdopt.has(tabId)) return;
    this.pendingAdopt.add(tabId);
    // adopt() is async; swallow rejections so a failed adopt can't break the
    // listener (Chrome ignores the return value anyway).
    void Promise.resolve(this.deps.adopt(tabId, openerTabId, urlHint))
      .catch(() => {})
      .finally(() => this.pendingAdopt.delete(tabId));
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    chrome.tabs.onCreated.addListener(this.onCreated);
    chrome.tabs.onActivated.addListener(this.onActivated);
    chrome.tabs.onRemoved.addListener(this.onRemoved);
    chrome.webNavigation.onCreatedNavigationTarget.addListener(this.onCreatedNavTarget);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    chrome.tabs.onCreated.removeListener(this.onCreated);
    chrome.tabs.onActivated.removeListener(this.onActivated);
    chrome.tabs.onRemoved.removeListener(this.onRemoved);
    chrome.webNavigation.onCreatedNavigationTarget.removeListener(this.onCreatedNavTarget);
  }
}
