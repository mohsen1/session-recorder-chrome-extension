/**
 * The idle-state Record control: a split button. The main area starts a
 * recording of the active tab; the caret on its right opens a small slider that
 * sets how much detail to capture (screenshot frequency and pointer
 * sensitivity), persisted into the global capture defaults.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  CAPTURE_DETAIL_LEVELS,
  detailIndexFromSettings,
} from '@/lib/session/settings';
import {
  loadDefaultSettings,
  saveCaptureDetail,
  useSidepanel,
} from '../store';

export function RecordButton(): React.JSX.Element {
  const startRecording = useSidepanel((s) => s.startRecording);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();
  const [detail, setDetail] = useState(2);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDefaultSettings().then((s) => {
      if (!cancelled) setDetail(detailIndexFromSettings(s));
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
      const preset = CAPTURE_DETAIL_LEVELS[detail];
      const res = await startRecording(
        tabId,
        preset
          ? {
              screenshotPolicy: preset.screenshotPolicy,
              hoverDwellMs: preset.hoverDwellMs,
            }
          : {},
      );
      if (!res.ok) setLocalError(res.error ?? 'Could not start recording.');
    } finally {
      setBusy(false);
    }
  };

  const onDetail = (value: number) => {
    setDetail(value);
    void saveCaptureDetail(value);
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
          aria-label="Capture detail"
          aria-expanded={open}
        >
          <ChevronDown size={16} strokeWidth={2.5} />
        </button>

        {open && (
          <div className="detail-pop" role="dialog">
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
          </div>
        )}
      </div>
      <p className="record-hero__hint">Records the active tab</p>
      {localError && <p className="record-hero__error">{localError}</p>}
    </div>
  );
}
