/**
 * Asset dedup: byte-identical asset blobs must be written to the zip exactly
 * once, and every event referencing any asset in the group must resolve to that
 * single surviving path. Regression guard for the real session where one 772 KB
 * response body was captured as four byte-identical files (3 MB of pure dup).
 */
import { describe, it, expect } from 'vitest';

import { buildBundle } from './bundle';
import type {
  Asset,
  Session,
  SessionEvent,
} from '@/lib/session/types';
import { makeDefaultSettings } from '@/lib/session/settings';
import { scoreEvent } from '@/lib/session/events';

function pngBlob(bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
}

function screenshotEvent(id: string, assetId: string, t: number): SessionEvent {
  const payload = {
    assetId,
    width: 4,
    height: 1,
    trigger: 'interaction' as const,
    ahash: '0000000000000000',
  };
  return {
    id,
    sessionId: 'sess_dedup',
    t,
    tabId: 1,
    type: 'screenshot',
    importance: scoreEvent({ type: 'screenshot', tabId: 1, payload }),
    payload,
  };
}

function baseSession(): Session {
  return {
    id: 'sess_dedup',
    name: 'dedup',
    startedAt: Date.UTC(2026, 0, 2, 15, 0, 0),
    endedAt: Date.UTC(2026, 0, 2, 15, 1, 0),
    initialUrl: 'https://app.example.com',
    tabs: [
      {
        tabId: 1,
        url: 'https://app.example.com',
        title: 'App',
        attachedAt: Date.UTC(2026, 0, 2, 15, 0, 0),
        role: 'primary',
        attached: true,
      },
    ],
    settings: makeDefaultSettings(),
    status: 'stopped',
    counts: { screenshot: 3 },
    assetBytes: 0,
  };
}

describe('buildBundle asset dedup', () => {
  it('writes byte-identical assets once and points both refs at one path', async () => {
    // Two identical blobs (same bytes) and one distinct blob.
    const dupBytes = [1, 2, 3, 4, 5, 6, 7, 8];
    const uniqueBytes = [9, 8, 7, 6, 5, 4, 3, 2];

    const assets: Asset[] = [
      {
        id: 'a1',
        sessionId: 'sess_dedup',
        kind: 'screenshot',
        mime: 'image/png',
        size: dupBytes.length,
        blob: pngBlob(dupBytes),
      },
      {
        id: 'a2',
        sessionId: 'sess_dedup',
        kind: 'screenshot',
        mime: 'image/png',
        size: dupBytes.length,
        blob: pngBlob([...dupBytes]), // same bytes, different Blob instance
      },
      {
        id: 'a3',
        sessionId: 'sess_dedup',
        kind: 'screenshot',
        mime: 'image/png',
        size: uniqueBytes.length,
        blob: pngBlob(uniqueBytes),
      },
    ];

    const events: SessionEvent[] = [
      screenshotEvent('e1', 'a1', 500),
      screenshotEvent('e2', 'a2', 1000),
      screenshotEvent('e3', 'a3', 1500),
    ];

    const files = await buildBundle({
      session: baseSession(),
      events,
      assets,
      level: 'L0',
    });

    // Only asset files (exclude the fixed text artifacts).
    const textPaths = new Set([
      'report.md',
      'session.json',
      'MANIFEST.md',
      'transcript.json',
    ]);
    const assetFiles = files.filter((f) => !textPaths.has(f.path));

    // Two unique blobs => exactly two asset files, no duplicate paths.
    expect(assetFiles.length).toBe(2);
    const paths = assetFiles.map((f) => f.path);
    expect(new Set(paths).size).toBe(2);

    // Both duplicate events resolve to the same surviving path.
    const sessionJson = files.find((f) => f.path === 'session.json');
    const parsed = JSON.parse(sessionJson!.text!) as {
      events: SessionEvent[];
    };
    const byId = new Map(parsed.events.map((e) => [e.id, e]));
    const p1 = (byId.get('e1')!.payload as { assetId: string }).assetId;
    const p2 = (byId.get('e2')!.payload as { assetId: string }).assetId;
    const p3 = (byId.get('e3')!.payload as { assetId: string }).assetId;

    expect(p1).toBe(p2); // duplicate refs collapse to one path
    expect(p3).not.toBe(p1); // distinct blob keeps its own path

    // The surviving duplicate path is one of the emitted files; the distinct
    // one is the other. Every referenced path is actually written exactly once.
    expect(new Set(paths)).toEqual(new Set([p1, p3]));
    for (const p of [p1, p3]) {
      expect(assetFiles.filter((f) => f.path === p).length).toBe(1);
    }
  });
});
