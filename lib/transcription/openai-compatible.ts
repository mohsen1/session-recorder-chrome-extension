/**
 * OpenAI-compatible speech-to-text provider.
 *
 * POSTs the audio as multipart/form-data to `${baseUrl}/audio/transcriptions`
 * (Whisper-style API) and parses the `verbose_json` response, including
 * per-word / per-segment timings when the server returns them.
 */

import type {
  TranscriptionConfig,
  TranscriptionProvider,
  TranscriptionResult,
} from './provider';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'whisper-1';

interface OpenAiWord {
  word?: unknown;
  start?: unknown;
}

interface OpenAiSegment {
  text?: unknown;
  start?: unknown;
}

interface OpenAiResponse {
  text?: unknown;
  words?: unknown;
  segments?: unknown;
}

export class OpenAiCompatibleProvider implements TranscriptionProvider {
  async transcribe(
    audio: Blob,
    config: TranscriptionConfig,
  ): Promise<TranscriptionResult> {
    const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}/audio/transcriptions`;

    const form = new FormData();
    form.append('file', audio, 'audio.webm');
    form.append('model', config.model || DEFAULT_MODEL);
    form.append('response_format', 'verbose_json');
    if (config.language) form.append('language', config.language);

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`openai STT failed: ${res.status} ${body}`);
    }

    const json = (await res.json()) as OpenAiResponse;
    const text = typeof json.text === 'string' ? json.text : '';

    const words = parseWords(json);
    return words ? { text, words } : { text };
  }
}

function parseWords(json: OpenAiResponse): { word: string; t: number }[] | undefined {
  const out: { word: string; t: number }[] = [];

  if (Array.isArray(json.words)) {
    for (const raw of json.words as OpenAiWord[]) {
      if (!raw || typeof raw.word !== 'string') continue;
      const t = typeof raw.start === 'number' ? raw.start : 0;
      out.push({ word: raw.word, t });
    }
  } else if (Array.isArray(json.segments)) {
    for (const raw of json.segments as OpenAiSegment[]) {
      if (!raw || typeof raw.text !== 'string') continue;
      const t = typeof raw.start === 'number' ? raw.start : 0;
      out.push({ word: raw.text, t });
    }
  }

  return out.length > 0 ? out : undefined;
}
