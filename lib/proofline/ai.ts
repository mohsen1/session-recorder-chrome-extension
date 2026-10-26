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
  constructor(detail?: string) {
    super(
      detail?.trim() ||
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
/** Budget serialized UTF-8 bytes, matching the server's 64 KB evidence limit. */
function evidenceExcerpt(text: string, byteLimit: number): string {
  const encoder = new TextEncoder();
  const bytes = (value: string) => encoder.encode(JSON.stringify(value)).length;
  if (bytes(text) <= byteLimit) return text;
  const suffix = '\n[...excerpt omitted...]';
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (bytes(text.slice(0, middle) + suffix) <= byteLimit) low = middle;
    else high = middle - 1;
  }
  // Do not split an emoji or another supplementary Unicode character.
  if (low > 0 && /[\uD800-\uDBFF]/.test(text[low - 1]!)) low -= 1;
  return text.slice(0, low) + suffix;
}

export function recordedEvidence(text: string): RecorderAiInput {
  const headings = [
    'NOTES AND NARRATION — reporter context',
    'INTERACTION TIMELINE — reproduction context',
    'BACKGROUND DIAGNOSTICS — include only if related to the reported concern',
  ];
  const sections: string[] = [];
  let start = 0;
  for (const heading of headings) {
    const boundary = text.indexOf(`\n\n${heading}\n\n`, start);
    if (boundary < 0) return { annotations: [evidenceExcerpt(text, 24_000)] };
    sections.push(text.slice(start, boundary));
    start = boundary + 2;
  }
  sections.push(text.slice(start));
  // Separate diagnostics even for short reports, so the server's diagnostic
  // ceiling applies without demoting narration or reproduction steps.
  return {
    annotations: [evidenceExcerpt(sections[0]!, 24_000)],
    transcript: evidenceExcerpt(sections[1]!, 12_000),
    page_text: evidenceExcerpt(sections[2]!, 14_000),
    technical_details: evidenceExcerpt(sections[3]!, 6_000),
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
    if (job.status === 'failed') throw new ProoflineAiFailedError(job.error);
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
