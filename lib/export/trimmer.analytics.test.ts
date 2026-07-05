/**
 * Analytics/telemetry noise dropping. First-party ingest endpoints (e.g. an app
 * POSTing to `/ingest/i/v0/e`) live on the app's own host, so the host-based
 * matcher misses them — the path matcher in `dropStaticAssets` must catch them.
 * Errors (status>=400) and protected events always survive.
 */

import { describe, expect, it } from 'vitest';
import { SessionBuilder } from '@/lib/fixtures/session-builder';
import type { AssetMeta, SessionEvent } from '@/lib/session/types';
import { applyLevel, type TrimContext } from './trimmer';

const netEvents = (events: SessionEvent[]) =>
  events.filter(
    (e): e is Extract<SessionEvent, { type: 'net-request' }> =>
      e.type === 'net-request',
  );

const urls = (events: SessionEvent[]) =>
  netEvents(events).map((e) => e.payload.url);

function buildFixture(): { events: SessionEvent[]; ctx: TrimContext } {
  const b = new SessionBuilder();

  b.nav('https://app.example.com/dashboard', 'Dashboard');

  // First-party amplitude-style ingest on the app's OWN host: several POSTs.
  for (let i = 0; i < 4; i++) {
    b.net('POST', 'https://app.example.com/ingest/i/v0/e', {
      status: 200,
      reqBody: `{"events":[{"n":${i}}]}`,
    });
  }

  // A normal API GET → must survive.
  b.net('GET', 'https://app.example.com/api/x', {
    status: 200,
    resBody: '{"ok":true}',
  });

  // A failing analytics ingest (500) → escape hatch keeps it.
  b.net('POST', 'https://app.example.com/ingest/i/v0/e', {
    status: 500,
    reqBody: '{"events":[{"boom":true}]}',
  });

  const { session, events, assets } = b.build();
  const assetsById = new Map<string, AssetMeta>(
    assets.map((a) => {
      const { blob: _blob, ...meta } = a;
      return [a.id, meta];
    }),
  );
  return { events, ctx: { assetsById, settings: session.settings } };
}

describe('trimmer analytics noise', () => {
  it('drops healthy /ingest analytics POSTs at L1 while /api/x survives', () => {
    const { events, ctx } = buildFixture();
    const out = applyLevel(events, 'L1', ctx);
    const outUrls = urls(out);

    // The healthy ingest POSTs are gone.
    const healthyIngest = netEvents(out).filter(
      (e) => e.payload.url.includes('/ingest') && e.payload.status !== 500,
    );
    expect(healthyIngest).toHaveLength(0);

    // The normal API request survives.
    expect(outUrls).toContain('https://app.example.com/api/x');
  });

  it('keeps a failing (500) /ingest request via the error escape hatch', () => {
    const { events, ctx } = buildFixture();
    const out = applyLevel(events, 'L1', ctx);
    const survivingIngest = netEvents(out).filter((e) =>
      e.payload.url.includes('/ingest'),
    );
    expect(survivingIngest).toHaveLength(1);
    expect(survivingIngest[0]?.payload.status).toBe(500);
  });

  it('also drops analytics at L2 and L3', () => {
    const { events, ctx } = buildFixture();
    for (const lvl of ['L2', 'L3'] as const) {
      const out = applyLevel(events, lvl, ctx);
      const healthyIngest = netEvents(out).filter(
        (e) => e.payload.url.includes('/ingest') && e.payload.status !== 500,
      );
      expect(healthyIngest).toHaveLength(0);
      expect(urls(out)).toContain('https://app.example.com/api/x');
    }
  });
});
