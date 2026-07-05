<p align="center">
  <img src="design/logo-256.png" width="112" height="112" alt="Session Recorder logo" />
</p>

<h1 align="center">Session Recorder Browser Extension</h1>


<p align="center">
  Record a web session. Get an LLM-ready bug report.
</p>

This Chrome extension (Manifest V3) records a web session of someone using a web
app — interactions, full network traffic, screenshots, real-time voice
narration, annotations, and files — and exports a zip that stays on your
machine. The zip's `report.md` is written for an LLM coding agent to read, so
the agent can reproduce bugs and analyze behavior.

We built it with WXT, React, and TypeScript. Nothing leaves your machine except
optional voice transcription, which you configure and opt into.

- what the extension does and why: [`PLAN.md`](./PLAN.md)
- how it's built, phase by phase: [`IMPLEMENTATION.md`](./IMPLEMENTATION.md)
- module interfaces, the build contract: [`docs/internal-api.md`](./docs/internal-api.md)
- event payload reference: [`docs/event-schema.md`](./docs/event-schema.md)
- report format and how to prompt an agent with it: [`docs/report-format.md`](./docs/report-format.md)

## What it captures

| Stream | How |
| --- | --- |
| Network (request and response bodies, headers, timing, websockets) | `chrome.debugger` / CDP `Network` domain |
| Console logs, exceptions, failed requests | CDP `Runtime` / `Log` |
| Clicks, inputs, scrolls, keys | content script (ISOLATED world) |
| Navigations and SPA route changes | `chrome.webNavigation` (fires on `pushState`) |
| Screenshots | CDP `Page.captureScreenshot` — configurable frequency, near-duplicate deduped |
| Voice narration | offscreen `MediaRecorder`, segmented, optional cloud transcription |
| Annotations | in-page shadow-DOM canvas overlay; vector shapes plus annotated screenshot |
| Files | intercepted `<input type=file>` / drag-drop, plus manual attach |
| Markers and notes | side-panel buttons plus keyboard shortcuts |

Everything flows through one funnel in the background service worker and
persists to IndexedDB. So a session survives service-worker restarts, and you
can re-export it at any verbosity level afterward.

### Redaction (on by default)

The extension masks auth headers (`authorization`, `cookie`, `set-cookie`, and
more), token-like JSON or form fields
(`/token|secret|password|api[-_]?key|session|auth|…/i`), sensitive URL params,
and password or sensitive input values at capture time. Raw secrets never touch
disk. You configure this on the options page, and you can override it per
session.

### Deterministic trimming (no LLM)

The extension captures sessions at full fidelity and trims them at export time
into 4 deterministic levels. Each level shows a live token estimate.

| Level | Target | Strategy |
| --- | --- | --- |
| L0 Full | everything | full bodies, all screenshots |
| L1 Standard | ~150k | bodies → 4 KB, static assets collapsed, scrolls coalesced |
| L2 Compact | ~50k | bodies → JSON shape summary, repeated requests collapsed, screenshots thinned |
| L3 Minimal | ~15k | narrative skeleton: interactions as text, non-error bodies dropped |

The extension never trims these at any level: voice transcript, annotations and
their screenshots, markers and notes, errors (console, exception, 4xx-5xx with
request context), and file metadata. These are the signals you gave about what
mattered.

## Install (load unpacked)

```bash
pnpm install
pnpm build            # -> .output/chrome-mv3
```

Then in Chrome, open `chrome://extensions`, enable Developer mode, click
Load unpacked, and select `.output/chrome-mv3`. Click the toolbar icon to open
the side panel, then click Record.

> While recording, Chrome shows a "… is being debugged" banner. This is
> expected: it is how the extension taps the full network and console streams.
> If the debugger cannot attach (DevTools are open on the tab, or another
> debugger is present), the session degrades gracefully. The extension still
> records interactions, navigation, voice, annotations, and files, and the
> report notes the gap.

## Develop

```bash
pnpm dev              # WXT dev server with HMR
pnpm compile          # typecheck the extension
pnpm test             # unit + integration (vitest)
```

## Test

```bash
pnpm test             # 100+ unit/integration tests (pure logic: trimmer,
                      # redaction, markdown, shape-summary, storage, export pipeline)
pnpm test:e2e         # end-to-end: builds the extension, loads it into Chromium
                      # via Playwright, records a real session against demo/, and
                      # validates the exported zip's report.md
pnpm test:e2e:headed  # same, with a visible browser window
```

The E2E suite ([`e2e/`](./e2e)) drives the actual extension. It loads the
extension into a persistent Chromium context, starts a recording, interacts with
the bundled [`demo/`](./demo) page, and exports through the real side-panel UI
(intercepting `chrome.downloads`). It then unzips the result and asserts that
`report.md` contains the actions and marker you performed, while confirming
redaction held: a typed password never appears anywhere in the output.

## Voice narration and transcription (optional)

Talk over the recording to explain what's happening. With Deepgram (Nova-3)
configured, the extension transcribes narration in real time over a streaming
websocket. Each utterance becomes its own timeline entry the moment you finish
saying it, stamped at the moment you began speaking. So the report shows
narration "while clicking 'Checkout'" rather than one late blob. Other providers
(OpenAI gpt-4o-transcribe, ElevenLabs Scribe v2) transcribe in fine-grained
batches.

On the options page, open Transcription and pick a provider, base URL, model,
and API key. The extension stores the key in `chrome.storage.local` only. Model
defaults track the current (2026) recommended models. Without a key, sessions
keep the raw audio and note that segments are untranscribed.

## Using a report with an LLM agent

Unzip the export and give `report.md` to your coding agent (Claude Code, Cursor,
and others). It is a chronological narrative with `[mm:ss]` timestamps that join
interactions, network summaries, console and errors, narration, and
annotations. It is self-sufficient at L2 and L3 without opening the asset files.
See [`docs/report-format.md`](./docs/report-format.md) for a suggested prompt.

## Why we need each permission

| Permission | Why |
| --- | --- |
| `debugger` | Full network plus console and exception capture via CDP (the "being debugged" banner) |
| `sidePanel` | The recording and export UI |
| `tabs`, `webNavigation` | Multi-tab tracking; navigation and SPA-route events |
| `scripting` | Content-script activation |
| `storage`, `unlimitedStorage` | Persist sessions, events, and assets in IndexedDB |
| `offscreen` | `MediaRecorder` for voice (service workers cannot use `getUserMedia`) |
| `downloads` | Save the exported zip |
| `alarms` | Heartbeat that flushes the event buffer while recording |
| `<all_urls>` | The recorder must work on whatever SaaS app you point it at |

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

These are out of scope for v1: video recording, backend upload or shareable
links, LLM-powered summarization, Firefox and Safari ports, and DOM snapshot or
replay. See [`PLAN.md`](./PLAN.md) §11.
