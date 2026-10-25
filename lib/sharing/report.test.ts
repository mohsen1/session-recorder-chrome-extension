// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { SessionBuilder } from '@/lib/fixtures/session-builder';
import { buildHostedReport } from './report';

describe('hosted report', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('preserves local evidence links and media while stripping active captured content', async () => {
    vi.stubGlobal('Blob', NodeBlob);
    const data = new SessionBuilder({ name: '<script>alert(1)</script>' })
      .note(
        '<iframe src="https://attacker.example"></iframe><img src="https://attacker.example/track" onerror="alert(1)">',
      )
      .screenshot('manual')
      .video(0, 2000)
      .build();
    const files = await buildHostedReport({ ...data, level: 'L0' });
    const html = files.find((f) => f.path === 'index.html')!.text!;
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('script, iframe')).toBeNull();
    expect(document.querySelector('img[src^="https:"]')).toBeNull();
    expect(document.querySelector('video')?.getAttribute('src')).toMatch(/^video\//);
    expect(document.querySelector('img[src^="screenshots/"]')).not.toBeNull();
    expect(document.querySelector('a[href="session.json"]')).not.toBeNull();
  });
});
