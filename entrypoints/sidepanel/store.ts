/**
 * Zustand store for the side panel.
 *
 * Mirrors the background's `AppState` (the single source of truth for session
 * lifecycle) and layers on UI-only signals the background streams separately:
 * the live mic level and transcription progress. All session mutations flow in
 * from `onBroadcast`; the exported actions only *send* requests — the resulting
 * broadcast is what updates the store, so the UI can never drift from the
 * background. `init()` wires the broadcast subscription exactly once and pulls
 * the initial state (the panel may be opened mid-session).
 */

import { create } from 'zustand';
import { onBroadcast, sendMessage, type AppState } from '@/lib/messaging';
import type {
  CaptureSettings,
  ScreenshotPolicy,
  Session,
  SessionEvent,
} from '@/lib/session/types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/lib/session/settings';

/** How many recent events the ticker keeps in memory. */
const MAX_TICKER = 30;

export interface TranscriptionProgress {
  sessionId: string;
  done: number;
  total: number;
}

export interface SidepanelStore {
  // --- mirror of AppState ---
  session: Session | null;
  recentEvents: SessionEvent[];
  recording: boolean;
  paused: boolean;
  micOn: boolean;
  annotating: boolean;
  attachedTabIds: number[];
  error?: string;

  // --- UI-only live signals ---
  micLevel: number;
  transcription: TranscriptionProgress | null;
  ready: boolean;

  // --- lifecycle ---
  init: () => Promise<void>;
  refresh: () => Promise<void>;

  // --- actions (fire a request; the broadcast reconciles state) ---
  startRecording: (
    tabId: number,
    settings?: Partial<CaptureSettings>,
  ) => Promise<{ ok: boolean; error?: string }>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleAnnotate: () => Promise<void>;
  addMarker: () => Promise<void>;
  addNote: (text: string) => Promise<void>;
  captureScreenshot: () => Promise<void>;
  attachFile: (file: File, note?: string) => Promise<void>;
  dismissError: () => void;
}

/** Module-level guards so StrictMode / HMR can't double-subscribe. */
let initStarted = false;
let subscribed = false;

/** Read an `AppState` broadcast/response into the flat store shape. */
function appStatePatch(state: AppState): Partial<SidepanelStore> {
  return {
    session: state.session,
    recentEvents: state.recentEvents ?? [],
    recording: state.recording,
    paused: state.paused,
    micOn: state.micOn,
    annotating: state.annotating,
    attachedTabIds: state.attachedTabIds ?? [],
    error: state.error,
  };
}

export const useSidepanel = create<SidepanelStore>((set, get) => ({
  session: null,
  recentEvents: [],
  recording: false,
  paused: false,
  micOn: false,
  annotating: false,
  attachedTabIds: [],
  error: undefined,
  micLevel: 0,
  transcription: null,
  ready: false,

  init: async () => {
    if (initStarted) return;
    initStarted = true;

    if (!subscribed) {
      subscribed = true;
      onBroadcast((evt) => {
        switch (evt.kind) {
          case 'state/update':
            set(appStatePatch(evt.state));
            break;
          case 'event/tick':
            set((s) => {
              const recentEvents = [...s.recentEvents, evt.event].slice(
                -MAX_TICKER,
              );
              const session = s.session
                ? { ...s.session, counts: evt.counts }
                : s.session;
              return { recentEvents, session };
            });
            break;
          case 'mic/level':
            set({ micLevel: evt.level });
            break;
          case 'transcription/progress':
            set({
              transcription: {
                sessionId: evt.sessionId,
                done: evt.done,
                total: evt.total,
              },
            });
            break;
          case 'annotation/state':
            set({ annotating: evt.annotating });
            break;
          case 'export/progress':
            // Export progress is surfaced locally by ExportPanel, ignore here.
            break;
          default:
            break;
        }
      });
    }

    await get().refresh();
    set({ ready: true });
  },

  refresh: async () => {
    try {
      const state = await sendMessage({ kind: 'session/getState' });
      set(appStatePatch(state));
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  startRecording: async (tabId, settings) => {
    try {
      const res = await sendMessage({ kind: 'session/start', tabId, settings });
      if (res.ok) {
        set({ error: undefined, ...(res.session ? { session: res.session } : {}) });
        await get().refresh();
      } else {
        set({ error: res.error ?? 'Failed to start recording.' });
      }
      return { ok: res.ok, error: res.error };
    } catch (err) {
      const error = describeError(err);
      set({ error });
      return { ok: false, error };
    }
  },

  stopRecording: async () => {
    try {
      await sendMessage({ kind: 'session/stop' });
    } finally {
      await get().refresh();
    }
  },

  pauseRecording: async () => {
    await sendMessage({ kind: 'session/pause' });
    await get().refresh();
  },

  resumeRecording: async () => {
    await sendMessage({ kind: 'session/resume' });
    await get().refresh();
  },

  toggleMic: async () => {
    const on = !get().micOn;
    try {
      const res = await sendMessage({ kind: 'mic/toggle', on });
      if (res.ok) set({ micOn: res.micOn, error: undefined });
      else set({ error: res.error ?? 'Microphone unavailable.' });
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  toggleAnnotate: async () => {
    try {
      const res = await sendMessage({ kind: 'annotation/toggle' });
      if (res.ok) set({ annotating: res.annotating });
    } catch (err) {
      set({ error: describeError(err) });
    }
  },

  addMarker: async () => {
    await sendMessage({ kind: 'marker/add' });
  },

  addNote: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await sendMessage({ kind: 'note/add', text: trimmed });
  },

  captureScreenshot: async () => {
    await sendMessage({ kind: 'screenshot/capture' });
  },

  attachFile: async (file, note) => {
    const dataUrl = await fileToDataUrl(file);
    await sendMessage({
      kind: 'file/attach',
      fileName: file.name,
      mime: file.type || 'application/octet-stream',
      dataUrl,
      note,
    });
  },

  dismissError: () => set({ error: undefined }),
}));

// ----------------------------------------------------------------------------
// Shared helpers (used across side-panel components)
// ----------------------------------------------------------------------------

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Read a File/Blob as a `data:` URL (the only safe cross-context transfer). */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

/** The persisted capture defaults, merged over the frozen baseline. */
export async function loadDefaultSettings(): Promise<CaptureSettings> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.defaultSettings);
    const raw = stored[STORAGE_KEYS.defaultSettings] as
      | Partial<CaptureSettings>
      | undefined;
    return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persist just the screenshot policy into the global capture defaults. */
export async function saveScreenshotPolicy(
  policy: ScreenshotPolicy,
): Promise<void> {
  const current = await loadDefaultSettings();
  const next: CaptureSettings = { ...current, screenshotPolicy: policy };
  await chrome.storage.local.set({ [STORAGE_KEYS.defaultSettings]: next });
}

/** Human-readable byte size (e.g. `1.4 MB`). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  const unit = units[i] ?? 'B';
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

/**
 * Zip / download folder name for a session, e.g. `session-2026-07-05-1432`.
 * Matches the layout described in PLAN.md §5 and used by the bundle builder.
 */
export function sessionFolderName(session: Session): string {
  const d = new Date(session.startedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `session-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}`
  );
}
