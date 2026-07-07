/**
 * First-run voice setup. Shown when the mic is about to turn on (capture-bar
 * toggle or record-with-mic-from-start) and no transcription provider is
 * configured yet. Lets the user pick a provider + key on the spot, or proceed
 * with raw audio only (recording works fine without transcription; the export
 * keeps the audio files). Closing cancels the mic action.
 */

import React, { useEffect, useState } from 'react';
import { AudioLines, X } from 'lucide-react';
import { PROVIDERS, providerMeta, type TranscriptionConfig } from '@/lib/transcription';
import { STORAGE_KEYS } from '@/lib/session/settings';

/** True when a usable transcription config is saved. */
export async function isTranscriptionConfigured(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.transcription);
    const cfg = stored[STORAGE_KEYS.transcription] as
      | TranscriptionConfig
      | undefined;
    return !!cfg && typeof cfg.apiKey === 'string' && cfg.apiKey.trim().length > 0;
  } catch {
    // If storage is unreadable, don't block the mic behind a modal loop.
    return true;
  }
}

interface VoiceSetupModalProps {
  /** Proceed with the mic action (after saving a config, or raw-audio-only). */
  onDone: () => void;
  /** Abandon the mic action. */
  onCancel: () => void;
}

export function VoiceSetupModal({
  onDone,
  onCancel,
}: VoiceSetupModalProps): React.JSX.Element {
  const [provider, setProvider] =
    useState<TranscriptionConfig['provider']>('deepgram');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  // Escape closes (= cancel the mic action).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const meta = providerMeta(provider);

  const saveAndContinue = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const cfg: TranscriptionConfig = {
        provider,
        apiKey: apiKey.trim(),
        model: meta?.defaultModel,
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.transcription]: cfg });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Voice setup">
      <div className="modal__scrim" onClick={onCancel} />
      <div className="modal__card">
        <div className="modal__head">
          <AudioLines size={16} strokeWidth={1.75} />
          <h3 className="modal__title">Set up voice transcription</h3>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close"
            onClick={onCancel}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <p className="modal__lede">
          Your narration is transcribed in real time and placed on the timeline
          next to what you were doing. Add a provider key once; it stays on your
          machine.
        </p>

        <label className="settings__field">
          <span className="settings__label">Provider</span>
          <select
            value={provider}
            onChange={(e) =>
              setProvider(e.target.value as TranscriptionConfig['provider'])
            }
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="settings__field">
          <span className="settings__label">API key</span>
          <input
            type="password"
            value={apiKey}
            placeholder="sk-…"
            autoComplete="off"
            autoFocus
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>

        <p className="modal__hint">
          Uses {meta?.defaultModel ?? 'the provider default'}. More options
          (model, language, base URL) are in Settings.
        </p>

        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--sm"
            onClick={onDone}
            title="Record the mic without transcription; the export keeps the audio files"
          >
            Keep raw audio only
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={apiKey.trim().length === 0 || saving}
            onClick={() => void saveAndContinue()}
          >
            {saving ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
