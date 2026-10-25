import { loadProoflineSettings } from '@/lib/proofline/settings';
import { runProoflineAi } from '@/lib/proofline/ai';
import { OFFSCREEN_MARKER } from '@/lib/messaging';
/**
 * Transcription provider registry and dispatch.
 *
 * Resolves a `TranscriptionConfig.provider` id to a concrete implementation and
 * exposes the `PROVIDERS` metadata table consumed by the options UI.
 */

import { DeepgramProvider } from './deepgram';
import { ElevenLabsProvider } from './elevenlabs';
import { OpenAiCompatibleProvider } from './openai-compatible';
import type {
  TranscriptionConfig,
  TranscriptionProvider,
  TranscriptionResult,
} from './provider';

export type {
  TranscriptionConfig,
  TranscriptionProvider,
  TranscriptionResult,
} from './provider';

const openai = new OpenAiCompatibleProvider();
const deepgram = new DeepgramProvider();
const elevenlabs = new ElevenLabsProvider();

export function getProvider(
  name: TranscriptionConfig['provider'],
): TranscriptionProvider {
  switch (name) {
    case 'openai':
      return openai;
    case 'deepgram':
      return deepgram;
    case 'elevenlabs':
      return elevenlabs;
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown transcription provider: ${String(exhaustive)}`);
    }
  }
}

export async function transcribe(
  audio: Blob,
  config: TranscriptionConfig,
): Promise<TranscriptionResult> {
  const settings = await loadProoflineSettings();
  if (settings.aiMode === 'proofline' || config.managed) {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const decoded = (await chrome.runtime.sendMessage({
      kind: 'audio/decode-pcm',
      [OFFSCREEN_MARKER]: true,
      dataUrl: `data:${audio.type || 'audio/webm'};base64,${btoa(binary)}`,
    })) as { pcmBase64?: string; error?: string };
    if (!decoded?.pcmBase64)
      throw new Error(decoded?.error || 'Recorded audio could not be decoded.');
    const result = await runProoflineAi(
      settings,
      'transcription',
      {
        audio: {
          pcm_base64: decoded.pcmBase64,
          sample_rate: 16000,
          provider: config.provider === 'elevenlabs' ? 'elevenlabs' : 'deepgram',
          keyterms: config.keyterms,
          language: config.language,
        },
      },
      AbortSignal.timeout(120000),
      config.requestId,
    );
    if (typeof result.text !== 'string')
      throw new Error('Proofline returned no transcript.');
    return {
      text: result.text,
      words: result.words?.map((word) => ({ word: word.word, t: word.start })),
    };
  }
  return getProvider(config.provider).transcribe(audio, config);
}

export interface ProviderMeta {
  id: TranscriptionConfig['provider'];
  label: string;
  defaultBaseUrl: string;
  /** Latest batch/transcription model (as of 2026). */
  defaultModel: string;
  /** True when the provider offers real-time streaming (used by default). */
  streaming: boolean;
  /** Live websocket base URL + model, when streaming is supported. */
  streamUrl?: string;
  streamModel?: string;
}

// Model defaults track the current (2026) recommended models:
//  - Deepgram: nova-3 (streaming ws, interim+final, word timings) — best real-time.
//  - OpenAI:   gpt-4o-transcribe (whisper-1 is retiring ~2026-06).
//  - ElevenLabs: scribe_v2 (+ scribe_v2_realtime streaming).
export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'deepgram',
    label: 'Deepgram (Nova-3)',
    defaultBaseUrl: 'https://api.deepgram.com/v1/listen',
    defaultModel: 'nova-3',
    streaming: true,
    streamUrl: 'wss://api.deepgram.com/v1/listen',
    streamModel: 'nova-3',
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs (Scribe v2)',
    defaultBaseUrl: 'https://api.elevenlabs.io/v1/speech-to-text',
    defaultModel: 'scribe_v2',
    streaming: true,
    streamUrl: 'wss://api.elevenlabs.io/v1/speech-to-text/realtime',
    streamModel: 'scribe_v2_realtime',
  },
  {
    id: 'openai',
    label: 'OpenAI (gpt-4o-transcribe)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-transcribe',
    streaming: false,
  },
];

export function providerMeta(
  id: TranscriptionConfig['provider'],
): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
