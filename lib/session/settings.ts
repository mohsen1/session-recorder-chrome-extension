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
  hoverDwellMs: 700,
};

/**
 * Capture-detail presets for the Record button's detail slider. Each maps the
 * one knob to a screenshot policy and pointer sensitivity (0 = no hover).
 */
export const CAPTURE_DETAIL_LEVELS: {
  label: string;
  hint: string;
  screenshotPolicy: CaptureSettings['screenshotPolicy'];
  hoverDwellMs: number;
}[] = [
  { label: 'Minimal', hint: 'Screenshots on demand, no pointer tracking', screenshotPolicy: 'on-demand', hoverDwellMs: 0 },
  { label: 'Standard', hint: 'Screenshots at key moments', screenshotPolicy: 'key-moments', hoverDwellMs: 0 },
  { label: 'Detailed', hint: 'Screenshot every interaction, track hovers', screenshotPolicy: 'every-interaction', hoverDwellMs: 700 },
  { label: 'Maximum', hint: 'Every interaction, sensitive pointer tracking', screenshotPolicy: 'every-interaction', hoverDwellMs: 350 },
];

/** Map current settings to the closest capture-detail slider index. */
export function detailIndexFromSettings(s: CaptureSettings): number {
  const match = CAPTURE_DETAIL_LEVELS.findIndex(
    (l) => l.screenshotPolicy === s.screenshotPolicy && l.hoverDwellMs === s.hoverDwellMs,
  );
  if (match >= 0) return match;
  // Fall back by screenshot policy.
  if (s.screenshotPolicy === 'on-demand') return 0;
  if (s.screenshotPolicy === 'key-moments') return 1;
  return 2;
}

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
