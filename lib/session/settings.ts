import type { CaptureSettings, RedactionRules } from './types';

export const DEFAULT_REDACTION_RULES: RedactionRules = {
  headerNames: [],
  bodyKeyPatterns: [],
  urlParamPatterns: [],
};

export const DEFAULT_SETTINGS: CaptureSettings = {
  screenshotPolicy: 'every-interaction',
  inlineBodyCapBytes: 256 * 1024,
  assetBodyCapBytes: 2 * 1024 * 1024,
  fileCapBytes: 25 * 1024 * 1024,
  redactionEnabled: true,
  customRedaction: DEFAULT_REDACTION_RULES,
  filterTelemetry: true,
  screenshotQuality: 80,
  screenshotDedupThreshold: 5,
};

/** Deep-clone the defaults so a session gets its own settings snapshot. */
export function makeDefaultSettings(): CaptureSettings {
  return structuredClone(DEFAULT_SETTINGS);
}

// chrome.storage.local keys
export const STORAGE_KEYS = {
  /** Persisted global capture defaults (options page). */
  defaultSettings: 'defaultSettings',
  /** Transcription provider config. */
  transcription: 'transcription',
  /** Persisted "mic permission granted" flag. */
  micGranted: 'micGranted',
} as const;
