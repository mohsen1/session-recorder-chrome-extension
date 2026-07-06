import { describe, expect, it } from 'vitest';
import { buildReportHtml } from './report-html';
import { makeDefaultSettings } from '@/lib/session/settings';
import type { Session, SessionEvent } from '@/lib/session/types';

function session(): Session {
  return {
    id: 'ses_1',
    name: 'Checkout <flow>',
    startedAt: 0,
    endedAt: 5000,
    initialUrl: 'https://app.example.com',
    tabs: [
      { tabId: 1, url: 'https://app.example.com', title: 'App', role: 'primary', attached: false, attachedAt: 0 },
    ],
    settings: makeDefaultSettings(),
    status: 'stopped',
    counts: {},
    assetBytes: 0,
  };
}

const events: SessionEvent[] = [
  {
    id: 'e1', sessionId: 'ses_1', t: 1000, type: 'marker', importance: 90,
    payload: { name: 'Bug: total wrong' },
  },
  {
    id: 'e2', sessionId: 'ses_1', t: 2000, type: 'screenshot', importance: 30,
    payload: { assetId: 'a1', width: 100, height: 80, trigger: 'manual' },
  },
];

describe('buildReportHtml', () => {
  it('produces a self-contained document with inline styles and the screenshot', () => {
    const html = buildReportHtml({
      session: session(),
      events,
      assets: [
        { id: 'a1', sessionId: 'ses_1', kind: 'screenshot', mime: 'image/jpeg', size: 10 },
      ],
      level: 'L0',
      imageUrl: (id) => (id === 'a1' ? 'data:image/jpeg;base64,AAAA' : undefined),
      sanitize: (h) => h,
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<style>');
    expect(html).toContain('data:image/jpeg;base64,AAAA');
    expect(html).toContain('Bug: total wrong');
    // The <title> is always escaped, independent of body sanitization.
    expect(html).toContain('Checkout &lt;flow&gt; — Session report');
  });

  it('routes the rendered body through the provided sanitizer', () => {
    let received = '';
    const html = buildReportHtml({
      session: session(),
      events,
      assets: [],
      level: 'L0',
      imageUrl: () => undefined,
      sanitize: (h) => {
        received = h;
        return '<p>CLEAN</p>';
      },
    });
    // Raw marked output reached the sanitizer, and only its result is embedded.
    expect(received).toContain('Bug: total wrong');
    expect(html).toContain('<p>CLEAN</p>');
    expect(html).not.toContain('Bug: total wrong');
  });
});
