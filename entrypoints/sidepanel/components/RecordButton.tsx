/**
 * The big idle-state Record button. Resolves the active tab in the current
 * window and asks the background to start a session, seeding it with the
 * user's persisted screenshot-policy default so the quick selector takes effect.
 */

import React, { useState } from 'react';
import { loadDefaultSettings, useSidepanel } from '../store';

export function RecordButton(): React.JSX.Element {
  const startRecording = useSidepanel((s) => s.startRecording);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setLocalError(undefined);
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tabId = tabs[0]?.id;
      if (typeof tabId !== 'number') {
        setLocalError('No active tab to record.');
        return;
      }
      const defaults = await loadDefaultSettings();
      const res = await startRecording(tabId, {
        screenshotPolicy: defaults.screenshotPolicy,
      });
      if (!res.ok) setLocalError(res.error ?? 'Could not start recording.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="record-hero">
      <button
        type="button"
        className="record-btn"
        onClick={onClick}
        disabled={busy}
        aria-label="Start recording"
      >
        <span className="record-btn__dot" />
        <span className="record-btn__label">
          {busy ? 'Starting…' : 'Record'}
        </span>
      </button>
      <p className="record-hero__hint">Records the active tab</p>
      {localError && <p className="record-hero__error">{localError}</p>}
    </div>
  );
}
