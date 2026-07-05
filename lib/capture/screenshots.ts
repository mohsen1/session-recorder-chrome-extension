/**
 * Screenshot scheduler: turns recorded events into de-duplicated screenshot
 * captures according to the session's `screenshotPolicy`.
 *
 * Runs in the background service worker. It asks the debugger for a JPEG, decodes
 * it to learn the dimensions, computes an average-hash to drop near-duplicates,
 * and (when the shot is novel) stores it and emits a `screenshot` event.
 */

import type {
  CaptureSettings,
  RawEvent,
  ScreenshotTrigger,
  SessionEvent,
} from '@/lib/session/types';
import { averageHashFromBlob, hammingHex } from '@/lib/util/hash';

export interface ScreenshotDeps {
  captureScreenshot: (
    tabId: number,
    quality: number,
  ) => Promise<{ data: string }>; // = DebuggerManager.captureScreenshot
  getSettings: () => CaptureSettings;
  emit: (raw: RawEvent) => void;
  storeScreenshot: (
    jpegBase64: string,
  ) => Promise<{ assetId: string; size: number }>;
}

/** Per-tab debounce window for the `every-interaction` policy. */
const DEBOUNCE_MS = 500;

/** Event types that trigger a shot under the `every-interaction` policy. */
const EVERY_INTERACTION_TYPES: ReadonlySet<SessionEvent['type']> =
  new Set<SessionEvent['type']>([
    'click',
    'key',
    'scroll',
    'nav',
    'spa-route',
    'tab-switch',
  ]);

/** Tab-related event types that count as key moments. */
const TAB_TYPES: ReadonlySet<SessionEvent['type']> =
  new Set<SessionEvent['type']>(['tab-switch', 'tab-opened', 'tab-closed']);

/** Map an event type to the screenshot trigger it represents. */
function triggerForEvent(type: SessionEvent['type']): ScreenshotTrigger {
  if (type === 'nav' || type === 'spa-route') return 'nav';
  if (type === 'error' || type === 'net-request') return 'error';
  return 'interaction';
}

/** Decode a raw (non-prefixed) base64 string into a typed Blob. */
function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export class ScreenshotScheduler {
  private readonly deps: ScreenshotDeps;

  /** Pending debounce timer per tab (every-interaction policy). */
  private readonly debounceTimers = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();

  /** Last stored screenshot's average-hash per tab, for dedup. */
  private readonly lastHashByTab = new Map<number, string>();

  constructor(deps: ScreenshotDeps) {
    this.deps = deps;
  }

  /** Apply the active policy to a just-recorded event. */
  onEvent(e: SessionEvent): void {
    try {
      const settings = this.deps.getSettings();
      const policy = settings.screenshotPolicy;
      if (policy === 'on-demand') return;

      const tabId = e.tabId;
      if (typeof tabId !== 'number') return;

      if (policy === 'every-interaction') {
        if (!EVERY_INTERACTION_TYPES.has(e.type)) return;
        const trigger = triggerForEvent(e.type);
        const existing = this.debounceTimers.get(tabId);
        if (existing !== undefined) clearTimeout(existing);
        const timer = setTimeout(() => {
          this.debounceTimers.delete(tabId);
          void this.capture(tabId, trigger);
        }, DEBOUNCE_MS);
        this.debounceTimers.set(tabId, timer);
        return;
      }

      // policy === 'key-moments'
      let fire = false;
      if (
        e.type === 'nav' ||
        e.type === 'spa-route' ||
        e.type === 'error' ||
        TAB_TYPES.has(e.type)
      ) {
        fire = true;
      } else if (e.type === 'net-request') {
        const status = e.payload.status;
        if (typeof status === 'number' && status >= 400) fire = true;
      }
      if (!fire) return;

      void this.capture(tabId, triggerForEvent(e.type));
    } catch {
      /* never let scheduling break the capture funnel */
    }
  }

  /** Take an explicit/manual screenshot, applying dedup before storing. */
  async capture(
    tabId: number,
    trigger: ScreenshotTrigger,
    contextText?: string,
  ): Promise<void> {
    try {
      const settings = this.deps.getSettings();
      const { data } = await this.deps.captureScreenshot(
        tabId,
        settings.screenshotQuality,
      );

      const blob = base64ToBlob(data, 'image/jpeg');
      const bitmap = await createImageBitmap(blob);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();

      const ahash = await averageHashFromBlob(blob);

      // Explicit, user-driven captures are never deduped: a manual shot is
      // always wanted, and an annotation-exit shot MUST produce an asset so the
      // annotation event has a backing image. Only automatic capture (interaction
      // / nav / key-moment / error) is subject to near-duplicate suppression.
      const explicit = trigger === 'manual' || trigger === 'annotation';
      const last = this.lastHashByTab.get(tabId);
      if (
        !explicit &&
        last !== undefined &&
        hammingHex(ahash, last) <= settings.screenshotDedupThreshold
      ) {
        return; // near-duplicate — drop without storing or emitting
      }

      const { assetId } = await this.deps.storeScreenshot(data);
      this.deps.emit({
        type: 'screenshot',
        tabId,
        payload: {
          assetId,
          width,
          height,
          trigger,
          ahash,
          contextText,
        },
      });
      this.lastHashByTab.set(tabId, ahash);
    } catch {
      /* screenshot failures are non-fatal to the recording */
    }
  }

  /** Clear pending timers and dedup state (session end / tab teardown). */
  reset(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.lastHashByTab.clear();
  }
}
