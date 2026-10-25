import type { Session } from '@/lib/session/types';
/** Split newline-separated textarea text into trimmed, non-empty lines. */
export function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
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
export function silentWavBlob(seconds = 1, sampleRate = 16000): Blob {
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
export function totalEvents(session: Session): number {
  return Object.values(session.counts).reduce<number>(
    (acc, n) => acc + (n ?? 0),
    0,
  );
}

/** Parse a numeric input string and clamp it to an integer range. */
export function clampInt(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
