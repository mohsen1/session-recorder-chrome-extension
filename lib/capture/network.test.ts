import { describe, expect, it, vi } from 'vitest';
import type {
  CaptureSettings,
  NetRequestPayload,
  RawEvent,
} from '@/lib/session/types';
import { NetworkCapturer, type NetworkDeps } from './network';

const SETTINGS: CaptureSettings = {
  screenshotPolicy: 'key-moments',
  inlineBodyCapBytes: 64 * 1024,
  assetBodyCapBytes: 512 * 1024,
  fileCapBytes: 1024 * 1024,
  redactionEnabled: true,
  customRedaction: { headerNames: [], bodyKeyPatterns: [], urlParamPatterns: [] },
  screenshotQuality: 70,
  screenshotDedupThreshold: 4,
};

function makeCapturer(overrides: Partial<NetworkDeps> = {}): {
  cap: NetworkCapturer;
  emitted: RawEvent[];
} {
  const emitted: RawEvent[] = [];
  const deps: NetworkDeps = {
    send: vi.fn(async () => ({})),
    getSettings: () => SETTINGS,
    emit: (raw) => emitted.push(raw),
    storeBodyAsset: vi.fn(async () => 'asset-1'),
    sessionStart: () => 0,
    ...overrides,
  };
  return { cap: new NetworkCapturer(deps), emitted };
}

function payloadOf(raw: RawEvent): NetRequestPayload {
  return raw.payload as NetRequestPayload;
}

describe('NetworkCapturer WebSockets', () => {
  it('emits one net-request with accumulated frames when a still-open socket is flushed', () => {
    const { cap, emitted } = makeCapturer();
    const rid = 'ws-1';

    cap.handle(7, 'Network.webSocketCreated', {
      requestId: rid,
      url: 'wss://app.example.com/api/chat/ws/orchestrator',
      initiator: { type: 'script' },
    });
    cap.handle(7, 'Network.webSocketFrameSent', {
      requestId: rid,
      response: { opcode: 1, payloadData: 'hello from client' },
    });
    cap.handle(7, 'Network.webSocketFrameReceived', {
      requestId: rid,
      response: { opcode: 1, payloadData: 'hi from server' },
    });
    cap.handle(7, 'Network.webSocketFrameReceived', {
      requestId: rid,
      response: { opcode: 2, payloadData: 'AAECAwQF' /* binary base64 */ },
    });

    // Socket never closes; recording stops -> flush.
    expect(emitted).toHaveLength(0);
    cap.flushOpen();

    expect(emitted).toHaveLength(1);
    const p = payloadOf(emitted[0]!);
    expect(emitted[0]!.tabId).toBe(7);
    expect(p.websocket).toBe(true);
    expect(p.url).toBe('wss://app.example.com/api/chat/ws/orchestrator');
    expect(p.wsFrames).toHaveLength(3);
    expect(p.wsFrames![0]).toMatchObject({
      dir: 'sent',
      opcode: 1,
      text: 'hello from client',
    });
    expect(p.wsFrames![1]).toMatchObject({ dir: 'recv', opcode: 1 });
    expect(p.wsFrames![2]).toMatchObject({
      dir: 'recv',
      opcode: 2,
      text: 'AAECAwQF',
    });
  });

  it('does not double-emit: a socket flushed then closed emits exactly once', () => {
    const { cap, emitted } = makeCapturer();
    const rid = 'ws-2';
    cap.handle(3, 'Network.webSocketCreated', {
      requestId: rid,
      url: 'wss://x/y',
    });
    cap.handle(3, 'Network.webSocketFrameReceived', {
      requestId: rid,
      response: { opcode: 1, payloadData: 'frame' },
    });
    cap.flushOpen();
    cap.handle(3, 'Network.webSocketClosed', { requestId: rid });
    expect(emitted).toHaveLength(1);
  });

  it('flushOpen leaves in-flight normal requests untouched', () => {
    const { cap, emitted } = makeCapturer();
    cap.handle(1, 'Network.requestWillBeSent', {
      requestId: 'req-1',
      request: { method: 'GET', url: 'https://x/data', headers: {} },
      type: 'XHR',
    });
    cap.flushOpen();
    expect(emitted).toHaveLength(0);
  });
});

describe('NetworkCapturer binary bodies', () => {
  it('replaces a gzip-encoded response body with a short marker', async () => {
    const gzipGarbage = 'garbage-that-should-not-appear';
    const { cap, emitted } = makeCapturer({
      send: vi.fn(async () => ({ body: gzipGarbage, base64Encoded: false })),
    });
    const rid = 'r-gzip';
    cap.handle(2, 'Network.requestWillBeSent', {
      requestId: rid,
      request: { method: 'GET', url: 'https://x/data', headers: {} },
      type: 'XHR',
    });
    cap.handle(2, 'Network.responseReceived', {
      requestId: rid,
      response: {
        status: 200,
        headers: { 'content-type': 'text/plain', 'content-encoding': 'gzip' },
        mimeType: 'text/plain',
      },
    });
    cap.handle(2, 'Network.loadingFinished', { requestId: rid });
    await vi.waitFor(() => expect(emitted).toHaveLength(1));

    const body = payloadOf(emitted[0]!).responseBody!;
    expect(body.present).toBe(true);
    expect(body.base64).toBe(false);
    expect(body.truncated).toBe(false);
    expect(body.text).toContain('binary body');
    expect(body.text).toContain('gzip');
    expect(body.text).not.toContain('garbage');
    expect(body.originalSize).toBeGreaterThan(0);
  });

  it('replaces a high-non-printable request body with a marker (no binary header)', () => {
    const emitted: RawEvent[] = [];
    const { cap } = makeCapturer({ emit: (raw) => emitted.push(raw) });
    // 10 control chars (0x01) + a short readable tail -> >15% non-printable.
    // content-type is plain text, so ONLY the char-ratio heuristic can flag it.
    const binary = String.fromCharCode(1).repeat(10) + 'marker-text-payload';
    const rid = 'r-bin';
    cap.handle(1, 'Network.requestWillBeSent', {
      requestId: rid,
      request: {
        method: 'POST',
        url: 'https://x/ingest',
        headers: { 'content-type': 'text/plain' },
        postData: binary,
      },
      type: 'XHR',
    });
    cap.handle(1, 'Network.loadingFailed', {
      requestId: rid,
      errorText: 'net::ERR',
    });

    expect(emitted).toHaveLength(1);
    const body = payloadOf(emitted[0]!).requestBody!;
    expect(body.text).toContain('binary body');
    expect(body.base64).toBe(false);
    expect(body.text).not.toContain('marker-text-payload');
  });

  it('keeps genuinely textual bodies intact (redaction still applies)', () => {
    const emitted: RawEvent[] = [];
    const { cap } = makeCapturer({ emit: (raw) => emitted.push(raw) });
    const rid = 'r-json';
    cap.handle(1, 'Network.requestWillBeSent', {
      requestId: rid,
      request: {
        method: 'POST',
        url: 'https://x/api',
        headers: { 'content-type': 'application/json' },
        postData: '{"name":"alice","note":"plain text here"}',
      },
      type: 'XHR',
    });
    cap.handle(1, 'Network.loadingFailed', { requestId: rid, errorText: 'x' });

    const body = payloadOf(emitted[0]!).requestBody!;
    expect(body.text).toContain('plain text here');
    expect(body.text).not.toContain('binary body');
  });
});
