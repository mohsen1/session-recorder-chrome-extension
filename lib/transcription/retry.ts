import type { VoiceSegmentPayload } from '@/lib/session/types';
import { ProoflineAiCancelledError, ProoflineAiFailedError } from '@/lib/proofline/ai';

/** Only an explicit retry of a confirmed terminal operation can spend again. */
export function prepareTranscriptionRetry(
  payload: VoiceSegmentPayload,
): VoiceSegmentPayload {
  if (!payload.transcriptionTerminalFailure) return payload;
  return {
    ...payload,
    transcriptionGeneration: (payload.transcriptionGeneration ?? 0) + 1,
    transcriptionRequest: undefined,
    transcriptionTerminalFailure: undefined,
    transcriptionError: undefined,
  };
}
export function transcriptionFailure(
  payload: VoiceSegmentPayload,
  error: unknown,
): VoiceSegmentPayload {
  return {
    ...payload,
    transcriptionError:
      error instanceof Error ? error.message : 'Transcription failed.',
    transcriptionTerminalFailure:
      error instanceof ProoflineAiFailedError ||
      error instanceof ProoflineAiCancelledError,
  };
}
export async function transcriptionRequestId(
  sessionId: string,
  eventId: string,
  generation = 0,
): Promise<string> {
  const identity = `${sessionId}/${eventId}/transcription${generation ? `/${generation}` : ''}`;
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity)),
  );
  const hex = [...digest.slice(0, 16)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}
