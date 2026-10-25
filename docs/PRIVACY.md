# Privacy Policy — Session Recorder

_Last updated: 2026-10-24_

Session Recorder is a Chrome extension that records a session of you using a web
app — interactions, network traffic, console logs, screenshots, voice narration,
annotations, and files — and exports it as a local zip report intended for an LLM
coding agent.

## Summary

- **Recordings stay on your machine by default.** Sessions are stored locally in
  your browser (IndexedDB) and exported as a zip file you save yourself. Session
  Recorder has no developer-operated backend or account system. We do not operate any server
  that receives your recordings.
- **Voice transcription is optional.** If — and only if — you
  configure a transcription provider and API key, the audio you record is sent
  to that third-party provider (Deepgram, OpenAI, or ElevenLabs) to produce a
  text transcript.
- **Publishing and AI summaries are optional.** Publishing sends the selected
  report and its included assets to your Cloudflare account. Generating a summary
  sends a bounded text excerpt to the model provider you configure. Filing a
  GitHub issue sends its title, summary and report link to GitHub.

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

All of this is written to local browser storage. You can export a local ZIP or
explicitly publish the selected report to your Cloudflare Pages project.

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

## Optional annotation dictation

Annotation comments use the recording microphone and your configured transcription
provider. With the mic on, speech fills the active comment; its mic button can
start or stop the recording microphone. Audio remains part of the session's voice
recording. Deepgram and ElevenLabs provide live results; OpenAI uses audio segments.
Typing does not start the microphone.

When an annotation is selected and an AI model is configured, a bounded excerpt
of visible headings, navigation and interface labels is sent to that model to
identify unusual vocabulary. Input values, editable fields and hidden content are
excluded. The resulting short dictionary is sent to Deepgram or ElevenLabs to
improve recognition. Page context and dictionaries are kept in memory, not saved
with credentials or published as an additional attachment. Provider fees apply;
ElevenLabs charges extra for keyterm prompting. If extraction fails, ordinary
transcription remains available.

## Optional report publishing and summaries

Cloudflare publishing uploads the report, session data, transcripts and included
screenshots, recordings and files directly to your Cloudflare account. Cloudflare
Access controls who can sign in. You configure the reader policy. A deployed
Function also validates Access tokens before serving report files. Reports remain
hosted until you delete their deployments; deleting a local session does not
unpublish it. Use Unpublish report or your Cloudflare dashboard to delete it.

AI summaries send up to 60,000 characters of text evidence to OpenAI, Anthropic,
Google or the OpenAI-compatible endpoint you select, when you choose
File GitHub issue with a configured model or Regenerate summary. With a configured model, stopping a recording also sends this bounded text evidence to generate its session-list title automatically. No media bytes are sent for summarization or naming. The text may still
contain sensitive data; review it before sending. Provider terms and retention
policies apply. Review generated summaries before sharing them.

GitHub receives the title, summary and protected page link when you choose File GitHub issue. The extension creates the issue with your configured GitHub token. The summary follows the repository’s visibility; Access protects the hosted report, not the issue text. Drafts, deployment references, created issues and recovery markers are saved locally. Copy issue Markdown writes the text to your clipboard only when you choose it.

API credentials stay in extension storage and are sent only to their configured
service. They are not included in report bundles or deployed pages. Screenshots,
voice and arbitrary attachments are not automatically scrubbed of all sensitive
information. Review them before publishing.

## Data we collect

**None.** Session Recorder has no analytics, no telemetry, no ads, and no developer-operated backend.
The developer does not receive any of your recordings, transcripts, keys, or
usage data.

## Data sharing and sale

We do not sell, share, or transfer any user data, because we never receive any.

## Contact

Questions: open an issue at https://github.com/mohsen1/session-recorder-chrome-extension/issues
