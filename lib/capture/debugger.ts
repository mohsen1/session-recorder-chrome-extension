/**
 * Thin wrapper over `chrome.debugger` (CDP protocol `1.3`).
 *
 * Owns the debugger attachment for every session tab: attaching enables the
 * Network/Page/Runtime/Log domains, `send()` promisifies `sendCommand`, and a
 * single `onEvent`/`onDetach` pair (registered once in the constructor) fans out
 * to the capturers that register handlers. All the ugly `chrome.runtime.lastError`
 * plumbing and the human-readable error phrasing live here so the callers can
 * work in plain async/await.
 */

/** A CDP protocol event, routed to every registered handler. */
export type CdpEventHandler = (
  tabId: number,
  method: string,
  params: Record<string, unknown>,
) => void;

/** Fired when the debugger detaches from a tab (DevTools opened, tab closed, …). */
export type DetachHandler = (tabId: number, reason: string) => void;

const PROTOCOL_VERSION = '1.3';

/**
 * Domains enabled on every freshly attached tab, in order. `Network.enable`
 * carries large buffers so bodies aren't evicted before `getResponseBody`.
 */
const ENABLE_SEQUENCE: ReadonlyArray<{ method: string; params?: object }> = [
  {
    method: 'Network.enable',
    params: {
      maxTotalBufferSize: 100_000_000,
      maxResourceBufferSize: 50_000_000,
    },
  },
  { method: 'Page.enable' },
  { method: 'Runtime.enable' },
  { method: 'Log.enable' },
];

/**
 * Translate a raw `chrome.runtime.lastError` message into an `Error` with a
 * message a human can act on. Falls back to the raw text when we don't recognize
 * the failure.
 */
function toReadableError(rawMessage: string | undefined, tabId: number): Error {
  const raw = rawMessage ?? 'unknown error';
  const lower = raw.toLowerCase();

  if (lower.includes('cannot attach to this target')) {
    return new Error(
      `Cannot record this tab (${tabId}): the page can't be inspected ` +
        `(e.g. a chrome:// page, the Web Store, or another restricted URL).`,
    );
  }
  if (lower.includes('another debugger') || lower.includes('already attached')) {
    return new Error(
      `Cannot record tab ${tabId}: another debugger is already attached. ` +
        `Close DevTools (or any other extension using the debugger) for this tab and try again.`,
    );
  }
  if (lower.includes('devtools')) {
    return new Error(
      `Cannot record tab ${tabId}: DevTools is open on this tab. ` +
        `Close DevTools and try again.`,
    );
  }
  return new Error(`Debugger error on tab ${tabId}: ${raw}`);
}

export class DebuggerManager {
  private readonly attached = new Set<number>();
  private readonly eventHandlers: CdpEventHandler[] = [];
  private readonly detachHandlers: DetachHandler[] = [];
  private disposed = false;

  /** Bound listeners, kept so they can be removed in `dispose()`. */
  private readonly onEventListener = (
    source: chrome.debugger.Debuggee,
    method: string,
    params?: object,
  ): void => {
    if (source.tabId === undefined) return;
    const tabId = source.tabId;
    const p = (params ?? {}) as Record<string, unknown>;
    for (const h of this.eventHandlers) {
      h(tabId, method, p);
    }
  };

  private readonly onDetachListener = (
    source: chrome.debugger.Debuggee,
    reason: string,
  ): void => {
    if (source.tabId === undefined) return;
    const tabId = source.tabId;
    this.attached.delete(tabId);
    for (const h of this.detachHandlers) {
      h(tabId, reason);
    }
  };

  constructor() {
    chrome.debugger.onEvent.addListener(this.onEventListener);
    chrome.debugger.onDetach.addListener(this.onDetachListener);
  }

  /**
   * Attach the debugger to a tab and enable the capture domains. Idempotent: a
   * no-op (resolves immediately) if the tab is already attached. Throws an
   * `Error` with a human-readable `.message` on failure.
   */
  async attach(tabId: number): Promise<void> {
    if (this.attached.has(tabId)) return;

    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach({ tabId }, PROTOCOL_VERSION, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(toReadableError(err.message, tabId));
          return;
        }
        resolve();
      });
    });

    // Mark attached before enabling domains so a mid-sequence detach event can
    // clean up correctly and so `send()` won't reject on "not attached".
    this.attached.add(tabId);

    try {
      for (const { method, params } of ENABLE_SEQUENCE) {
        await this.send(tabId, method, params);
      }
    } catch (e) {
      // Enabling failed after a successful attach — roll back so the tab isn't
      // left half-initialized, then surface the error.
      await this.detach(tabId);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  /**
   * Detach from a tab. Swallows the "not attached" error so callers can detach
   * unconditionally during teardown.
   */
  async detach(tabId: number): Promise<void> {
    this.attached.delete(tabId);
    await new Promise<void>((resolve) => {
      chrome.debugger.detach({ tabId }, () => {
        // Read lastError to consume it; "not attached" is expected and ignored.
        void chrome.runtime.lastError;
        resolve();
      });
    });
  }

  isAttached(tabId: number): boolean {
    return this.attached.has(tabId);
  }

  attachedTabs(): number[] {
    return [...this.attached];
  }

  /**
   * Send a CDP command to a tab and resolve with its result. Rejects with a
   * readable `Error` on `chrome.runtime.lastError`.
   */
  send<T = Record<string, unknown>>(
    tabId: number,
    method: string,
    params?: object,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(toReadableError(err.message, tabId));
          return;
        }
        resolve((result ?? {}) as T);
      });
    });
  }

  /** Register a handler for all CDP events (shares one underlying listener). */
  onEvent(h: CdpEventHandler): void {
    this.eventHandlers.push(h);
  }

  /** Register a handler for debugger detach (shares one underlying listener). */
  onDetach(h: DetachHandler): void {
    this.detachHandlers.push(h);
  }

  /** Capture a JPEG screenshot of the tab. `data` is base64 (no `data:` prefix). */
  async captureScreenshot(
    tabId: number,
    quality: number,
  ): Promise<{ data: string }> {
    const result = await this.send<{ data: string }>(
      tabId,
      'Page.captureScreenshot',
      { format: 'jpeg', quality },
    );
    return { data: result.data };
  }

  /** Remove the shared listeners and detach from every attached tab. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    chrome.debugger.onEvent.removeListener(this.onEventListener);
    chrome.debugger.onDetach.removeListener(this.onDetachListener);

    const tabs = [...this.attached];
    this.attached.clear();
    this.eventHandlers.length = 0;
    this.detachHandlers.length = 0;

    for (const tabId of tabs) {
      chrome.debugger.detach({ tabId }, () => {
        void chrome.runtime.lastError;
      });
    }
  }
}
