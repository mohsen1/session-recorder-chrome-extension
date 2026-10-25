import { normalizeKeyterms } from '@/lib/transcription/keyterms';
import { delay, prooflineRequest } from './client';
import { type ProoflineSettings } from './settings';
export interface RecorderAiInput {
  annotations?: string[];
  audio?: {
    pcm_base64: string;
    sample_rate: 16000;
    provider: 'deepgram' | 'elevenlabs';
    keyterms?: string[];
    language?: string;
  };
  transcript?: string;
  page_title?: string;
  page_url?: string;
  page_text?: string;
  technical_details?: string;
}
export class ProoflineAiCancelledError extends Error {
  constructor() {
    super('This AI request was cancelled. Try again to start a new request.');
  }
}
export class ProoflineAiFailedError extends Error {
  constructor() {
    super(
      'Proofline could not finish this AI request. Try again to start a new request.',
    );
  }
}
interface AiJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: {
    title?: string;
    markdown?: string;
    terms?: string[];
    text?: string;
    words?: { word: string; start: number; end: number }[];
    duration_seconds?: number;
  };
  error?: string;
}
export function recordedEvidence(text: string): RecorderAiInput {
  const annotations = text.split('NOTES AND NARRATION')[0] ?? '';
  return {
    annotations: [annotations.slice(0, 24000)],
    transcript: text.slice(annotations.length, 48000),
    technical_details: text.slice(48000, 60000),
  };
}
export async function runProoflineAi(
  settings: ProoflineSettings,
  operation: 'summary' | 'session_title' | 'vocabulary' | 'transcription',
  input: RecorderAiInput,
  signal?: AbortSignal,
  requestId: string = crypto.randomUUID(),
): Promise<NonNullable<AiJob['result']>> {
  let submitted = false;
  try {
    submitted = true;
    let job = await prooflineRequest<AiJob>(settings, '/ai', {
      method: 'POST',
      body: JSON.stringify({
        request_id: requestId,
        operation,
        input: input.audio
          ? {
              ...input,
              audio: {
                ...input.audio,
                keyterms: normalizeKeyterms(input.audio.keyterms)
                  .filter((term) => new TextEncoder().encode(term).length <= 50)
                  .slice(0, 20),
              },
            }
          : input,
        ...(operation !== 'transcription' && settings.model.trim()
          ? { model: settings.model.trim() }
          : {}),
      }),
      signal,
    });
    while (job.status === 'queued' || job.status === 'running') {
      await delay(1000, signal);
      job = await prooflineRequest<AiJob>(
        settings,
        `/ai/${encodeURIComponent(job.id)}`,
        { signal },
      );
    }
    if (job.status === 'cancelled') throw new ProoflineAiCancelledError();
    if (job.status === 'failed') throw new ProoflineAiFailedError();
    if (job.status !== 'completed' || !job.result)
      throw new Error(
        'Proofline could not finish this AI request. Check your workspace credits and try again.',
      );
    return job.result;
  } finally {
    if (signal?.aborted && submitted) {
      // Cancelling the local fetch does not cancel the server operation.
      try {
        await prooflineRequest(settings, `/ai/${requestId}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        /* The operation remains retrievable by its id; no duplicate request is sent. */
      }
    }
  }
}
