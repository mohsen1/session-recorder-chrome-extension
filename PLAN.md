# Plan: Session Recorder Chrome Extension

A Chrome extension that records a rich, multi-modal session of a user exercising a web app — interactions, full network traffic, screenshots, voice narration, annotations, and files — and exports a fully local zip whose report is optimized for an LLM coding agent to digest (bug reproduction, behavior analysis).

## 1. Decisions from requirements interview

| Topic | Decision |
|---|---|
| Primary consumer | LLM coding agent (Claude Code, Cursor, etc.) — output optimized for token-efficient, structured machine reading |
| Output destination | Local zip download; no backend |
| Voice narration | Recorded audio + cloud transcription; **pluggable providers** (OpenAI-compatible endpoint, Deepgram, ElevenLabs Scribe) |
| Network capture | Full fidelity via `chrome.debugger` (request/response bodies, headers, timing, websockets); the "tab is being debugged" banner is accepted |
| Screenshots | User-configurable knob: *every interaction* / *key moments* / *on-demand only* |
| Session scope | Multi-tab — recording follows the user across tabs (popups, OAuth flows, new tabs opened by the app) |
| Privacy | Redact by default (auth headers, cookies, token-like fields, password inputs); per-session toggle + custom rules |
| Report format | `report.md` (chronological LLM-first narrative) + `session.json` sidecar + asset files |
| Trimming | At export time — capture at full fidelity, choose verbosity level (with token estimate) when exporting; re-exportable at any level |
| Tech stack | WXT + React + TypeScript, Manifest V3 |

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Side Panel (React)                                              │
│  record / stop / pause · mic toggle · annotate toggle           │
│  attach file · add marker/note · live event ticker              │
│  export panel (verbosity level + token estimate → zip)          │
└──────────────┬──────────────────────────────────────────────────┘
               │ chrome.runtime messaging
┌──────────────▼──────────────────────────────────────────────────┐
│ Background service worker — Session Orchestrator                │
│  · session lifecycle & state machine                            │
│  · chrome.debugger attach/detach per recorded tab               │
│  · multi-tab tracker (tabs.onCreated w/ openerTabId)            │
│  · event bus → IndexedDB writer (batched)                       │
│  · screenshot scheduler (per capture knob)                      │
└───────┬───────────────────────┬─────────────────────────────────┘
        │                       │
┌───────▼─────────────┐  ┌──────▼───────────────────────────────┐
│ Content scripts     │  │ Offscreen document                   │
│ (all frames)        │  │  · MediaRecorder (mic audio)         │
│ · interaction       │  │  · zip assembly (fflate)             │
│   capture           │  └──────────────────────────────────────┘
│ · SPA route hook    │
│ · file-upload       │  ┌──────────────────────────────────────┐
│   interception      │  │ IndexedDB (idb)                      │
│ · annotation        │  │  sessions · events · blobs (assets)  │
│   overlay (canvas)  │  └──────────────────────────────────────┘
└─────────────────────┘
```

### Module layout (WXT conventions)

```
entrypoints/
  background.ts          # session orchestrator
  sidepanel/             # React app: recording UI + export UI
  options/               # React app: settings (STT providers, redaction, knobs)
  offscreen/             # audio recording + zip assembly
  content/
    interactions.ts      # clicks, scrolls, inputs, keys, SPA routes
    annotations.ts       # canvas overlay + floating toolbar
    file-capture.ts      # <input type=file> + drag-drop interception
    mic-permission/      # one-time page to grant getUserMedia to extension origin
lib/
  session/               # data model, event types, state machine
  capture/
    debugger.ts          # CDP domains: Network, Page, Runtime, Log
    screenshots.ts       # Page.captureScreenshot scheduling + dedupe
    redaction.ts         # header/body/input masking rules
  transcription/
    provider.ts          # interface
    openai-compatible.ts # configurable baseURL/model/key (default: OpenAI Whisper)
    deepgram.ts
    elevenlabs.ts
  export/
    trimmer.ts           # verbosity levels, importance scoring
    markdown.ts          # report.md renderer
    tokens.ts            # token estimator (~chars/4)
    zip.ts
  storage/               # IndexedDB access layer
```

## 3. Capture subsystems

### 3.1 Network + console (chrome.debugger / CDP)

- On session start, attach debugger to the active tab; enable `Network`, `Page`, `Runtime`, `Log` domains.
- Capture per request: method, URL, request headers/body, response status, headers, body (`Network.getResponseBody`, fetched on `loadingFinished`), timing, initiator, resource type. Websocket frames via `Network.webSocketFrame*`.
- Console logs, uncaught exceptions, and failed requests via `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Log.entryAdded` — errors are gold for an LLM debugging agent.
- Body size cap at capture (configurable, default 256 KB/body; larger bodies stored truncated with original size noted).
- **Multi-tab:** when a recorded tab opens another (`tabs.onCreated` with `openerTabId` in the session's tab set) or navigates via `window.open`, auto-attach the debugger and inject content scripts there too. Every event is tagged with `tabId`; the report renders tab switches as explicit timeline entries. Detach on tab close; session continues on remaining tabs.
- Known constraint: debugger cannot attach while DevTools is open on that tab → detect and show a clear error in the side panel.

### 3.2 Interactions (content script, all frames)

- **Clicks:** element descriptor (best-effort selector, tag, role/aria-label, visible text ≤80 chars, bounding box), modifier keys.
- **Inputs:** debounced per field; value recorded except password fields (always `«redacted»`) and fields matching redaction rules; record field label/name so the LLM knows *what* was typed even when *value* is masked.
- **Scrolls:** debounced/coalesced (start→end position, container).
- **Keys:** significant keys only (Enter, Escape, Tab, shortcuts) — not full keylogging.
- **Navigation:** full page loads via CDP `Page.frameNavigated`; SPA routes by patching `history.pushState/replaceState` + `popstate`; record URL + document title.

### 3.3 Screenshots

- Captured via CDP `Page.captureScreenshot` (works per attached tab even when unfocused — needed for multi-tab; avoids `captureVisibleTab` rate limits).
- Capture-knob policies (per-session setting, changeable in options):
  1. **Every interaction** — after each click/nav/significant scroll, debounced ≥500 ms.
  2. **Key moments** — navigations, errors (console error or 4xx/5xx), annotation-mode exit, on-demand button.
  3. **On-demand** — button + annotation exits only.
- Near-duplicate suppression: cheap perceptual hash; identical consecutive frames stored once with a repeat count.
- Stored as JPEG (quality ~80) to keep zips sane.

### 3.4 Annotation mode

- Toggled from the side panel or a keyboard shortcut; injects a full-viewport canvas overlay + floating toolbar into the page.
- Tools: pen (freehand), arrow, rectangle, ellipse/circle, text label, highlighter, blur/redact box; color picker, stroke width, undo/redo, clear.
- Page interaction is frozen while annotating (overlay swallows events).
- On exit: screenshot captured **with** the drawings, plus the annotation vector data saved as JSON (shape types, coordinates, text) so the LLM gets a textual description ("user circled the Submit button region") alongside the image.

### 3.5 Voice narration

- Mic toggle in the side panel. MV3 service workers can't use `getUserMedia`, so audio records in an **offscreen document**; first use routes through a one-time mic-permission page for the extension origin.
- `MediaRecorder` → webm/opus chunks; segmented every ~30 s and at pause boundaries so timestamps map to the event timeline.
- On stop (or progressively during recording), segments are sent to the configured STT provider. Provider abstraction: `transcribe(blob, opts) → {text, words?[]}` with three implementations (OpenAI-compatible, Deepgram, ElevenLabs); keys stored in `chrome.storage.local`, entered on the options page; provider + model selectable.
- Output: timestamped transcript segments interleaved into the timeline **and** the raw audio files in the zip. If no key is configured, audio-only with a warning.

### 3.6 Files

- **Auto-capture:** content script listens for `change` on `input[type=file]` and drag-drop events; copies file contents (cap: 25 MB/file, configurable) into the session with context ("uploaded to *Import CSV* dialog"). Oversized files recorded as metadata only.
- **Manual attach:** side panel button to add any file/image to the session, with an optional note.

### 3.7 Markers & notes

- "Add marker" button (+ shortcut) drops a named bookmark; text notes can be typed in the side panel mid-session. Cheap, high-signal anchors for the report ("BUG HAPPENS HERE").

## 4. Data model

```ts
Session { id, startedAt, endedAt, initialUrl, tabs: TabInfo[],
          settingsSnapshot, status }

Event  { id, sessionId, t /* ms from start */, tabId, type, payload }
// types: click | input | scroll | key | nav | spa-route |
//        net-request | console | error | screenshot | annotation |
//        voice-segment | file-captured | file-attached | marker | note | tab-switch

Asset  { id, sessionId, kind: screenshot|audio|file|net-body,
         mime, bytes(Blob), sha256, size }
```

Events reference assets by id. Everything persists to IndexedDB during recording (batched writes every ~1 s) so a crash loses at most the last second. Full-fidelity sessions stay in IndexedDB until deleted — that's what makes re-export at different verbosity levels possible.

## 5. Export engine — deterministic trimming, no LLM

### Verbosity levels

| Level | Target | Strategy |
|---|---|---|
| **L0 Full** | everything captured | bodies complete (up to capture cap), all screenshots, all events |
| **L1 Standard** | ~150k tokens | response bodies → first 4 KB; static-asset requests (images/fonts/css/analytics — by mime + URL heuristics) collapsed to one summary line; scroll events coalesced; duplicate screenshots deduped |
| **L2 Compact** | ~50k tokens | bodies → JSON **shape summary** (keys + types + array lengths, e.g. `{users: Array(50) of {id, name, email}}`); repeated calls to the same endpoint → first occurrence + `(×12 similar, 2 with differing status)`; screenshots only at key moments; console logs deduped with counts |
| **L3 Minimal** | ~15k tokens | narrative skeleton: navigations, clicks (element text only), transcript, markers/notes, annotations, errors with request/response one-liners; screenshot list as filenames only |

### Never trimmed, at any level

Voice transcript · annotations + their screenshots · markers/notes · errors (console errors, exceptions, 4xx/5xx with their request context) · file-capture metadata. These are the user's explicit signals of what mattered.

### Importance scoring

Each event gets a static score at capture: user-explicit signals (marker, annotation, narration overlap) > errors > state-changing requests (POST/PUT/DELETE) > navigations > clicks > GET/XHR > static assets > scrolls. Trimming drops from the bottom of the score order until the level's budget is met, then applies per-type compaction (body truncation → shape summary → status line). A `chars/4` token estimator drives a live per-level size preview in the export UI; the export panel shows all four levels with estimated tokens and the user picks.

### Zip layout

```
session-2026-07-05-1432/
  report.md          # chronological narrative: events, transcript lines,
                     # ![screenshots], network summaries, annotations — with
                     # a header (app URL, duration, tab list, level used)
  session.json       # complete structured event data at the chosen level
  screenshots/…jpg
  audio/…webm  + transcript.json
  files/…            # captured/attached files
  network/…          # bodies that exceeded inline size, as separate files
  MANIFEST.md        # asset index with one-line descriptions
```

`report.md` is the LLM entry point and is self-sufficient at L2/L3 without opening assets.

## 6. Redaction (default on)

- Request/response headers: `authorization`, `cookie`, `set-cookie`, `x-api-key`, etc. → `«redacted»`.
- Body fields matching `/token|secret|password|api[-_]?key|session/i` in JSON (recursive) and form data.
- Password input values never captured; input fields matching sensitive-name rules masked.
- URL query params matching the same patterns masked.
- Options page: custom rules (header names, JSON field regexes, URL patterns) on top of defaults; per-session "capture raw" toggle with a warning.
- Redaction is applied **at capture time** (raw secrets never touch disk).

## 7. UI flows

**Side panel — idle:** big Record button, target-tab indicator, capture-knob quick setting, past sessions list (open → export panel, delete).

**Side panel — recording:** elapsed timer · pause/stop · mic toggle with level meter + live "transcribing…" state · Annotate button · Attach file · Add marker / note field · live ticker of recent events (reassures the user capture is working) · per-tab chips showing which tabs are attached.

**Side panel — post-stop:** session summary (duration, counts per event type, total size) · transcription progress/retry · export panel: verbosity level radio with token estimates → **Download zip** (`chrome.downloads`).

**In-page:** annotation toolbar (floating, draggable); subtle "● REC" badge.

**Options page:** STT provider config (provider, base URL, model, key, test button) · redaction rules · capture knobs (screenshot policy, body cap, file cap) · storage usage + cleanup.

## 8. Permissions (manifest)

`debugger`, `sidePanel`, `tabs`, `scripting`, `storage`, `unlimitedStorage`, `offscreen`, `downloads`, host permissions `<all_urls>`. Mic via `getUserMedia` prompt on the extension's permission page.

## 9. Milestones

1. **M1 — Skeleton & session core:** WXT scaffold, side panel with record/stop, session state machine, IndexedDB layer, interaction content script, on-demand screenshots. *Demo: record clicks on a page, see events in the ticker.*
2. **M2 — Deep capture:** debugger attach, network + console/error capture, redaction defaults, multi-tab tracking, screenshot knob policies.
3. **M3 — Export v1:** data model freeze, markdown renderer, zip download at L0. *From here every later feature is visible in real output.*
4. **M4 — Trimming engine:** importance scoring, L1–L3 compaction (body shape summaries, request collapsing, screenshot thinning), token estimates in export UI.
5. **M5 — Annotation mode:** overlay, toolbar, tools, vector JSON + annotated screenshot on exit.
6. **M6 — Voice:** offscreen recorder, mic permission flow, provider abstraction + three providers, transcript interleaving.
7. **M7 — Files & markers:** upload interception, manual attach, markers/notes.
8. **M8 — Hardening:** SPA edge cases, OAuth-popup flows, big-session performance (1h+ sessions), storage pressure handling, session browser polish, README + store-listing assets.

## 10. Risks & mitigations

- **MV3 service worker suspension mid-session** → active `chrome.debugger` sessions and event traffic keep it alive; on unexpected restart, rehydrate session state from IndexedDB and re-attach.
- **Debugger conflicts** — can't attach when DevTools is open on the tab; another extension may hold the debugger → detect `attach` failure, explain in UI.
- **Storage blowups** (bodies + screenshots on long sessions) → capture-time caps, JPEG screenshots, `navigator.storage.estimate()` warnings, per-session size display.
- **Cross-origin iframes** → content scripts with `all_frames: true` + `match_origin_as_fallback`; some frames (chrome pages, other extensions) are uncapturable — note gaps in the report rather than failing silently.
- **Mic permission UX in extension context** → dedicated one-time permission page; graceful audio-off fallback.
- **Transcription failures** (bad key, rate limits) → audio always preserved; retry button; report notes untranscribed segments.

## 11. Out of scope (v1)

Video recording · backend upload / shareable links · LLM-powered summarization · live streaming to an agent · Firefox/Safari ports · DOM snapshot/replay (rrweb-style) — worth revisiting in v2 as an optional high-fidelity mode.
