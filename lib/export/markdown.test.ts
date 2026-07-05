/**
 * Golden-ish tests for the pure Markdown renderer.
 *
 * NOTE: `lib/fixtures/session-builder.ts` is authored by a concurrent task and
 * did not exist when this test was written, so this file builds a small but
 * expressive synthetic session inline (mirroring the fixture shape) so it can
 * run in isolation. The assertions are the ones the task requires: the report
 * renders without throwing, contains the header, a known click's text and an
 * error marker; and `formatClock` formats both `mm:ss` and `h:mm:ss`.
 */

import { describe, expect, it } from 'vitest';
import type {
  AssetMeta,
  Session,
  SessionEvent,
} from '@/lib/session/types';
import { makeDefaultSettings } from '@/lib/session/settings';
import { scoreEvent } from '@/lib/session/events';
import { formatClock, renderManifest, renderReport } from './markdown';
import type { RenderInput } from './markdown';

const SESSION_ID = 'sess_test';
const SHOT_ASSET = 'asset_shot_1';
const BODY_ASSET = 'asset_body_1';

let seq = 0;
function ev<E extends SessionEvent>(
  partial: Omit<E, 'id' | 'sessionId' | 'importance'> & { importance?: number },
): SessionEvent {
  const base = {
    id: `evt_${seq++}`,
    sessionId: SESSION_ID,
    importance: scoreEvent({
      type: partial.type,
      tabId: partial.tabId,
      payload: partial.payload,
    } as Parameters<typeof scoreEvent>[0]),
    ...partial,
  };
  return base as SessionEvent;
}

function buildSession(): RenderInput {
  const session: Session = {
    id: SESSION_ID,
    name: 'Checkout flow',
    startedAt: Date.UTC(2026, 6, 5, 12, 0, 0),
    endedAt: Date.UTC(2026, 6, 5, 12, 5, 0),
    initialUrl: 'https://app.example.com/cart',
    tabs: [
      {
        tabId: 1,
        url: 'https://app.example.com/cart',
        title: 'Cart — Example',
        attachedAt: 0,
        role: 'primary',
        attached: true,
      },
    ],
    settings: makeDefaultSettings(),
    status: 'stopped',
    counts: {},
    assetBytes: 2048,
  };

  const events: SessionEvent[] = [
    ev({
      t: 500,
      tabId: 1,
      type: 'nav',
      payload: { url: 'https://app.example.com/cart', title: 'Cart' },
    }),
    ev({
      t: 2000,
      tabId: 1,
      type: 'click',
      payload: {
        descriptor: {
          tag: 'button',
          id: 'checkout',
          text: 'Submit order',
          selector: 'button#checkout',
        },
        modifiers: [],
      },
    }),
    ev({
      t: 2500,
      tabId: 1,
      type: 'input',
      payload: {
        descriptor: { tag: 'input', id: 'coupon', selector: 'input#coupon' },
        value: 'SAVE10',
        redacted: false,
      },
    }),
    ev({
      t: 3000,
      tabId: 1,
      type: 'net-request',
      payload: {
        requestId: 'req1',
        method: 'POST',
        url: 'https://api.example.com/v1/orders',
        status: 500,
        statusText: 'Internal Server Error',
        requestHeaders: [],
        responseHeaders: [],
        requestBody: {
          present: true,
          mime: 'application/json',
          text: '{"cart":"c1"}',
        },
        responseBody: {
          present: true,
          mime: 'application/json',
          text: '{"error":"boom"}',
          assetId: BODY_ASSET,
        },
      },
    }),
    ev({
      t: 3200,
      tabId: 1,
      type: 'error',
      payload: {
        message: 'Order failed: server returned 500',
        origin: 'network',
        stack: 'at submit (checkout.js:42)',
      },
    }),
    ev({
      t: 3500,
      tabId: 1,
      type: 'console',
      payload: { level: 'warn', text: 'retrying order submission', repeat: 3 },
    }),
    ev({
      t: 4000,
      tabId: 1,
      type: 'screenshot',
      payload: {
        assetId: SHOT_ASSET,
        width: 800,
        height: 600,
        trigger: 'error',
        contextText: 'error dialog visible',
      },
    }),
    ev({
      t: 4200,
      tabId: 1,
      type: 'marker',
      payload: { name: 'Bug reproduced here' },
    }),
    ev({
      t: 4500,
      tabId: 1,
      type: 'note',
      payload: { text: 'The 500 only happens with a coupon applied.' },
    }),
    ev({
      t: 5000,
      type: 'voice-segment',
      payload: {
        assetId: 'asset_audio_1',
        tStart: 4800,
        tEnd: 5200,
        transcript: 'And here it crashes.',
      },
    }),
    ev({
      t: 5500,
      tabId: 1,
      type: 'annotation',
      payload: {
        shapes: [
          {
            tool: 'arrow',
            color: '#ff0000',
            strokeWidth: 3,
            from: { x: 0, y: 0 },
            to: { x: 10, y: 10 },
            targetDescriptor: {
              tag: 'div',
              selector: 'div.error',
              text: 'Something went wrong',
            },
          },
          {
            tool: 'text',
            color: '#000',
            strokeWidth: 1,
            text: 'this button',
          },
        ],
        screenshotAssetId: SHOT_ASSET,
        viewport: { w: 800, h: 600 },
      },
    }),
  ];

  const assets: AssetMeta[] = [
    {
      id: SHOT_ASSET,
      sessionId: SESSION_ID,
      kind: 'screenshot',
      mime: 'image/jpeg',
      size: 1500,
    },
    {
      id: BODY_ASSET,
      sessionId: SESSION_ID,
      kind: 'net-body',
      mime: 'application/json',
      size: 42,
    },
  ];

  const paths: Record<string, string> = {
    [SHOT_ASSET]: 'screenshots/001-0004.jpg',
    [BODY_ASSET]: 'network/001-api.example.com-orders.json',
  };

  return {
    session,
    events,
    assets,
    level: 'L0',
    assetPath: (id) => paths[id],
  };
}

describe('formatClock', () => {
  it('formats mm:ss under an hour', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(42_000)).toBe('00:42');
    expect(formatClock(62_000)).toBe('01:02');
    expect(formatClock(59 * 60_000 + 59_000)).toBe('59:59');
  });

  it('formats h:mm:ss at or past an hour', () => {
    expect(formatClock(3_600_000)).toBe('1:00:00');
    expect(formatClock(3_661_000)).toBe('1:01:01');
    expect(formatClock(2 * 3_600_000 + 5 * 60_000 + 9_000)).toBe('2:05:09');
  });

  it('clamps negative input to zero', () => {
    expect(formatClock(-1000)).toBe('00:00');
  });
});

describe('renderReport', () => {
  it('renders a full report without throwing', () => {
    const input = buildSession();
    expect(() => renderReport(input)).not.toThrow();
  });

  it('includes the header block', () => {
    const md = renderReport(buildSession());
    expect(md).toContain('# Session Report: Checkout flow');
    expect(md).toContain('**App:**');
    expect(md).toContain('https://app.example.com');
    expect(md).toContain('**Duration:** 05:00');
    expect(md).toContain('### Tabs');
    expect(md).toContain('### Capture settings');
    expect(md).toContain('### Event counts');
  });

  it("contains a known click's text", () => {
    const md = renderReport(buildSession());
    expect(md).toContain('CLICK "Submit order" (button#checkout, tab 1)');
  });

  it('marks errors loudly with the warning glyph', () => {
    const md = renderReport(buildSession());
    expect(md).toContain('⚠');
    expect(md).toContain('Order failed: server returned 500');
  });

  it('renders nav as a section break with a timestamp', () => {
    const md = renderReport(buildSession());
    expect(md).toMatch(/## \[00:00\] NAV https:\/\/app\.example\.com\/cart/);
  });

  it('renders the network request with method, status and body', () => {
    const md = renderReport(buildSession());
    expect(md).toContain('500 POST /v1/orders');
    expect(md).toContain('{"error":"boom"}');
    expect(md).toContain('## Appendix: Network Index');
  });

  it('links included screenshots and annotations', () => {
    const md = renderReport(buildSession());
    expect(md).toContain('![error dialog visible](screenshots/001-0004.jpg)');
    expect(md).toContain('**arrow**');
  });

  it('renders voice segments and markers', () => {
    const md = renderReport(buildSession());
    expect(md).toContain('🎙️');
    expect(md).toContain('And here it crashes.');
    expect(md).toContain('MARKER');
    expect(md).toContain('Bug reproduced here');
  });

  it('skips screenshots whose asset is not included', () => {
    const input = buildSession();
    const md = renderReport({ ...input, assetPath: () => undefined });
    expect(md).not.toContain('screenshots/001-0004.jpg');
  });
});

describe('renderManifest', () => {
  it('lists every included asset with path, kind and size', () => {
    const md = renderManifest(buildSession());
    expect(md).toContain('# Asset Manifest');
    expect(md).toContain('screenshots/001-0004.jpg');
    expect(md).toContain('screenshot');
    expect(md).toContain('1.5 KB');
    expect(md).toContain('network/001-api.example.com-orders.json');
  });

  it('reports no assets when none are included', () => {
    const input = buildSession();
    const md = renderManifest({ ...input, assetPath: () => undefined });
    expect(md).toContain('No assets included');
  });
});
