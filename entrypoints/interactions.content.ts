/**
 * Interaction capture content script (ISOLATED world, all frames).
 *
 * Dormant by default. On activation it attaches capture-phase DOM listeners and
 * forwards user interactions (click / input / scroll / key) to the background as
 * `capture/event` messages. Navigation and SPA routing are captured in the
 * background via chrome.webNavigation, NOT here. All posts are fire-and-forget;
 * this script never throws into page code.
 */

import { defineContentScript } from 'wxt/sandbox';

import { buildDescriptor, bestSelector, isSensitiveInput } from '@/lib/dom/descriptor';
import { isAnnotationOverlay } from '@/lib/dom/overlay';
import { onContentMessage, sendMessage } from '@/lib/messaging';
import type {
  EventPayloadMap,
  EventType,
  Point,
  RawEvent,
} from '@/lib/session/types';

/** Redaction marker for sensitive input values (mirrors REDACTED in lib/capture/redaction). */
const REDACTED = '«redacted»';

/** Per-element input debounce window. */
const INPUT_DEBOUNCE_MS = 800;
/** Scroll-run idle window before a coalesced scroll event is recorded. */
const SCROLL_IDLE_MS = 300;

/** Keyboard keys that are never a chord "letter" on their own. */
const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'OS']);
/** Bare keys always worth recording (even without a modifier chord). */
const NAMED_KEYS = new Set(['Enter', 'Escape', 'Tab']);

interface ScrollRun {
  from: Point;
  to: Point;
  container: string;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_start',
  matchAboutBlank: true,
  main() {
    // Guard against double-injection (manifest load + record-start injection).
    const w = window as unknown as { __srInteractions?: boolean };
    if (w.__srInteractions) return;
    w.__srInteractions = true;

    let active = false;
    // Paused while the annotation editor is open, so drawing does not get
    // recorded as page interactions.
    let annotating = false;

    // Pending per-element input debounce timers.
    const inputTimers = new Map<Element, ReturnType<typeof setTimeout>>();
    // Active scroll runs keyed by their scroll target (document or element).
    const scrollRuns = new Map<EventTarget, ScrollRun>();

    // -- posting -------------------------------------------------------------

    async function safeSend(event: RawEvent): Promise<void> {
      try {
        await sendMessage({ kind: 'capture/event', event });
      } catch {
        /* background asleep / context gone — drop it */
      }
    }

    function post<T extends EventType>(type: T, payload: EventPayloadMap[T]): void {
      if (annotating) return; // no interaction capture while annotating
      const event: RawEvent<T> = { type, at: Date.now(), payload };
      void safeSend(event);
    }

    // -- helpers -------------------------------------------------------------

    function modifiersOf(e: MouseEvent | KeyboardEvent): string[] {
      const m: string[] = [];
      if (e.ctrlKey) m.push('ctrl');
      if (e.shiftKey) m.push('shift');
      if (e.altKey) m.push('alt');
      if (e.metaKey) m.push('meta');
      return m;
    }

    function keyString(e: KeyboardEvent): string {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Meta');
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      return parts.join('+');
    }

    function readValue(el: Element): string {
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        return el.value;
      }
      if (el instanceof HTMLElement && el.isContentEditable) {
        return el.textContent ?? '';
      }
      return '';
    }

    function inputTypeOf(el: Element): string | undefined {
      if (el instanceof HTMLInputElement) return el.type;
      if (el instanceof HTMLTextAreaElement) return 'textarea';
      if (el instanceof HTMLSelectElement) return 'select';
      return undefined;
    }

    function scrollInfoOf(target: EventTarget): { container: string; pos: Point } {
      if (
        target instanceof Element &&
        target !== document.documentElement &&
        target !== document.body
      ) {
        return {
          container: bestSelector(target),
          pos: { x: target.scrollLeft, y: target.scrollTop },
        };
      }
      return { container: 'window', pos: { x: window.scrollX, y: window.scrollY } };
    }

    // -- capture handlers ----------------------------------------------------

    const onClick = (e: MouseEvent): void => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      // Clicks land on the annotation overlay (retargeted to its host) while the
      // user is drawing — those are recorder chrome, not page interactions.
      if (isAnnotationOverlay(target)) return;
      post('click', {
        descriptor: buildDescriptor(target),
        modifiers: modifiersOf(e),
        button: e.button,
      });
    };

    const onInput = (e: Event): void => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (isAnnotationOverlay(target)) return;
      const el = target;
      const existing = inputTimers.get(el);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        inputTimers.delete(el);
        const sensitive = isSensitiveInput(el);
        post('input', {
          descriptor: buildDescriptor(el),
          value: sensitive ? REDACTED : readValue(el),
          redacted: sensitive,
          inputType: inputTypeOf(el),
        });
      }, INPUT_DEBOUNCE_MS);
      inputTimers.set(el, timer);
    };

    const onScroll = (e: Event): void => {
      const target: EventTarget = e.target ?? document;
      const { container, pos } = scrollInfoOf(target);
      let run = scrollRuns.get(target);
      if (!run) {
        run = { from: pos, to: pos, container, timer: undefined };
        scrollRuns.set(target, run);
      } else {
        run.to = pos;
      }
      if (run.timer) clearTimeout(run.timer);
      const captured = run;
      run.timer = setTimeout(() => {
        scrollRuns.delete(target);
        post('scroll', {
          from: captured.from,
          to: captured.to,
          container: captured.container,
        });
      }, SCROLL_IDLE_MS);
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (MODIFIER_KEYS.has(e.key)) return;
      if (isAnnotationOverlay(e.target)) return; // typing an annotation label
      const chord = e.ctrlKey || e.metaKey || e.altKey;
      if (!chord && !NAMED_KEYS.has(e.key)) return;
      const focused = document.activeElement;
      post('key', {
        key: keyString(e),
        modifiers: modifiersOf(e),
        descriptor:
          focused instanceof Element ? buildDescriptor(focused) : undefined,
      });
    };

    // -- hover (dwell over a meaningful element) -----------------------------

    // 0 disables hover capture; set from the activation message.
    let hoverDwellMs = 0;
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    let lastHoverEl: Element | null = null;

    const INTERACTIVE =
      'a, button, input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"], [tabindex], [contenteditable]';

    /** The closest interactive element under the pointer, or null (skip). */
    function meaningfulTarget(t: EventTarget | null): Element | null {
      if (!(t instanceof Element) || isAnnotationOverlay(t)) return null;
      return t.closest(INTERACTIVE);
    }

    const onMouseMove = (e: MouseEvent): void => {
      if (hoverDwellMs <= 0) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      const target = e.target;
      hoverTimer = setTimeout(() => {
        hoverTimer = null;
        const el = meaningfulTarget(target);
        // Only emit for a NEW interactive element the pointer rested on.
        if (!el || el === lastHoverEl) return;
        lastHoverEl = el;
        post('hover', {
          descriptor: buildDescriptor(el),
          dwellMs: hoverDwellMs,
        });
      }, hoverDwellMs);
    };

    // -- attach / detach -----------------------------------------------------

    function attach(): void {
      document.addEventListener('click', onClick, true);
      document.addEventListener('input', onInput, true);
      document.addEventListener('change', onInput, true);
      document.addEventListener('scroll', onScroll, true);
      document.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('mousemove', onMouseMove, true);
    }

    function detach(): void {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onInput, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousemove', onMouseMove, true);
      for (const t of inputTimers.values()) clearTimeout(t);
      inputTimers.clear();
      for (const run of scrollRuns.values()) {
        if (run.timer) clearTimeout(run.timer);
      }
      scrollRuns.clear();
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = null;
      lastHoverEl = null;
    }

    function setActive(next: boolean, dwell?: number): void {
      if (typeof dwell === 'number') hoverDwellMs = dwell;
      if (next === active) return;
      active = next;
      if (active) attach();
      else detach();
    }

    // -- lifecycle -----------------------------------------------------------

    onContentMessage((msg) => {
      if (msg.kind === 'content/setActive') {
        setActive(msg.active, msg.hoverDwellMs);
      } else if (msg.kind === 'content/annotate') {
        // Pause capture while the annotation editor is open.
        annotating = msg.on;
        if (annotating && hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
      }
    });

    void (async () => {
      try {
        const reply = await sendMessage({ kind: 'content/hello' });
        setActive(reply.active);
      } catch {
        /* background not ready — stays dormant until a setActive arrives */
      }
    })();
  },
});
