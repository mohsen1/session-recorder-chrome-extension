import { describe, it, expect } from 'vitest';
import { buildAnchorMap, briefEventLabel } from './anchor';
import type { SessionEvent } from '@/lib/session/types';

function ev(partial: Partial<SessionEvent> & { type: SessionEvent['type']; t: number }): SessionEvent {
  return { id: `e${partial.t}`, sessionId: 's', importance: 0, ...partial } as SessionEvent;
}

describe('anchor', () => {
  it('anchors a voice segment to the click it overlaps', () => {
    const events: SessionEvent[] = [
      ev({ type: 'click', t: 5000, payload: { descriptor: { tag: 'button', text: 'Checkout' }, modifiers: [] } } as any),
      ev({ type: 'voice-segment', t: 5200, payload: { tStart: 5200, tEnd: 8000, transcript: 'this button is broken' } } as any),
    ];
    const map = buildAnchorMap(events);
    expect(map.get('e5200')).toBe('clicking "Checkout"');
  });

  it('prefers an error over a nearby click', () => {
    const events: SessionEvent[] = [
      ev({ type: 'click', t: 4000, payload: { descriptor: { tag: 'button', text: 'Save' }, modifiers: [] } } as any),
      ev({ type: 'error', t: 4300, payload: { origin: 'exception', message: 'TypeError: x is undefined' } } as any),
      ev({ type: 'voice-segment', t: 4100, payload: { tStart: 4100, tEnd: 6000, transcript: 'see the crash' } } as any),
    ];
    expect(buildAnchorMap(events).get('e4100')).toContain('error fired');
  });

  it('returns no anchor when nothing relevant is near', () => {
    const events: SessionEvent[] = [
      ev({ type: 'voice-segment', t: 1000, payload: { tStart: 1000, tEnd: 2000, transcript: 'hello' } } as any),
    ];
    expect(buildAnchorMap(events).size).toBe(0);
  });

  it('describes nav and mutating/failed requests', () => {
    expect(briefEventLabel(ev({ type: 'nav', t: 0, payload: { url: 'https://a.com/dashboard' } } as any))).toBe('on /dashboard');
    expect(briefEventLabel(ev({ type: 'net-request', t: 0, payload: { requestId: '1', method: 'POST', url: 'https://a.com/api/pay', status: 500, requestHeaders: [], responseHeaders: [] } } as any))).toContain('500 POST /api/pay');
  });
});
