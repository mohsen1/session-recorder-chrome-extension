import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiTabTracker, type MultiTabDeps } from './multitab';

/** Minimal chrome.events.Event fake that records its listeners. */
function fakeEvent() {
  const listeners = new Set<(...args: unknown[]) => void>();
  return {
    listeners,
    addListener: vi.fn((fn: (...args: unknown[]) => void) => listeners.add(fn)),
    removeListener: vi.fn((fn: (...args: unknown[]) => void) => listeners.delete(fn)),
    fire(...args: unknown[]) {
      for (const fn of [...listeners]) fn(...args);
    },
  };
}

type FakeEvent = ReturnType<typeof fakeEvent>;

describe('MultiTabTracker', () => {
  let onCreated: FakeEvent;
  let onActivated: FakeEvent;
  let onRemoved: FakeEvent;
  let onCreatedNavTarget: FakeEvent;
  let deps: {
    isSessionTab: ReturnType<typeof vi.fn>;
    adopt: ReturnType<typeof vi.fn>;
    onActivated: ReturnType<typeof vi.fn>;
    onClosed: ReturnType<typeof vi.fn>;
  };
  let tracker: MultiTabTracker;

  beforeEach(() => {
    onCreated = fakeEvent();
    onActivated = fakeEvent();
    onRemoved = fakeEvent();
    onCreatedNavTarget = fakeEvent();
    vi.stubGlobal('chrome', {
      tabs: { onCreated, onActivated, onRemoved },
      webNavigation: { onCreatedNavigationTarget: onCreatedNavTarget },
    });
    deps = {
      isSessionTab: vi.fn((id: number) => id === 1),
      adopt: vi.fn(() => Promise.resolve()),
      onActivated: vi.fn(),
      onClosed: vi.fn(),
    };
    tracker = new MultiTabTracker(deps as unknown as MultiTabDeps);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const flush = () => new Promise<void>((r) => setTimeout(r, 0));

  it('start() registers all four listeners and stop() removes the same refs', () => {
    tracker.start();
    expect(onCreated.listeners.size).toBe(1);
    expect(onActivated.listeners.size).toBe(1);
    expect(onRemoved.listeners.size).toBe(1);
    expect(onCreatedNavTarget.listeners.size).toBe(1);

    tracker.stop();
    expect(onCreated.listeners.size).toBe(0);
    expect(onActivated.listeners.size).toBe(0);
    expect(onRemoved.listeners.size).toBe(0);
    expect(onCreatedNavTarget.listeners.size).toBe(0);
    // Removal used the exact refs that were added.
    expect(onCreated.removeListener).toHaveBeenCalledWith(
      onCreated.addListener.mock.calls[0]![0],
    );
    expect(onCreatedNavTarget.removeListener).toHaveBeenCalledWith(
      onCreatedNavTarget.addListener.mock.calls[0]![0],
    );
  });

  it('adopts a created tab whose opener is a session tab, passing pendingUrl', () => {
    tracker.start();
    onCreated.fire({ id: 7, openerTabId: 1, pendingUrl: 'https://app.example/next' });
    expect(deps.adopt).toHaveBeenCalledTimes(1);
    expect(deps.adopt).toHaveBeenCalledWith(7, 1, 'https://app.example/next');
  });

  it('ignores created tabs without an opener or with a non-session opener', () => {
    tracker.start();
    onCreated.fire({ id: 7 });
    onCreated.fire({ id: 8, openerTabId: 99 });
    expect(deps.adopt).not.toHaveBeenCalled();
  });

  it('adopts via onCreatedNavigationTarget when the source is a session tab (noopener)', () => {
    tracker.start();
    onCreatedNavTarget.fire({ sourceTabId: 1, tabId: 9, url: 'https://app.example/pop' });
    expect(deps.adopt).toHaveBeenCalledTimes(1);
    expect(deps.adopt).toHaveBeenCalledWith(9, 1, 'https://app.example/pop');
  });

  it('ignores onCreatedNavigationTarget from non-session source tabs', () => {
    tracker.start();
    onCreatedNavTarget.fire({ sourceTabId: 42, tabId: 9, url: 'https://x/' });
    expect(deps.adopt).not.toHaveBeenCalled();
  });

  it('dedupes the onCreated + onCreatedNavigationTarget double fire for the same tab', async () => {
    let resolveAdopt: () => void = () => {};
    deps.adopt.mockImplementation(
      () => new Promise<void>((r) => (resolveAdopt = r)),
    );
    tracker.start();
    onCreated.fire({ id: 5, openerTabId: 1 });
    onCreatedNavTarget.fire({ sourceTabId: 1, tabId: 5, url: 'https://x/' });
    expect(deps.adopt).toHaveBeenCalledTimes(1);

    // Once the first adopt settles the guard clears, so a later creation event
    // for a reused id (still not a session tab) may adopt again.
    resolveAdopt();
    await flush();
    onCreatedNavTarget.fire({ sourceTabId: 1, tabId: 5, url: 'https://x/' });
    expect(deps.adopt).toHaveBeenCalledTimes(2);
  });

  it('swallows a rejecting adopt and clears the pending guard', async () => {
    deps.adopt.mockRejectedValueOnce(new Error('boom'));
    tracker.start();
    onCreated.fire({ id: 6, openerTabId: 1 });
    await flush(); // no unhandled rejection
    onCreated.fire({ id: 6, openerTabId: 1 });
    expect(deps.adopt).toHaveBeenCalledTimes(2);
  });

  it('forwards activation and removal, but not after stop()', () => {
    tracker.start();
    onActivated.fire({ tabId: 3, windowId: 1 });
    onRemoved.fire(4, { windowId: 1, isWindowClosing: false });
    expect(deps.onActivated).toHaveBeenCalledTimes(1);
    expect(deps.onActivated).toHaveBeenCalledWith(3);
    expect(deps.onClosed).toHaveBeenCalledTimes(1);
    expect(deps.onClosed).toHaveBeenCalledWith(4);

    tracker.stop();
    onActivated.fire({ tabId: 30, windowId: 1 });
    onRemoved.fire(40, { windowId: 1, isWindowClosing: false });
    expect(deps.onActivated).toHaveBeenCalledTimes(1);
    expect(deps.onClosed).toHaveBeenCalledTimes(1);
  });
});
