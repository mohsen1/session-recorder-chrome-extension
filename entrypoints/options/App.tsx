/**
 * Options page UI.
 *
 * Four self-contained sections — Transcription, Redaction, Capture knobs, and
 * Storage — that read their current values from `chrome.storage.local` on mount
 * and persist under `STORAGE_KEYS`. Transcription settings live under
 * `STORAGE_KEYS.transcription`; the redaction master switch, custom redaction
 * rules, and every capture knob are all folded into a single `CaptureSettings`
 * snapshot stored under `STORAGE_KEYS.defaultSettings` (merged with
 * `makeDefaultSettings()` so new fields always have a value).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CaptureSettings,
  RedactionRules,
  ScreenshotPolicy,
  Session,
} from '@/lib/session/types';
import { STORAGE_KEYS, makeDefaultSettings } from '@/lib/session/settings';
import {
  PROVIDERS,
  transcribe,
  type TranscriptionConfig,
} from '@/lib/transcription';
import {
  DEFAULT_HEADER_BLOCKLIST,
  DEFAULT_KEY_PATTERN,
} from '@/lib/capture/redaction';
import {
  deleteSession,
  listSessions,
  storageEstimate,
} from '@/lib/storage';

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------

/** Split newline-separated textarea text into trimmed, non-empty lines. */
function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Human-readable byte size. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** exp;
  const unit = units[exp] ?? 'B';
  return `${value.toFixed(value >= 10 || exp === 0 ? 0 : 1)} ${unit}`;
}

/** Build a tiny 1-second silent mono 16-bit PCM WAV blob for the Test button. */
function silentWavBlob(seconds = 1, sampleRate = 16000): Blob {
  const numSamples = Math.floor(seconds * sampleRate);
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  // samples remain zero -> silence
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Sum every per-type count on a session. */
function totalEvents(session: Session): number {
  return Object.values(session.counts).reduce<number>(
    (acc, n) => acc + (n ?? 0),
    0,
  );
}

// ----------------------------------------------------------------------------
// Saved-confirmation hook
// ----------------------------------------------------------------------------

function useSavedFlash(): [Record<string, boolean>, (key: string) => void] {
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const flash = useCallback((key: string) => {
    setSaved((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSaved((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  }, []);
  return [saved, flash];
}

function SavedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="saved-badge">Saved ✓</span>;
}

// ----------------------------------------------------------------------------
// App
// ----------------------------------------------------------------------------

const EMPTY_TX: TranscriptionConfig = { provider: 'openai', apiKey: '' };

export function App() {
  const [saved, flashSaved] = useSavedFlash();

  // --- transcription state ---
  const [tx, setTx] = useState<TranscriptionConfig>(EMPTY_TX);
  const [testState, setTestState] = useState<{
    status: 'idle' | 'testing' | 'ok' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  // --- capture settings (redaction + knobs) ---
  const [settings, setSettings] = useState<CaptureSettings>(
    makeDefaultSettings,
  );
  const [redaction, setRedaction] = useState({
    headers: '',
    bodyKeys: '',
    urlParams: '',
  });

  // --- storage state ---
  const [storage, setStorage] = useState<{ usage: number; quota: number }>({
    usage: 0,
    quota: 0,
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);

  const providerMeta = useMemo(
    () => PROVIDERS.find((p) => p.id === tx.provider),
    [tx.provider],
  );

  const refreshStorage = useCallback(async () => {
    const [est, list] = await Promise.all([storageEstimate(), listSessions()]);
    setStorage(est);
    setSessions(list);
  }, []);

  // Load everything on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await chrome.storage.local.get([
        STORAGE_KEYS.transcription,
        STORAGE_KEYS.defaultSettings,
      ]);
      if (cancelled) return;

      const storedTx = stored[STORAGE_KEYS.transcription] as
        | TranscriptionConfig
        | undefined;
      if (storedTx) setTx({ ...EMPTY_TX, ...storedTx });

      const merged: CaptureSettings = {
        ...makeDefaultSettings(),
        ...(stored[STORAGE_KEYS.defaultSettings] as
          | Partial<CaptureSettings>
          | undefined),
      };
      setSettings(merged);
      const rules = merged.customRedaction ?? makeDefaultSettings().customRedaction;
      setRedaction({
        headers: rules.headerNames.join('\n'),
        bodyKeys: rules.bodyKeyPatterns.join('\n'),
        urlParams: rules.urlParamPatterns.join('\n'),
      });

      await refreshStorage();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshStorage]);

  // --- transcription actions ---

  function patchTx(patch: Partial<TranscriptionConfig>): void {
    setTx((prev) => ({ ...prev, ...patch }));
  }

  function effectiveTx(): TranscriptionConfig {
    return {
      provider: tx.provider,
      apiKey: tx.apiKey,
      baseUrl: tx.baseUrl?.trim() || providerMeta?.defaultBaseUrl,
      model: tx.model?.trim() || providerMeta?.defaultModel,
      language: tx.language?.trim() || undefined,
    };
  }

  async function saveTranscription(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.transcription]: tx });
    flashSaved('transcription');
  }

  async function runTest(): Promise<void> {
    setTestState({ status: 'testing', message: '' });
    try {
      const result = await transcribe(silentWavBlob(), effectiveTx());
      const text = result.text?.trim();
      setTestState({
        status: 'ok',
        message: text
          ? `Success — transcript: "${text}"`
          : 'Success — provider reachable (empty transcript for silence).',
      });
    } catch (err) {
      setTestState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // --- capture settings actions (shared by redaction + knobs) ---

  function patchSettings(patch: Partial<CaptureSettings>): void {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  /** Compose the full settings snapshot from state, folding in the textareas. */
  function composeSettings(): CaptureSettings {
    const customRedaction: RedactionRules = {
      headerNames: parseLines(redaction.headers).map((h) => h.toLowerCase()),
      bodyKeyPatterns: parseLines(redaction.bodyKeys),
      urlParamPatterns: parseLines(redaction.urlParams),
    };
    return {
      ...makeDefaultSettings(),
      ...settings,
      customRedaction,
    };
  }

  async function persistSettings(key: string): Promise<void> {
    const next = composeSettings();
    setSettings(next);
    await chrome.storage.local.set({ [STORAGE_KEYS.defaultSettings]: next });
    flashSaved(key);
  }

  // --- storage actions ---

  async function deleteAllSessions(): Promise<void> {
    if (sessions.length === 0) return;
    const ok = window.confirm(
      `Delete all ${sessions.length} recorded session(s)? This cannot be undone.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      for (const session of sessions) {
        await deleteSession(session.id);
      }
      await refreshStorage();
    } finally {
      setBusy(false);
    }
  }

  const usagePct =
    storage.quota > 0
      ? Math.min(100, (storage.usage / storage.quota) * 100)
      : 0;

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------

  return (
    <div className="page">
      <header className="page-header">
        <img
          className="page-logo"
          src="/icon/128.png"
          alt=""
          aria-hidden="true"
          width={34}
          height={34}
        />
        <div>
          <h1>Session Recorder — Settings</h1>
          <p className="subtitle">
            Configure transcription, redaction, capture, and manage stored data.
          </p>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* 1) Transcription                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="card">
        <div className="card-head">
          <h2>Transcription</h2>
          <SavedBadge show={!!saved.transcription} />
        </div>

        <div className="grid">
          <label className="field">
            <span className="field-label">Provider</span>
            <select
              value={tx.provider}
              onChange={(e) =>
                patchTx({
                  provider: e.target
                    .value as TranscriptionConfig['provider'],
                })
              }
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Language</span>
            <input
              type="text"
              value={tx.language ?? ''}
              placeholder="auto (e.g. en, es, fr)"
              onChange={(e) => patchTx({ language: e.target.value })}
            />
          </label>

          <label className="field">
            <span className="field-label">Base URL</span>
            <input
              type="text"
              value={tx.baseUrl ?? ''}
              placeholder={providerMeta?.defaultBaseUrl ?? ''}
              onChange={(e) => patchTx({ baseUrl: e.target.value })}
            />
          </label>

          <label className="field">
            <span className="field-label">Model</span>
            <input
              type="text"
              value={tx.model ?? ''}
              placeholder={providerMeta?.defaultModel ?? ''}
              onChange={(e) => patchTx({ model: e.target.value })}
            />
          </label>

          <label className="field field-wide">
            <span className="field-label">API key</span>
            <input
              type="password"
              value={tx.apiKey}
              placeholder="sk-…"
              autoComplete="off"
              onChange={(e) => patchTx({ apiKey: e.target.value })}
            />
          </label>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => void saveTranscription()}
          >
            Save
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={testState.status === 'testing'}
            onClick={() => void runTest()}
          >
            {testState.status === 'testing' ? 'Testing…' : 'Test'}
          </button>
          {testState.status === 'ok' && (
            <span className="result result-ok">{testState.message}</span>
          )}
          {testState.status === 'error' && (
            <span className="result result-error">{testState.message}</span>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 2) Redaction                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="card">
        <div className="card-head">
          <h2>Redaction</h2>
          <SavedBadge show={!!saved.redaction} />
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.redactionEnabled}
            onChange={(e) =>
              patchSettings({ redactionEnabled: e.target.checked })
            }
          />
          <span>
            Enable redaction (strip secrets from headers, bodies, and URLs)
          </span>
        </label>

        <p className="hint">
          Your entries below are merged with the built-in defaults. Defaults
          always apply while redaction is enabled.
        </p>

        <div className="grid grid-3">
          <div className="field">
            <span className="field-label">Extra header names</span>
            <textarea
              rows={5}
              spellCheck={false}
              value={redaction.headers}
              placeholder="one header name per line"
              onChange={(e) =>
                setRedaction((r) => ({ ...r, headers: e.target.value }))
              }
            />
            <span className="ref-label">Built-in:</span>
            <code className="ref-block">
              {DEFAULT_HEADER_BLOCKLIST.join(', ')}
            </code>
          </div>

          <div className="field">
            <span className="field-label">Body key regex patterns</span>
            <textarea
              rows={5}
              spellCheck={false}
              value={redaction.bodyKeys}
              placeholder="one regex per line, e.g. account.?number"
              onChange={(e) =>
                setRedaction((r) => ({ ...r, bodyKeys: e.target.value }))
              }
            />
            <span className="ref-label">Built-in:</span>
            <code className="ref-block">/{DEFAULT_KEY_PATTERN.source}/i</code>
          </div>

          <div className="field">
            <span className="field-label">URL param patterns</span>
            <textarea
              rows={5}
              spellCheck={false}
              value={redaction.urlParams}
              placeholder="one regex per line, e.g. access_token"
              onChange={(e) =>
                setRedaction((r) => ({ ...r, urlParams: e.target.value }))
              }
            />
            <span className="ref-label">Built-in:</span>
            <code className="ref-block">/{DEFAULT_KEY_PATTERN.source}/i</code>
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => void persistSettings('redaction')}
          >
            Save
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 3) Capture knobs                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="card">
        <div className="card-head">
          <h2>Capture</h2>
          <SavedBadge show={!!saved.capture} />
        </div>

        <div className="grid">
          <label className="field">
            <span className="field-label">Screenshot policy</span>
            <select
              value={settings.screenshotPolicy}
              onChange={(e) =>
                patchSettings({
                  screenshotPolicy: e.target.value as ScreenshotPolicy,
                })
              }
            >
              <option value="every-interaction">Every interaction</option>
              <option value="key-moments">Key moments</option>
              <option value="on-demand">On demand only</option>
            </select>
          </label>

          <ByteInput
            label="Inline body cap"
            unit="KB"
            bytes={settings.inlineBodyCapBytes}
            onChange={(b) => patchSettings({ inlineBodyCapBytes: b })}
          />
          <ByteInput
            label="Asset body cap"
            unit="KB"
            bytes={settings.assetBodyCapBytes}
            onChange={(b) => patchSettings({ assetBodyCapBytes: b })}
          />
          <ByteInput
            label="File cap"
            unit="MB"
            bytes={settings.fileCapBytes}
            onChange={(b) => patchSettings({ fileCapBytes: b })}
          />

          <label className="field">
            <span className="field-label">Screenshot quality (0–100)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.screenshotQuality}
              onChange={(e) =>
                patchSettings({
                  screenshotQuality: clampInt(e.target.value, 0, 100),
                })
              }
            />
          </label>

          <label className="field">
            <span className="field-label">Dedup threshold (0–64)</span>
            <input
              type="number"
              min={0}
              max={64}
              value={settings.screenshotDedupThreshold}
              onChange={(e) =>
                patchSettings({
                  screenshotDedupThreshold: clampInt(e.target.value, 0, 64),
                })
              }
            />
          </label>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => void persistSettings('capture')}
          >
            Save
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* 4) Storage                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="card">
        <div className="card-head">
          <h2>Storage</h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void refreshStorage()}
          >
            Refresh
          </button>
        </div>

        <div className="storage-summary">
          <div className="storage-numbers">
            <strong>{formatBytes(storage.usage)}</strong>
            <span>
              {' '}
              used of {formatBytes(storage.quota)} (
              {usagePct.toFixed(usagePct >= 10 ? 0 : 1)}%)
            </span>
          </div>
          <div
            className="storage-bar"
            role="progressbar"
            aria-valuenow={Math.round(usagePct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="storage-bar-fill"
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        {sessions.length === 0 ? (
          <p className="hint">No recorded sessions.</p>
        ) : (
          <div className="table-wrap">
            <table className="sessions">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Started</th>
                  <th className="num">Events</th>
                  <th className="num">Assets</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name || s.id}</td>
                    <td>{new Date(s.startedAt).toLocaleString()}</td>
                    <td className="num">{totalEvents(s)}</td>
                    <td className="num">{formatBytes(s.assetBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy || sessions.length === 0}
            onClick={() => void deleteAllSessions()}
          >
            {busy ? 'Deleting…' : 'Delete all sessions'}
          </button>
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

/** Parse a numeric input string and clamp it to an integer range. */
function clampInt(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** A byte-valued field edited in KB or MB, stored canonically in bytes. */
function ByteInput({
  label,
  unit,
  bytes,
  onChange,
}: {
  label: string;
  unit: 'KB' | 'MB';
  bytes: number;
  onChange: (bytes: number) => void;
}) {
  const factor = unit === 'MB' ? 1024 * 1024 : 1024;
  const display = bytes / factor;
  return (
    <label className="field">
      <span className="field-label">
        {label} ({unit})
      </span>
      <input
        type="number"
        min={0}
        step={unit === 'MB' ? 1 : 16}
        value={Number.isFinite(display) ? display : 0}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(Number.isFinite(v) ? Math.max(0, Math.round(v * factor)) : 0);
        }}
      />
      <span className="ref-label">{formatBytes(bytes)}</span>
    </label>
  );
}
