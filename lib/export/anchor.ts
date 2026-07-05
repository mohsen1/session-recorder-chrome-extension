/**
 * Smart narration anchoring (pure).
 *
 * Voice narration is only useful if the reader knows WHAT the user was doing as
 * they spoke. Each voice-segment is stamped at the moment its first word was
 * said, so we can look at the events overlapping that window and describe the
 * most relevant one ("while clicking 'Checkout'", "while on /cart", "as a 500
 * error fired"). The renderer prepends this to the narration line.
 */
import type { NetRequestPayload, SessionEvent } from '@/lib/session/types';

/** A short human phrase for what an event represents, or undefined if dull. */
export function briefEventLabel(e: SessionEvent): string | undefined {
  switch (e.type) {
    case 'click': {
      const d = e.payload.descriptor;
      const label = d.text || d.ariaLabel || d.name || d.selector || d.tag;
      return label ? `clicking ${quote(label)}` : 'clicking';
    }
    case 'input': {
      const d = e.payload.descriptor;
      const name = d.ariaLabel || d.name || d.text || d.selector;
      return name ? `typing in ${quote(name)}` : 'typing';
    }
    case 'nav':
    case 'spa-route':
      return `on ${pathOf(e.payload.url)}`;
    case 'error':
      return `as an error fired (${clip(e.payload.message, 48)})`;
    case 'net-request': {
      const p = e.payload as NetRequestPayload;
      if (p.failed || (typeof p.status === 'number' && p.status >= 400)) {
        return `as ${p.status ?? 'a failed'} ${p.method} ${pathOf(p.url)} returned`;
      }
      return undefined;
    }
    case 'annotation':
      return 'while annotating';
    case 'file-captured':
    case 'file-attached':
      return `around the file ${quote(e.payload.fileName)}`;
    default:
      return undefined;
  }
}

// Priority when several events sit inside a segment's window (higher first).
const PRIORITY: Partial<Record<SessionEvent['type'], number>> = {
  error: 6,
  annotation: 5,
  click: 4,
  'net-request': 3,
  nav: 3,
  'spa-route': 3,
  'file-captured': 2,
  'file-attached': 2,
  input: 1,
};

const WINDOW_MS = 1500;

/**
 * For each voice-segment event id, the anchor phrase describing what the user
 * was doing while speaking it. Events within ±1.5s of the segment window are
 * considered; the highest-priority one wins.
 */
export function buildAnchorMap(events: SessionEvent[]): Map<string, string> {
  const out = new Map<string, string>();
  const voices = events.filter((e) => e.type === 'voice-segment');
  if (voices.length === 0) return out;

  for (const v of voices) {
    if (v.type !== 'voice-segment') continue;
    const from = v.payload.tStart - WINDOW_MS;
    const to = v.payload.tEnd + WINDOW_MS;
    let best: { pr: number; dist: number; label: string } | undefined;
    for (const e of events) {
      if (e.type === 'voice-segment') continue;
      if (e.t < from || e.t > to) continue;
      const pr = PRIORITY[e.type] ?? 0;
      if (pr === 0) continue;
      const label = briefEventLabel(e);
      if (!label) continue;
      const dist = Math.abs(e.t - v.payload.tStart);
      if (!best || pr > best.pr || (pr === best.pr && dist < best.dist)) {
        best = { pr, dist, label };
      }
    }
    if (best) out.set(v.id, best.label);
  }
  return out;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    const q = url.indexOf('?');
    return q >= 0 ? url.slice(0, q) : url;
  }
}

function quote(s: string): string {
  const t = clip(s, 40);
  return `"${t}"`;
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
