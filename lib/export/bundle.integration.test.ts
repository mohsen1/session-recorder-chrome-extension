/**
 * End-to-end export pipeline check: fixture session -> trimmer -> markdown ->
 * bundle -> zip. Exercises every export module together with realistic data and
 * writes the rendered reports to the scratchpad for human inspection (the plan's
 * "paste-test" proxy).
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { unzipSync } from 'fflate';

import { SessionBuilder } from '@/lib/fixtures/session-builder';
import { makeDefaultSettings } from '@/lib/session/settings';
import { buildBundle, estimateForLevels } from './bundle';
import { zipFiles } from './zip';
import type { VerbosityLevel } from '@/lib/session/types';

const OUT = '/private/tmp/claude-501/-Users-mohsen-code-saas-walkthrough-chrome-extension/8a18cfe7-352b-4d33-a258-2b6237a32f09/scratchpad/reports';

function richSession() {
  const b = new SessionBuilder({ name: 'Checkout bug repro' })
    .nav('https://app.example.com/dashboard', 'Dashboard')
    .click('Open cart')
    .screenshot('interaction')
    .net('GET', 'https://api.example.com/cart', { status: 200, resBody: JSON.stringify({ items: [{ id: 1, name: 'Widget', price: 9.99 }, { id: 2, name: 'Gadget', price: 19.99 }], total: 29.98 }), mime: 'application/json' })
    .input('coupon', 'SAVE10')
    .marker('Bug happens here')
    .note('The total does not update after applying the coupon')
    .voice('So I click apply and you can see the total stays the same, that is the bug', 4000, 9000)
    .net('POST', 'https://api.example.com/cart/coupon', { status: 500, reqBody: JSON.stringify({ code: 'SAVE10' }), resBody: JSON.stringify({ error: 'internal error', trace: 'NullPointer at CouponService.apply' }), mime: 'application/json' })
    .consoleLog('error', 'Failed to apply coupon: 500')
    .error('Uncaught TypeError: cannot read property total of undefined')
    .annotation();
  // repeated polling to exercise request collapsing
  for (let i = 0; i < 8; i += 1) {
    b.net('GET', `https://api.example.com/cart/status?poll=${i}`, { status: 200, resBody: JSON.stringify({ ready: false }), mime: 'application/json' });
  }
  // static assets that should be dropped at higher levels
  b.net('GET', 'https://cdn.example.com/logo.png', { status: 200, mime: 'image/png' });
  b.net('GET', 'https://cdn.example.com/app.css', { status: 200, mime: 'text/css' });
  b.scroll().click('Checkout').screenshot('interaction').file('invoice.pdf', 24000);
  return b.build();
}

describe('export pipeline (integration)', () => {
  it('produces a readable, shrinking report across all levels and a valid zip', async () => {
    mkdirSync(OUT, { recursive: true });
    const { session, events, assets } = richSession();
    const levels: VerbosityLevel[] = ['L0', 'L1', 'L2', 'L3'];

    const reportSizes: Record<string, number> = {};
    for (const level of levels) {
      const files = await buildBundle({ session, events, assets, level });
      const report = files.find((f) => f.path === 'report.md');
      const sessionJson = files.find((f) => f.path === 'session.json');
      expect(report?.text, `report.md exists at ${level}`).toBeTruthy();
      expect(sessionJson?.text, `session.json exists at ${level}`).toBeTruthy();

      const md = report!.text!;
      reportSizes[level] = md.length;
      writeFileSync(`${OUT}/report-${level}.md`, md);

      // Protected signals must survive at EVERY level.
      expect(md, `${level} keeps marker`).toContain('Bug happens here');
      expect(md, `${level} keeps note`).toContain('does not update');
      expect(md, `${level} keeps transcript`).toContain('that is the bug');
      expect(md, `${level} keeps the error`).toContain('TypeError');
      // session.json must be valid JSON.
      JSON.parse(sessionJson!.text!);

      // Zip round-trips and contains report.md under the root dir.
      const bytes = await zipFiles(files, `session-${level}`);
      const unzipped = unzipSync(bytes);
      const keys = Object.keys(unzipped);
      expect(keys.some((k) => k === `session-${level}/report.md`), `${level} zip has report.md`).toBe(true);
    }

    // Verbosity should reduce size monotonically (L0 >= L1 >= L2 >= L3).
    expect(reportSizes.L0).toBeGreaterThan(reportSizes.L1!);
    expect(reportSizes.L1).toBeGreaterThan(reportSizes.L2!);
    // Minimal must be strictly more aggressive than Compact.
    expect(reportSizes.L2).toBeGreaterThan(reportSizes.L3!);

    // Token estimates should be present and decreasing.
    const meta = assets.map(({ blob, ...m }) => m);
    const estimates = estimateForLevels(events, meta, session);
    expect(estimates.length).toBe(4);
    writeFileSync(`${OUT}/estimates.json`, JSON.stringify(estimates, null, 2));
    expect(estimates[0]!.tokens).toBeGreaterThanOrEqual(estimates[3]!.tokens);

    // Emit a size summary for inspection.
    writeFileSync(`${OUT}/sizes.json`, JSON.stringify({ reportSizes, estimates: estimates.map((e) => ({ level: e.level, tokens: e.tokens })) }, null, 2));
  });
});

describe('export pipeline OpenAPI compilation (captureApiSpec)', () => {
  function apiSpecSession() {
    const settings = { ...makeDefaultSettings(), captureApiSpec: true };
    const b = new SessionBuilder({ name: 'API walkthrough', settings })
      .nav('https://app.example.com/dashboard', 'Dashboard')
      .net('POST', 'https://api.example.com/api/users', {
        status: 200,
        reqBody: '{"name":"Ada"}',
        resBody: '{"id":1,"name":"Ada"}',
      })
      .net('GET', 'https://api.example.com/api/users/1', {
        status: 200,
        resBody: '{"id":1,"name":"Ada"}',
      })
      .net('GET', 'https://cdn.example.com/logo.png', { status: 200, mime: 'image/png' });
    return b.build();
  }

  it('adds a valid openapi.json at every level and mentions it in report.md', async () => {
    const { session, events, assets } = apiSpecSession();
    for (const level of ['L0', 'L3'] as VerbosityLevel[]) {
      const files = await buildBundle({ session, events, assets, level });
      const openapi = files.find((f) => f.path === 'openapi.json');
      expect(openapi?.text, `openapi.json exists at ${level}`).toBeTruthy();
      const spec = JSON.parse(openapi!.text!) as Record<string, any>;
      expect(spec.openapi).toBe('3.1.0');
      // Compiled from UNTRIMMED events: bodies stripped at L3 must not starve it.
      expect(spec.paths['/api/users'].post.responses['200']).toBeTruthy();
      expect(spec.paths['/api/users/{userId}'].get).toBeTruthy();
      expect(spec.paths['/logo.png']).toBeUndefined();

      const report = files.find((f) => f.path === 'report.md');
      expect(report!.text).toContain('openapi.json');
    }
  });

  it('resolves full stored bodies from net-body assets when inline text is truncated', async () => {
    const { session, events, assets } = apiSpecSession();
    const full = '{"id":1,"name":"Ada","email":"ada@example.com"}';
    assets.push({
      id: 'asset_full',
      sessionId: session.id,
      kind: 'net-body',
      mime: 'application/json',
      size: full.length,
      blob: new Blob([full], { type: 'application/json' }),
    });
    const net = events.find(
      (e) => e.type === 'net-request' && e.payload.method === 'GET' && e.payload.url.includes('/api/users/1'),
    ) as Extract<(typeof events)[number], { type: 'net-request' }>;
    net.payload.responseBody = {
      present: true,
      mime: 'application/json',
      text: '{"id":1,"na',
      truncated: true,
      originalSize: full.length,
      assetId: 'asset_full',
    };

    const files = await buildBundle({ session, events, assets, level: 'L0' });
    const spec = JSON.parse(files.find((f) => f.path === 'openapi.json')!.text!) as Record<string, any>;
    const schema = spec.paths['/api/users/{userId}'].get.responses['200'].content['application/json'].schema;
    expect(Object.keys(schema.properties).sort()).toEqual(['email', 'id', 'name']);
  });

  it('omits openapi.json when the setting is off or there is no API traffic', async () => {
    // Flag off: same traffic, no spec, no report mention.
    const off = richSession();
    expect(off.session.settings.captureApiSpec).toBe(false);
    const offFiles = await buildBundle({ ...off, level: 'L0' });
    expect(offFiles.find((f) => f.path === 'openapi.json')).toBeUndefined();
    expect(offFiles.find((f) => f.path === 'report.md')!.text).not.toContain('openapi.json');

    // Flag on but no API requests: no spec either.
    const settings = { ...makeDefaultSettings(), captureApiSpec: true };
    const quiet = new SessionBuilder({ name: 'No API', settings })
      .nav('https://app.example.com/', 'Home')
      .click('About')
      .build();
    const quietFiles = await buildBundle({ ...quiet, level: 'L0' });
    expect(quietFiles.find((f) => f.path === 'openapi.json')).toBeUndefined();
  });
});
