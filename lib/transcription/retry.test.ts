import { expect, it } from 'vitest';
import type { VoiceSegmentPayload } from '@/lib/session/types';
import { ProoflineAiFailedError } from '@/lib/proofline/ai';
import {
  prepareTranscriptionRetry,
  transcriptionFailure,
  transcriptionRequestId,
} from './retry';

it.each(['failed', 'network'] as const)(
  'preserves ambiguous transcription identity and only renews a terminal failure: %s',
  async (outcome) => {
    const firstId = await transcriptionRequestId('session', 'voice-event');
    const initial: VoiceSegmentPayload = {
      assetId: 'audio',
      tStart: 0,
      tEnd: 5000,
      transcript: null,
      transcriptionRequest: {
        id: firstId,
        organizationId: 'original-workspace',
        provider: 'elevenlabs',
        language: 'en',
        keyterms: ['Proofline'],
      },
    };
    const failed = transcriptionFailure(
      initial,
      outcome === 'failed'
        ? new ProoflineAiFailedError()
        : new TypeError('Connection closed'),
    );
    // Persisting a failure alone must never authorize another paid operation.
    const persisted = JSON.parse(JSON.stringify(failed)) as VoiceSegmentPayload;
    expect(
      await transcriptionRequestId(
        'session',
        'voice-event',
        persisted.transcriptionGeneration,
      ),
    ).toBe(firstId);
    const retried = prepareTranscriptionRetry(persisted);
    const retryId = await transcriptionRequestId(
      'session',
      'voice-event',
      retried.transcriptionGeneration,
    );
    if (outcome === 'failed') {
      expect(retryId).not.toBe(firstId);
      expect(retried.transcriptionGeneration).toBe(1);
      expect(retried.transcriptionRequest).toBeUndefined();
      // Clicking again before the new operation completes does not renew twice.
      expect(prepareTranscriptionRetry(retried)).toBe(retried);
    } else {
      expect(retryId).toBe(firstId);
      expect(retried.transcriptionRequest).toEqual(initial.transcriptionRequest);
    }
  },
);

it('excludes managed billing identity and vocabulary from exported evidence', async () => {
  const { SessionBuilder } = await import('@/lib/fixtures/session-builder');
  const { buildBundle } = await import('@/lib/export/bundle');
  const data = new SessionBuilder().voice('Keep this transcript.', 0, 5000).build();
  const event = data.events.find((event) => event.type === 'voice-segment');
  if (!event || event.type !== 'voice-segment')
    throw new Error('Missing voice fixture');
  event.payload.transcriptionGeneration = 2;
  event.payload.transcriptionTerminalFailure = true;
  event.payload.transcriptionRequest = {
    id: 'private-operation-id',
    organizationId: 'private-workspace-id',
    provider: 'deepgram',
    keyterms: ['PrivateTerm'],
  };
  const files = await buildBundle({ ...data, level: 'L0' });
  const serialized = files.find((file) => file.path === 'session.json')!.text!;
  expect(serialized).toContain('Keep this transcript.');
  expect(serialized).not.toMatch(
    /private-operation-id|private-workspace-id|PrivateTerm|transcriptionGeneration|transcriptionTerminalFailure/,
  );
});
