<p align="center">
  <img src="design/logo-256.png" width="112" height="112" alt="Session Recorder logo" />
</p>

<h1 align="center">Session Recorder Browser Extension</h1>


<p align="center">
  Record a web session. Get an LLM-ready bug report.
</p>

This Chrome extension (Manifest V3) records a full session of someone using a
web app: interactions, network traffic, screenshots, real-time voice narration,
annotations, and files. It exports a zip that stays on your machine. The zip's
`report.md` is written for an LLM coding agent, so the agent can reproduce bugs
and analyze behavior.

## What it captures

- network: request and response bodies, headers, timing, and websockets, through `chrome.debugger` (CDP)
- console logs, exceptions, and failed requests
- clicks, inputs, scrolls, and keys, through a content script
- navigations and SPA route changes, through `chrome.webNavigation`
- screenshots at a configurable frequency, with near-duplicates deduped
- voice narration through an offscreen `MediaRecorder`, with optional cloud transcription
- annotations drawn on the page, saved as vector shapes plus a screenshot
- files uploaded to the app, plus files you attach yourself
- markers and notes from side-panel buttons and keyboard shortcuts

Every event flows through one funnel in the background service worker and
persists to IndexedDB. A session survives service-worker restarts, and you can
re-export it at any verbosity level later.

### Redaction (on by default)

The extension masks auth headers, token-like JSON and form fields, sensitive URL
params, and password inputs at capture time. Raw secrets never touch disk. You
can add rules or turn redaction off per session on the options page.

### Deterministic trimming (no LLM)

Sessions are captured at full fidelity and trimmed at export into 4 levels, each
with a live token estimate:

- L0 Full: everything
- L1 Standard (about 150k tokens): bodies cut to 4 KB, static assets and analytics collapsed
- L2 Compact (about 50k tokens): bodies reduced to a JSON shape summary, repeated requests collapsed
- L3 Minimal (about 15k tokens): a narrative skeleton

No level ever trims your explicit signals: the voice transcript, annotations,
markers, notes, errors, and file metadata.

## Install (load unpacked)

```bash
pnpm install
pnpm build            # -> .output/chrome-mv3
```

In Chrome, open `chrome://extensions`, enable Developer mode, click Load
unpacked, and select `.output/chrome-mv3`. Click the toolbar icon to open the
side panel, then click Record.

> While recording, Chrome shows a "... is being debugged" banner. That is how
> the extension taps the network and console streams. If the debugger cannot
> attach, the session still records interactions, navigation, voice,
> annotations, and files, and the report notes the gap.

## Develop and test

```bash
pnpm dev              # WXT dev server with HMR
pnpm compile          # typecheck
pnpm test             # unit and integration tests (vitest)
pnpm test:e2e         # Playwright end-to-end (add :headed for a visible browser)
```

The end-to-end suite in [`e2e/`](./e2e) loads the built extension into
Chromium, records a session against the bundled [`demo/`](./demo) page, exports
through the real side-panel UI, and checks the zip: the report contains the
actions and marker, and a typed password appears nowhere in the output.

## Voice narration and transcription (optional)

Talk while you record to explain what's happening. With Deepgram (Nova-3)
configured, the extension transcribes in real time over a streaming websocket.
Each utterance lands on the timeline stamped at the moment you began speaking,
so the report reads: narration "while clicking 'Checkout'". OpenAI
(gpt-4o-transcribe) and ElevenLabs (Scribe v2) transcribe in batches instead.

Set the provider, model, and API key on the options page. The key stays in
`chrome.storage.local`. Without a key, sessions keep the raw audio.

## Using a report with an LLM agent

Unzip the export and give `report.md` to your coding agent. It is a
chronological narrative with `[mm:ss]` timestamps joining interactions, network
summaries, errors, narration, and annotations. At L2 and L3 it stands alone
without the asset files. See [`docs/report-format.md`](./docs/report-format.md)
for a suggested prompt.

## Why we need each permission

- `debugger`: network, console, and exception capture through CDP
- `sidePanel`: the recording and export UI
- `tabs` and `webNavigation`: multi-tab tracking and navigation events
- `scripting`: content-script activation
- `storage` and `unlimitedStorage`: sessions live in IndexedDB
- `offscreen`: `MediaRecorder` for voice
- `downloads`: save the exported zip
- `alarms`: flush the event buffer while recording
- `<all_urls>`: record whatever app you point it at

## Project layout

```
entrypoints/         background (orchestrator), 3 content scripts,
                     sidepanel + options (React), offscreen + mic-permission
lib/session/         frozen contract: types, event registry, settings, messaging
lib/capture/         debugger, network, console, screenshots, multitab, redaction
lib/export/          trimmer, markdown renderer, shape-summary, tokens, zip, bundle
lib/transcription/   provider interface + OpenAI-compatible / Deepgram / ElevenLabs
lib/storage/         IndexedDB layer + batched event writer
e2e/                 Playwright end-to-end suite
demo/                local test page that exercises every capture path
```

## Not in v1

Video recording, backend upload and shareable links, LLM-powered summarization,
Firefox and Safari ports, and DOM snapshot replay. See [`PLAN.md`](./PLAN.md)
§11.
