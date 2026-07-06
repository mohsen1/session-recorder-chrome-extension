/**
 * Side-panel root. Bootstraps the store on mount and switches between the three
 * views driven by the background's session state:
 *   IDLE       -> Record button, screenshot-policy quick setting, past sessions
 *   RECORDING  -> controls, capture bar, per-tab chips, live ticker
 *   STOPPED    -> post-stop review (summary + transcription + export)
 * A past session opened from the list reuses the same review surface.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Database, Layers, Settings, X } from 'lucide-react';
import { getEvents, getSession } from '@/lib/storage';
import { formatClock } from '@/lib/export/markdown';
import type {
  EventType,
  ScreenshotPolicy,
  Session,
  SessionEvent,
} from '@/lib/session/types';
import {
  formatBytes,
  loadDefaultSettings,
  saveScreenshotPolicy,
  useSidepanel,
} from './store';
import { RecordButton } from './components/RecordButton';
import { RecordingControls } from './components/RecordingControls';
import { CaptureBar } from './components/CaptureBar';
import { Timeline } from './components/Timeline';
import { SessionList } from './components/SessionList';
import { ExportPanel } from './components/ExportPanel';
import { SettingsForm } from './components/SettingsForm';

export function App(): React.JSX.Element {
  const init = useSidepanel((s) => s.init);
  const ready = useSidepanel((s) => s.ready);
  const session = useSidepanel((s) => s.session);
  const error = useSidepanel((s) => s.error);
  const dismissError = useSidepanel((s) => s.dismissError);

  // A past session opened from the list, and a dismissed just-stopped session.
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [dismissedStoppedId, setDismissedStoppedId] = useState<string | null>(
    null,
  );
  // Settings view overlay, reachable from the header gear in every state.
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  const status = session?.status ?? 'idle';
  const isLive =
    status === 'recording' || status === 'paused' || status === 'stopping';
  const isStopped =
    !!session &&
    status === 'stopped' &&
    session.id !== dismissedStoppedId;

  let body: React.JSX.Element;
  if (settingsOpen) {
    body = <SettingsView onClose={() => setSettingsOpen(false)} />;
  } else if (reviewId) {
    body = (
      <SessionReview sessionId={reviewId} onClose={() => setReviewId(null)} closeLabel="← Back" />
    );
  } else if (isLive && session) {
    body = <RecordingView />;
  } else if (isStopped && session) {
    body = (
      <SessionReview
        sessionId={session.id}
        onClose={() => setDismissedStoppedId(session.id)}
        closeLabel="Done"
      />
    );
  } else {
    body = <IdleView onOpenSession={setReviewId} />;
  }

  return (
    <div className="app">
      <header className="app__bar">
        <div className="app__brand">
          <img
            className="app__logo"
            src="/icon/128.png"
            alt=""
            aria-hidden="true"
            width={20}
            height={20}
          />
          <span className="app__title">Session Recorder</span>
        </div>
        <div className="app__actions">
          {isLive && <span className="app__live-dot" aria-hidden="true" />}
          <button
            type="button"
            className="icon-btn"
            aria-label="Settings"
            aria-pressed={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Settings size={17} strokeWidth={1.75} />
          </button>
        </div>
      </header>
      {error && (
        <div className="app__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={dismissError} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      <main className="app__body">{ready ? body : <p className="app__loading">Loading…</p>}</main>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

function SettingsView({
  onClose,
}: {
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="view view--settings">
      <div className="review__topbar">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onClose}
        >
          ← Back
        </button>
        <span className="review__name">Settings</span>
        <button
          type="button"
          className="icon-btn settings__close"
          aria-label="Close settings"
          onClick={onClose}
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
      <SettingsForm />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Idle
// ----------------------------------------------------------------------------

function IdleView({
  onOpenSession,
}: {
  onOpenSession: (id: string) => void;
}): React.JSX.Element {
  return (
    <div className="view view--idle">
      <RecordButton />
      <PolicyQuickSelect />
      <SessionList onOpen={onOpenSession} />
    </div>
  );
}

const POLICY_OPTIONS: { value: ScreenshotPolicy; label: string }[] = [
  { value: 'every-interaction', label: 'Every interaction' },
  { value: 'key-moments', label: 'Key moments' },
  { value: 'on-demand', label: 'On demand only' },
];

function PolicyQuickSelect(): React.JSX.Element {
  const [policy, setPolicy] = useState<ScreenshotPolicy>('every-interaction');

  useEffect(() => {
    let cancelled = false;
    void loadDefaultSettings().then((s) => {
      if (!cancelled) setPolicy(s.screenshotPolicy);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onChange = async (value: ScreenshotPolicy) => {
    setPolicy(value);
    await saveScreenshotPolicy(value);
  };

  return (
    <label className="policy">
      <span className="policy__label">Screenshots</span>
      <select
        className="policy__select"
        value={policy}
        onChange={(e) => void onChange(e.target.value as ScreenshotPolicy)}
      >
        {POLICY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ----------------------------------------------------------------------------
// Recording
// ----------------------------------------------------------------------------

function RecordingView(): React.JSX.Element {
  return (
    <div className="view view--recording">
      <RecordingControls />
      <TabChips />
      <Timeline />
      <CaptureBar />
    </div>
  );
}

function TabChips(): React.JSX.Element | null {
  const attachedTabIds = useSidepanel((s) => s.attachedTabIds);
  const session = useSidepanel((s) => s.session);
  if (attachedTabIds.length === 0) return null;

  const titleFor = (tabId: number): string => {
    const info = session?.tabs.find((t) => t.tabId === tabId);
    if (!info) return `Tab ${tabId}`;
    if (info.title) return info.title;
    try {
      return new URL(info.url).host || `Tab ${tabId}`;
    } catch {
      return `Tab ${tabId}`;
    }
  };

  return (
    <div className="tab-chips">
      {attachedTabIds.map((id) => (
        <span key={id} className="tab-chip" title={titleFor(id)}>
          <span className="tab-chip__dot" />
          {truncateLabel(titleFor(id))}
        </span>
      ))}
    </div>
  );
}

function truncateLabel(s: string): string {
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
}

// ----------------------------------------------------------------------------
// Stopped / review
// ----------------------------------------------------------------------------

function SessionReview({
  sessionId,
  onClose,
  closeLabel,
}: {
  sessionId: string;
  onClose: () => void;
  closeLabel: string;
}): React.JSX.Element {
  const liveTranscription = useSidepanel((s) => s.transcription);
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setSession(null);
    setLoadError(undefined);
    (async () => {
      try {
        const [s, ev] = await Promise.all([
          getSession(sessionId),
          getEvents(sessionId),
        ]);
        if (cancelled) return;
        if (!s) throw new Error('Session not found.');
        setSession(s);
        setEvents(ev);
      } catch (err) {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const transcription = useMemo(() => {
    const voice = events.filter((e) => e.type === 'voice-segment');
    if (voice.length === 0) return null;
    const done = voice.filter(
      (e) =>
        e.type === 'voice-segment' &&
        (e.payload.transcript !== null ||
          e.payload.transcriptionError !== undefined),
    ).length;
    return { done, total: voice.length };
  }, [events]);

  // Prefer the live progress broadcast when it targets this session.
  const progress =
    liveTranscription && liveTranscription.sessionId === sessionId
      ? { done: liveTranscription.done, total: liveTranscription.total }
      : transcription;

  return (
    <div className="view view--review">
      <div className="review__topbar">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
          {closeLabel}
        </button>
        <span className="review__name">{session?.name ?? '…'}</span>
        {closeLabel === 'Done' && (
          <span className="review__saved">
            <Check size={13} strokeWidth={2.5} />
            Saved
          </span>
        )}
      </div>

      {loadError && <p className="export__error">{loadError}</p>}

      {session && <Summary session={session} />}

      {progress && progress.total > 0 && progress.done >= progress.total && (
        <div className="transcribe transcribe--done">
          <Check size={14} strokeWidth={2.5} />
          <span className="transcribe__label">Transcription complete</span>
        </div>
      )}

      {progress && progress.total > 0 && progress.done < progress.total && (
        <div className="transcribe">
          <span className="transcribe__label">Transcribing…</span>
          <div className="transcribe__bar">
            <div
              className="transcribe__fill"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="transcribe__count">
            {progress.done}/{progress.total}
          </span>
        </div>
      )}

      <ExportPanel sessionId={sessionId} />
    </div>
  );
}

function Summary({ session }: { session: Session }): React.JSX.Element {
  const duration = Math.max(
    0,
    (session.endedAt ?? Date.now()) - session.startedAt,
  );
  const counts = Object.entries(session.counts).filter(
    ([, n]) => typeof n === 'number' && n > 0,
  ) as [EventType, number][];

  const totalEvents = counts.reduce((a, [, n]) => a + n, 0);

  return (
    <div className="summary">
      <span className="summary__stat">
        <Clock size={15} strokeWidth={1.75} />
        {formatClock(duration)}
      </span>
      <span className="summary__stat">
        <Database size={15} strokeWidth={1.75} />
        {formatBytes(session.assetBytes)}
      </span>
      <span className="summary__stat">
        <Layers size={15} strokeWidth={1.75} />
        {totalEvents}
      </span>
    </div>
  );
}
