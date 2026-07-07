/**
 * The idle-state Record control: a split button. The main area starts a
 * recording of the active tab; the caret on its right opens the capture-setup
 * popover: a detail slider (screenshot frequency, pointer sensitivity, network
 * body caps) plus extras — start tab video (which includes the tab's sound) and
 * mic narration with the session, and build an OpenAPI spec from captured
 * requests. All choices persist into the global capture defaults.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Video, Mic, FileJson2 } from 'lucide-react';
import {
  CAPTURE_DETAIL_LEVELS,
  detailIndexFromSettings,
  settingsForDetail,
} from '@/lib/session/settings';
import {
  loadDefaultSettings,
  loadMicFromStart,
  loadVideoFromStart,
  saveCaptureApiSpec,
  saveCaptureDetail,
  saveMicFromStart,
  saveVideoFromStart,
  useSidepanel,
} from '../store';

/** A compact switch row inside the popover: icon, label + hint, toggle. */
function OptionRow({
  icon,
  label,
  hint,
  on,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="detail-opt"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    >
      <span className={`detail-opt__icon${on ? ' detail-opt__icon--on' : ''}`}>
        {icon}
      </span>
      <span className="detail-opt__text">
        <span className="detail-opt__label">{label}</span>
        <span className="detail-opt__hint">{hint}</span>
      </span>
      <span className={`sw${on ? ' sw--on' : ''}`} aria-hidden="true">
        <span className="sw__knob" />
      </span>
    </button>
  );
}

export function RecordButton(): React.JSX.Element {
  const startRecording = useSidepanel((s) => s.startRecording);
  const toggleVideo = useSidepanel((s) => s.toggleVideo);
  const toggleMic = useSidepanel((s) => s.toggleMic);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();
  const [detail, setDetail] = useState(2);
  const [videoFromStart, setVideoFromStart] = useState(false);
  const [micFromStart, setMicFromStart] = useState(false);
  const [apiSpec, setApiSpec] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadDefaultSettings(),
      loadVideoFromStart(),
      loadMicFromStart(),
    ]).then(([s, video, mic]) => {
      if (cancelled) return;
      setDetail(detailIndexFromSettings(s));
      setApiSpec(s.captureApiSpec);
      setVideoFromStart(video);
      setMicFromStart(mic);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the popover on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const record = async () => {
    if (busy) return;
    setBusy(true);
    setLocalError(undefined);
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (typeof tabId !== 'number') {
        setLocalError('No active tab to record.');
        return;
      }
      // Pass the choices explicitly: the storage writes are async, so the
      // override is what makes a quick change-then-Record race-free.
      const res = await startRecording(tabId, {
        ...(settingsForDetail(detail) ?? {}),
        captureApiSpec: apiSpec,
      });
      if (!res.ok) {
        setLocalError(res.error ?? 'Could not start recording.');
        return;
      }
      // Kick off video / mic with the session. Failures surface through the
      // store's error channel without touching the running session.
      if (videoFromStart) void toggleVideo();
      if (micFromStart) void toggleMic();
    } finally {
      setBusy(false);
    }
  };

  const onDetail = (value: number) => {
    setDetail(value);
    void saveCaptureDetail(value);
  };

  const onVideo = (on: boolean) => {
    setVideoFromStart(on);
    void saveVideoFromStart(on);
  };

  const onMicFromStart = (on: boolean) => {
    setMicFromStart(on);
    void saveMicFromStart(on);
  };

  const onApiSpec = (on: boolean) => {
    setApiSpec(on);
    void saveCaptureApiSpec(on);
  };

  const preset = CAPTURE_DETAIL_LEVELS[detail];

  return (
    <div className="record-hero">
      <div className="record-split" ref={wrapRef}>
        <button
          type="button"
          className="record-split__main"
          onClick={() => void record()}
          disabled={busy}
          aria-label="Start recording"
        >
          <span className="record-btn__dot" />
          {busy ? 'Starting…' : 'Record'}
        </button>
        <button
          type="button"
          className="record-split__caret"
          onClick={() => setOpen((o) => !o)}
          aria-label="Capture options"
          aria-expanded={open}
        >
          <ChevronDown size={16} strokeWidth={2.5} />
        </button>

        {open && (
          <div className="detail-pop" role="dialog" aria-label="Capture options">
            <div className="detail-pop__head">
              <span>Capture detail</span>
              <span className="detail-pop__level">{preset?.label}</span>
            </div>
            <input
              type="range"
              className="detail-pop__range"
              min={0}
              max={CAPTURE_DETAIL_LEVELS.length - 1}
              step={1}
              value={detail}
              onChange={(e) => onDetail(Number(e.target.value))}
            />
            <div className="detail-pop__ticks">
              <span>Less</span>
              <span>More</span>
            </div>
            <p className="detail-pop__hint">{preset?.hint}</p>

            <div className="detail-pop__sep" role="separator" />
            <div className="detail-pop__head">
              <span>Also capture</span>
            </div>
            <OptionRow
              icon={<Video size={15} strokeWidth={1.9} />}
              label="Video"
              hint="Record the tab, with its sound, from the start"
              on={videoFromStart}
              onChange={onVideo}
            />
            <OptionRow
              icon={<Mic size={15} strokeWidth={1.9} />}
              label="Mic"
              hint="Narrate with your microphone from the start"
              on={micFromStart}
              onChange={onMicFromStart}
            />
            <OptionRow
              icon={<FileJson2 size={15} strokeWidth={1.9} />}
              label="API spec"
              hint="Full bodies → openapi.json in the export"
              on={apiSpec}
              onChange={onApiSpec}
            />
          </div>
        )}
      </div>
      <p className="record-hero__hint">Records the active tab</p>
      {localError && <p className="record-hero__error">{localError}</p>}
    </div>
  );
}
