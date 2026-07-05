/**
 * Speech-to-text provider abstraction.
 *
 * Defines the common shape every transcription backend implements so the rest
 * of the extension can transcribe a voice segment without caring which vendor
 * (OpenAI-compatible, Deepgram, ElevenLabs) is configured.
 */

export interface TranscriptionResult {
  text: string;
  words?: { word: string; t: number }[];
}

export interface TranscriptionConfig {
  provider: 'openai' | 'deepgram' | 'elevenlabs';
  baseUrl?: string;
  model?: string;
  apiKey: string;
  language?: string;
}

export interface TranscriptionProvider {
  transcribe(audio: Blob, config: TranscriptionConfig): Promise<TranscriptionResult>;
}
