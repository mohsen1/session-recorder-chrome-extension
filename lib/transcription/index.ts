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

export const PROVIDERS: {
  id: TranscriptionConfig['provider'];
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
}[] = [
  {
    id: 'openai',
    label: 'OpenAI (Whisper)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'whisper-1',
  },
  {
    id: 'deepgram',
    label: 'Deepgram',
    defaultBaseUrl: 'https://api.deepgram.com/v1/listen',
    defaultModel: 'nova-2',
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs (Scribe)',
    defaultBaseUrl: 'https://api.elevenlabs.io/v1/speech-to-text',
    defaultModel: 'scribe_v1',
  },
];
