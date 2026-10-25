import { describe, expect, it } from 'vitest';
import { recordedEvidence } from './ai';

const report = (annotations: string, notes: string, timeline: string, diagnostics: string) => [
  'ANNOTATIONS — primary reported concerns', annotations,
  'NOTES AND NARRATION — reporter context', notes,
  'INTERACTION TIMELINE — reproduction context', timeline,
  'BACKGROUND DIAGNOSTICS — include only if related to the reported concern', diagnostics,
].join('\n\n');

describe('managed evidence contract', () => {
  it('keeps diagnostic noise out of reporter narration in short reports', () => {
    const evidence = recordedEvidence(report(
      'The recipe description is unclear.',
      'Explain which tests this recipe runs.',
      'Opened Finishing recipes.',
      'Unrelated CSP error.',
    ));
    expect(evidence.annotations?.[0]).toContain('recipe description');
    expect(evidence.transcript).toContain('which tests');
    expect(evidence.page_text).toContain('Opened Finishing recipes');
    expect(evidence.technical_details).toContain('CSP error');
    expect(evidence.transcript).not.toContain('CSP error');
    expect(evidence.annotations?.[0]).not.toContain('CSP error');
  });

  it.each(['字幕を表示して 🎙️', 'a"\\\n\u0000'])('fits the server byte budget for %j evidence', (text) => {
    const evidence = recordedEvidence(report(
      text.repeat(10_000),
      'Keep this narration. ' + text.repeat(10_000),
      'Keep this reproduction step. ' + text.repeat(10_000),
      'Supporting diagnostic. ' + text.repeat(10_000),
    ));
    expect(new TextEncoder().encode(JSON.stringify(evidence)).length).toBeLessThan(64_000);
    expect(evidence.annotations?.[0]).toContain(text);
    expect(evidence.transcript).toContain('Keep this narration.');
    expect(evidence.page_text).toContain('Keep this reproduction step.');
    expect(evidence.technical_details).toContain('Supporting diagnostic.');
    for (const value of [...evidence.annotations!, evidence.transcript!, evidence.page_text!, evidence.technical_details!]) {
      expect(new TextDecoder().decode(new TextEncoder().encode(value))).toBe(value);
    }
  });
});
