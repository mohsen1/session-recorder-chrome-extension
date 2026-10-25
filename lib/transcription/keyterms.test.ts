import { it, expect, vi, afterEach } from 'vitest';
import { normalizeKeyterms } from './keyterms';
import { buildDeepgramLiveUrl } from './deepgram-live';
import { elevenLabsLiveUrl, parseElevenLabsMessage } from './elevenlabs-live';
import { ElevenLabsProvider } from './elevenlabs';
import { DeepgramProvider } from './deepgram';
afterEach(() => vi.unstubAllGlobals());
const keyterms = ['Proofline', 'Finishing recipes', 'Proofline', 'a'.repeat(51), 'https://private.test'];
it('bounds and deduplicates dictionaries for provider limits', () => {
  expect(normalizeKeyterms(keyterms)).toEqual(['Proofline', 'Finishing recipes']);
  expect(normalizeKeyterms(['a'.repeat(21)], 20)).toEqual([]);
  expect(normalizeKeyterms(Array.from({length:100}, (_,i)=>`term ${String.fromCharCode(65+i)}`)).join('').length).toBeLessThanOrEqual(400);
});
it('sends repeated Deepgram keyterms only for Nova-3', () => {
  expect(new URL(buildDeepgramLiveUrl({provider:'deepgram',apiKey:'test',keyterms})).searchParams.getAll('keyterm')).toEqual(['Proofline','Finishing recipes']);
  expect(new URL(buildDeepgramLiveUrl({provider:'deepgram',apiKey:'test',keyterms,model:'nova-2'})).searchParams.has('keyterm')).toBe(false);
});
it('uses a single-use ElevenLabs token and provider-specific dictionary limits', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({token:'single-use'})));
  vi.stubGlobal('fetch',fetch);
  const url = new URL(await elevenLabsLiveUrl({provider:'elevenlabs',apiKey:'secret',keyterms}));
  expect(fetch.mock.calls[0]![0].href).toBe('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe');
  expect(url.searchParams.get('token')).toBe('single-use');
  expect(url.href).not.toContain('secret');
  expect(url.searchParams.getAll('keyterms')).toEqual(['Proofline','Finishing recipes']);
  expect(parseElevenLabsMessage('{"message_type":"committed_transcript","text":"Proofline"}',1,2)).toMatchObject({kind:'final',start:1,duration:1,text:'Proofline'});
});
it('passes terms to both batch providers', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({text:'Proofline'})));
  vi.stubGlobal('fetch',fetch);
  await new ElevenLabsProvider().transcribe(new Blob(['audio']),{provider:'elevenlabs',apiKey:'test',keyterms});
  expect(fetch.mock.calls[0]![1].body.getAll('keyterms')).toEqual(['Proofline','Finishing recipes']);
  fetch.mockResolvedValue(new Response('{}'));
  await new DeepgramProvider().transcribe(new Blob(['audio']),{provider:'deepgram',apiKey:'test',keyterms});
  expect(new URL(fetch.mock.calls[1]![0]).searchParams.getAll('keyterm')).toEqual(['Proofline','Finishing recipes']);
});
