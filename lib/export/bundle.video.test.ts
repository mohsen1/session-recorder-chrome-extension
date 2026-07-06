/**
 * Bundle-level tests for video-segment export: L0/L1 write the video asset to
 * `video/NNN-mmss.webm` and reference it from report.md / MANIFEST.md /
 * session.json; L2+ drop the file but keep the report line (thinVideo).
 */
import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { SessionBuilder } from '@/lib/fixtures/session-builder';
import { buildBundle } from './bundle';
import { zipFiles } from './zip';

function videoSession() {
  return new SessionBuilder({ name: 'Video walkthrough' })
    .nav('https://app.example.com/dashboard', 'Dashboard')
    .click('Open settings')
    .video(4000, 9000)
    .marker('Done')
    .build();
}

describe('bundle video export', () => {
  it('writes the video asset at L0 and references it everywhere', async () => {
    const { session, events, assets } = videoSession();
    const files = await buildBundle({ session, events, assets, level: 'L0' });

    const videoFile = files.find((f) =>
      /^video\/001-\d{4,6}\.webm$/.test(f.path),
    );
    expect(videoFile, 'video file planned under video/').toBeTruthy();
    expect(videoFile!.bytes!.length).toBeGreaterThan(0);

    const report = files.find((f) => f.path === 'report.md')!.text!;
    expect(report).toContain('🎬 VIDEO segment 00:04–00:09');
    expect(report).toContain(videoFile!.path);

    const manifest = files.find((f) => f.path === 'MANIFEST.md')!.text!;
    expect(manifest).toContain(videoFile!.path);
    expect(manifest).toContain('Video segment (video/webm)');

    // session.json carries the zip-relative path, not the raw asset id.
    const sessionJson = JSON.parse(
      files.find((f) => f.path === 'session.json')!.text!,
    ) as { events: Array<{ type: string; payload: { assetId?: string } }> };
    const seg = sessionJson.events.find((e) => e.type === 'video-segment');
    expect(seg?.payload.assetId).toBe(videoFile!.path);

    // Round-trips through the zip.
    const bytes = await zipFiles(files, 'video-session');
    const unzipped = unzipSync(bytes);
    expect(Object.keys(unzipped)).toContain(`video-session/${videoFile!.path}`);
  });

  it('keeps the video file at L1', async () => {
    const { session, events, assets } = videoSession();
    const files = await buildBundle({ session, events, assets, level: 'L1' });
    expect(files.some((f) => f.path.startsWith('video/'))).toBe(true);
  });

  it('drops the video file at L2 but keeps the report line', async () => {
    const { session, events, assets } = videoSession();
    for (const level of ['L2', 'L3'] as const) {
      const files = await buildBundle({ session, events, assets, level });
      expect(
        files.some((f) => f.path.startsWith('video/')),
        `${level} has no video file`,
      ).toBe(false);
      const report = files.find((f) => f.path === 'report.md')!.text!;
      expect(report).toContain('🎬 VIDEO segment 00:04–00:09');
      expect(report).not.toContain('.webm');
    }
  });
});
