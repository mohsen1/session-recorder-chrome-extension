/**
 * ElevenLabs speech-to-text provider.
 *
 * POSTs the audio as multipart/form-data to the ElevenLabs `/speech-to-text`
 * endpoint (Scribe models) and maps the returned text + word timings into the
 * shared `TranscriptionResult`.
 */

import type {
  TranscriptionConfig,
  TranscriptionProvider,
  TranscriptionResult,
} from './provider';

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const DEFAULT_MODEL = 'scribe_v1';

interface ElevenLabsWord {
  word?: unknown;
  text?: unknown;
  start?: unknown;
}

interface ElevenLabsResponse {
  text?: unknown;
  words?: unknown;
}

export class ElevenLabsProvider implements TranscriptionProvider {
  async transcribe(
    audio: Blob,
    config: TranscriptionConfig,
  ): Promise<TranscriptionResult> {
    const url = config.baseUrl || DEFAULT_BASE_URL;

    const form = new FormData();
    form.append('model_id', config.model || DEFAULT_MODEL);
    form.append('file', audio, 'audio.webm');
    if (config.language) form.append('language_code', config.language);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': config.apiKey },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`elevenlabs STT failed: ${res.status} ${body}`);
    }

    const json = (await res.json()) as ElevenLabsResponse;
    const text = typeof json.text === 'string' ? json.text : '';

    let words: { word: string; t: number }[] | undefined;
    if (Array.isArray(json.words)) {
      const mapped: { word: string; t: number }[] = [];
      for (const raw of json.words as ElevenLabsWord[]) {
        if (!raw) continue;
        const w =
          typeof raw.word === 'string'
            ? raw.word
            : typeof raw.text === 'string'
              ? raw.text
              : undefined;
        if (w === undefined) continue;
        const t = typeof raw.start === 'number' ? raw.start : 0;
        mapped.push({ word: w, t });
      }
      if (mapped.length > 0) words = mapped;
    }

    return words ? { text, words } : { text };
  }
}
