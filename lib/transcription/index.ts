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
    // Scribe v2 Realtime exists, but only Deepgram's live path is wired here;
    // ElevenLabs uses fine-grained batch segments (still near-real-time).
    id: 'elevenlabs',
    label: 'ElevenLabs (Scribe v2)',
    defaultBaseUrl: 'https://api.elevenlabs.io/v1/speech-to-text',
    defaultModel: 'scribe_v2',
    streaming: false,
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
