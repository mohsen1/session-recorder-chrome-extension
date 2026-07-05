<p align="center">
  <img src="design/logo-256.png" width="112" height="112" alt="Session Recorder logo" />
</p>

<h1 align="center">Session Recorder</h1>

<p align="center">
  Record a web session. Get an LLM-ready bug report.
</p>

A Chrome extension (Manifest V3) that records a rich, multi-modal session of a
user exercising a web app — **interactions, full network traffic, screenshots,
real-time voice narration, annotations, and files** — and exports a fully local
zip whose `report.md` is optimized for an **LLM coding agent** to digest (bug
reproduction, behavior analysis).

Built with **WXT + React + TypeScript**. Nothing leaves your machine except
optional voice transcription (which you configure and opt into).

- **What & why:** [`PLAN.md`](./PLAN.md)
- **How it's built, phase by phase:** [`IMPLEMENTATION.md`](./IMPLEMENTATION.md)
- **Module interfaces (build contract):** [`docs/internal-api.md`](./docs/internal-api.md)
- **Event payload reference:** [`docs/event-schema.md`](./docs/event-schema.md)
- **Report format & how to prompt an agent with it:** [`docs/report-format.md`](./docs/report-format.md)

## What it captures

| Stream | How |
| --- | --- |
| Network (request/response bodies, headers, timing, websockets) | `chrome.debugger` / CDP `Network` domain |
| Console logs, exceptions, failed requests | CDP `Runtime` / `Log` |
| Clicks, inputs, scrolls, keys | content script (ISOLATED world) |
| Navigations & SPA route changes | `chrome.webNavigation` (fires on `pushState`) |
| Screenshots | CDP `Page.captureScreenshot` — configurable frequency, near-duplicate deduped |
| Voice narration | offscreen `MediaRecorder`, segmented, optional cloud transcription |
| Annotations | in-page shadow-DOM canvas overlay; vector shapes + annotated screenshot |
| Files | intercepted `<input type=file>` / drag-drop, plus manual attach |
| Markers & notes | side-panel buttons + keyboard shortcuts |

Everything flows through **one funnel** in the background service worker and
persists to IndexedDB, so a session survives service-worker restarts and can be
re-exported at any verbosity level afterward.

### Redaction (on by default)

Auth headers (`authorization`, `cookie`, `set-cookie`, …), token-like JSON/form
fields (`/token|secret|password|api[-_]?key|session|auth|…/i`), sensitive URL
params, and password/sensitive input values are masked **at capture time** — raw
secrets never touch disk. Configurable on the options page; per-session override.

### Intelligent trimming (no LLM)

Sessions are captured at full fidelity and trimmed **at export time** into four
deterministic levels, each with a live token estimate:

| Level | Target | Strategy |
| --- | --- | --- |
| **L0 Full** | everything | full bodies, all screenshots |
| **L1 Standard** | ~150k | bodies → 4 KB, static assets collapsed, scrolls coalesced |
| **L2 Compact** | ~50k | bodies → JSON **shape summary**, repeated requests collapsed, screenshots thinned |
| **L3 Minimal** | ~15k | narrative skeleton: interactions as text, non-error bodies dropped |

**Never trimmed at any level:** voice transcript · annotations + their screenshots
· markers/notes · errors (console/exception/4xx-5xx with request context) ·
file metadata. These are the user's explicit signals of what mattered.

## Install (load unpacked)

```bash
pnpm install
pnpm build            # -> .output/chrome-mv3
```

Then in Chrome: **chrome://extensions** → enable **Developer mode** →
**Load unpacked** → select `.output/chrome-mv3`. Click the toolbar icon to open
the side panel and hit **Record**.

> While recording, Chrome shows a **"… is being debugged"** banner. That is
> expected — it is how the extension taps the full network/console streams. If
> the debugger can't attach (DevTools open on the tab, or another debugger is
> present) the session degrades gracefully: interactions, navigation, voice,
> annotations and files are still recorded, and the report notes the gap.

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

The E2E suite ([`e2e/`](./e2e)) drives the actual extension: it loads it into a
persistent Chromium context, starts a recording, interacts with the bundled
[`demo/`](./demo) page, exports through the real side-panel UI (intercepting
`chrome.downloads`), unzips the result, and asserts `report.md` contains the
performed actions and marker — while confirming redaction held (a typed password
never appears anywhere in the output).

## Voice narration & transcription (optional)

Talk over the recording to explain what's happening. With **Deepgram (Nova-3)**
configured, narration is transcribed **in real time** over a streaming websocket:
each utterance becomes its own timeline entry the instant you finish saying it,
stamped at the moment you began speaking — so the report shows narration *"while
clicking 'Checkout'"* rather than one late blob. Other providers
(**OpenAI gpt-4o-transcribe**, **ElevenLabs Scribe v2**) transcribe in
fine-grained batches.

Options page → **Transcription**: pick a provider, base URL, model, and API key
(stored in `chrome.storage.local` only). Model defaults track the current (2026)
recommended models. Without a key, sessions keep the raw audio and note that
segments are untranscribed.

## Using a report with an LLM agent

Unzip the export and hand `report.md` to your coding agent (Claude Code, Cursor,
…). It is a chronological narrative with `[mm:ss]` timestamps joining
interactions, network summaries, console/errors, narration, and annotations, and
is self-sufficient at L2/L3 without opening the asset files. See
[`docs/report-format.md`](./docs/report-format.md) for a suggested prompt.

## Permissions rationale

| Permission | Why |
| --- | --- |
| `debugger` | Full network + console/exception capture via CDP (the "being debugged" banner) |
| `sidePanel` | The recording/export UI |
| `tabs`, `webNavigation` | Multi-tab tracking; navigation & SPA-route events |
| `scripting` | Content-script activation |
| `storage`, `unlimitedStorage` | Persist sessions/events/assets in IndexedDB |
| `offscreen` | `MediaRecorder` for voice (service workers can't use `getUserMedia`) |
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

Video recording · backend upload / shareable links · LLM-powered summarization ·
Firefox/Safari ports · DOM snapshot/replay. See [`PLAN.md`](./PLAN.md) §11.
