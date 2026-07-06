# Privacy Policy — Session Recorder

_Last updated: 2026-07-06_

Session Recorder is a Chrome extension that records a session of you using a web
app — interactions, network traffic, console logs, screenshots, voice narration,
annotations, and files — and exports it as a local zip report intended for an LLM
coding agent.

## Summary

- **Everything you record stays on your machine.** Sessions are stored locally in
  your browser (IndexedDB) and exported as a zip file you save yourself. Session
  Recorder has no backend and no account system. We do not operate any server
  that receives your recordings.
- **The one exception is optional voice transcription.** If — and only if — you
  configure a transcription provider and API key, the audio you record is sent
  to that third-party provider (Deepgram, OpenAI, or ElevenLabs) to produce a
  text transcript. Without a key, audio is never transmitted; it stays in the
  local recording.

## What the extension accesses

To record a session, the extension captures, on the tabs you are actively
recording:

- Network requests and responses (via `chrome.debugger` / CDP), including bodies
  and headers
- Console logs, exceptions, and failed requests
- Clicks, inputs, scrolls, keystrokes, and page navigations
- Screenshots of the recorded tab
- Microphone audio, when you start voice narration
- Files you upload to the app or attach yourself

All of this is written to local browser storage and is only ever assembled into a
zip file that you explicitly export and save to your own device.

## Redaction

Redaction is on by default. Before anything is written to storage, the extension
masks authorization headers, token-like JSON/form fields, sensitive URL
parameters, and password inputs. You can add rules or disable redaction per
session on the options page.

## Third-party transcription (optional, off by default)

If you enter an API key on the options page, recorded audio is streamed or
uploaded to the provider you selected in order to transcribe it:

- **Deepgram** — https://deepgram.com/privacy
- **OpenAI** — https://openai.com/policies/privacy-policy
- **ElevenLabs** — https://elevenlabs.io/privacy

Your API key is stored locally in `chrome.storage.local` and is sent only to that
provider. We do not receive, proxy, or store your key or your audio. Your use of
a provider is governed by that provider's privacy policy and terms.

## Data we collect

**None.** Session Recorder has no analytics, no telemetry, no ads, and no backend.
The developer does not receive any of your recordings, transcripts, keys, or
usage data.

## Data sharing and sale

We do not sell, share, or transfer any user data, because we never receive any.

## Contact

Questions: contact@users.noreply.github.com
