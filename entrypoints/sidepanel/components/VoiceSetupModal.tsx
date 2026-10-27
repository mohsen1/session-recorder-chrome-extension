import {
  loadProoflineSettings,
  saveProoflineSettings,
} from '@/lib/proofline/settings';
import { useProoflineSettings } from './useProoflineSettings';
/**
 * First-run voice setup. Shown when the mic is about to turn on (capture-bar
 * toggle or record-with-mic-from-start) and no transcription provider is
 * configured yet. Lets the user pick a provider + key on the spot, or proceed
 * with raw audio only (recording works fine without transcription; the export
 * keeps the audio files). Closing cancels the mic action.
 */

import React, { useEffect, useState } from 'react';
import { AudioLines, X } from 'lucide-react';
import {
  PROVIDERS,
  providerMeta,
  type TranscriptionConfig,
} from '@/lib/transcription';
import { STORAGE_KEYS } from '@/lib/session/settings';

/** True when a usable transcription config is saved. */
export async function isTranscriptionConfigured(): Promise<boolean> {
  try {
    if ((await loadProoflineSettings()).aiMode === 'proofline') return true;
    const stored = await chrome.storage.local.get(STORAGE_KEYS.transcription);
    const cfg = stored[STORAGE_KEYS.transcription] as
      | TranscriptionConfig
      | undefined;
    return (
      !!cfg && typeof cfg.apiKey === 'string' && cfg.apiKey.trim().length > 0
    );
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
  const { state: proofline } = useProoflineSettings();
  const account = proofline.settings.connection?.account;
  const [personal, setPersonal] = useState(false);
  const [error, setError] = useState('');

  const useProofline = async () => {
    setSaving(true);
    setError('');
    try {
      const current = await loadProoflineSettings();
      if (
        !current.connection ||
        current.connection.organizationId !==
          proofline.settings.connection?.organizationId
      )
        throw new Error(
          'Your Proofline workspace changed. Close this dialog and try again.',
        );
      if (current.connection.expiresAt <= Date.now())
        throw new Error(
          'Reconnect to Proofline in Settings → Proofline, then try again.',
        );
      await saveProoflineSettings({ ...current, aiMode: 'proofline' });
      onDone();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Proofline voice setup could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

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
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Voice setup"
    >
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

        {proofline.status === 'loading' ? (
          <p role="status" className="modal__lede">
            Loading voice settings…
          </p>
        ) : account && !personal ? (
          <>
            <p className="modal__lede">
              Use {account.organization.name || account.organization.login}’s
              Proofline credits for transcription. No provider API key is
              needed.
            </p>
            <div className="settings__actions">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                autoFocus
                disabled={saving}
                onClick={() => void useProofline()}
              >
                {saving ? 'Saving…' : 'Use Proofline credits'}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={saving}
                onClick={() => setPersonal(true)}
              >
                Use a provider key
              </button>
            </div>
          </>
        ) : (
          <>
            {account && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setPersonal(false)}
              >
                Back to voice options
              </button>
            )}
            <p className="modal__lede">
              Your narration is transcribed in real time and placed on the
              timeline next to what you were doing. Add a provider key once; it
              stays on your machine.
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
          </>
        )}
        {error && (
          <p className="export__error" role="alert">
            {error}
          </p>
        )}
        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--sm"
            onClick={onDone}
            title="Record the mic without transcription; the export keeps the audio files"
          >
            Keep raw audio only
          </button>
          {proofline.status !== 'loading' && (!account || personal) && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={apiKey.trim().length === 0 || saving}
              onClick={() => void saveAndContinue()}
            >
              {saving ? 'Saving…' : 'Save and continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
