import type { TranscriptionConfig } from './provider';
import { normalizeKeyterms } from './keyterms';
import type { ParsedTranscript } from './deepgram-live';

export async function elevenLabsLiveUrl(config: TranscriptionConfig): Promise<string> {
  // Keep long-lived API keys in the extension; the socket receives a single-use token.
  const base = new URL(config.baseUrl || 'https://api.elevenlabs.io/v1/speech-to-text');
  if (base.protocol !== 'https:') throw new Error('ElevenLabs requires HTTPS.');
  const result = await fetch(new URL('/v1/single-use-token/realtime_scribe', base), {
    method: 'POST', headers: { 'xi-api-key': config.apiKey }, signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error(`ElevenLabs dictation authorization failed (${result.status}).`);
  const data = await result.json() as { token?: unknown };
  if (typeof data.token !== 'string') throw new Error('ElevenLabs did not return a dictation token.');
  const url = new URL('/v1/speech-to-text/realtime', base);
  url.protocol = 'wss:';
  url.search = new URLSearchParams({ model_id: 'scribe_v2_realtime', token: data.token, audio_format: 'pcm_16000', commit_strategy: 'vad', vad_silence_threshold_secs: '0.7' }).toString();
  if (config.language) url.searchParams.set('language_code', config.language);
  for (const term of normalizeKeyterms(config.keyterms, 20)) url.searchParams.append('keyterms', term);
  return url.href;
}
export function elevenLabsAudioMessage(pcm: ArrayBuffer, commit = false): string {
  const bytes = new Uint8Array(pcm);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: btoa(binary), sample_rate: 16000, commit });
}
export function parseElevenLabsMessage(raw: string, start: number, now: number): ParsedTranscript {
  const empty: ParsedTranscript = { kind: 'other', text: '', start, duration: 0, words: [] };
  let data: { message_type?: string; text?: string };
  try { data = JSON.parse(raw); } catch { return empty; }
  if (!['partial_transcript', 'committed_transcript'].includes(data?.message_type ?? '') || typeof data.text !== 'string' || !data.text.trim()) return empty;
  return { ...empty, kind: data.message_type === 'partial_transcript' ? 'interim' : 'final', text: data.text.trim(), duration: Math.max(0, now - start) };
}
