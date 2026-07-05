# Implementation Plan

Execution companion to `PLAN.md`. Eight phases, each ending in something demonstrable. No code here — pseudocode only where the logic is non-obvious.

---

## Phase 0 — De-risking spikes (½ day)

Three throwaway experiments before committing to the architecture. Each is a minimal extension that proves one risky assumption:

- **Spike A — debugger capture:** attach `chrome.debugger` to a tab, enable Network domain, log one request's response body via `Network.getResponseBody`. Confirms: attach flow, the banner behavior, body retrieval timing (body is only fetchable after `loadingFinished` and can be evicted — verify eviction behavior on a heavy page).
- **Spike B — mic in MV3:** offscreen document + `getUserMedia`. Confirms the permission-grant flow (expected: must first grant via a visible extension page, then offscreen works).
- **Spike C — background-tab screenshot:** CDP `Page.captureScreenshot` on a non-focused tab. Confirms multi-tab screenshots work without focus stealing.

**Exit criteria:** all three confirmed, findings noted at the top of this file. Any failure changes the plan *now*, cheaply.

---

## Phase 1 — Scaffold & session core

Goal: record button → interaction events persisted and visible live. No debugger yet.

### 1.1 Project scaffold
- WXT project with React + TS templates; strict TS; pnpm.
- Entrypoints: `background`, `sidepanel`, `options` (empty shell), `content/interactions`.
- Manifest: `sidePanel`, `tabs`, `scripting`, `storage`, `unlimitedStorage`, host `<all_urls>`. Add remaining permissions in the phase that needs them (keeps review surface honest during development).
- Dependencies: `idb`, `fflate`, `zustand` (side panel state), `nanoid`.
- Toolchain: vitest for `lib/`, ESLint + prettier.

### 1.2 Domain types & message protocol
- `lib/session/types`: `Session`, `Event` (discriminated union on `type`), `Asset` — exactly as specified in PLAN.md §4.
- `lib/messaging`: one typed request/response envelope for all runtime messaging (`{kind, payload}`), plus a broadcast channel background → side panel for live event ticks. Every later phase adds message kinds here, nowhere else.

### 1.3 Storage layer (`lib/storage`)
- IndexedDB via `idb`: stores `sessions`, `events` (index: `sessionId+t`), `assets` (index: `sessionId`).
- **Batched writer:** events buffer in memory, flush every 1 s or 50 events, whichever first. Assets (blobs) write immediately.
- API surface: `createSession`, `appendEvents`, `putAsset`, `getSession`, `iterateEvents(sessionId)`, `listSessions`, `deleteSession(cascades)`.

### 1.4 Session orchestrator (background)
- State machine: `idle → recording ⇄ paused → stopping → stopped`. Every transition has one owner function; capture modules subscribe to transitions rather than reading flags.
- On `start`: create session record, inject content scripts into the active tab, begin accepting events.
- Central `recordEvent(event)` funnel: stamps `t = now − sessionStart` and `tabId`, forwards to storage writer and to the side panel ticker broadcast. **All capture sources go through this one funnel** — trimming, redaction hooks, and the ticker all rely on it.

### 1.5 Side panel v1
- Idle view: Record button (targets active tab), sessions list (name, date, duration, delete).
- Recording view: elapsed timer, Stop, Pause, live ticker (last ~30 events, human-readable one-liners).
- State synced from background via broadcast + a `getState` request on panel open (panel can be opened mid-session).

### 1.6 Interaction capture content script
- Listeners (capture phase, `all_frames: true`):
  - `click` → element descriptor: `buildDescriptor(el)` = tag, id, `aria-label`/role, visible text (≤80 chars), a best-effort CSS selector (id > data-testid > short ancestor path), bounding box.
  - `input`/`change` → debounce 800 ms per element; password fields and sensitive-named fields → value `«redacted»`, but always keep the field's label/name/placeholder.
  - `scroll` → coalesce: record only after 300 ms idle, as `{from, to, container}`.
  - `keydown` → only Enter/Escape/Tab and modifier-chords.
  - SPA routes: wrap `history.pushState`/`replaceState`, listen to `popstate` → `spa-route` event with URL + title.
- Events post to background via runtime messaging; content script is stateless (safe to be re-injected after navigation).
- Re-injection: background listens to `webNavigation.onCommitted` for recorded tabs and re-injects.

### 1.7 On-demand screenshot (temporary implementation)
- Side panel button → `tabs.captureVisibleTab` → JPEG asset + `screenshot` event. Replaced by CDP in Phase 2; the event shape stays identical.

**Exit criteria:** record on a demo SPA — clicks, typing, routes, scrolls appear in the ticker and survive a full page reload of the target tab; sessions listed after stop; storage inspectable in DevTools.

---

## Phase 2 — Deep capture

Goal: network bodies, console, errors, multi-tab, redaction, screenshot policies. This is the riskiest phase; it follows the spikes directly.

### 2.1 Debugger manager (`lib/capture/debugger`)
- Owns attach/detach per tab; enables `Network`, `Page`, `Runtime`, `Log` domains on attach.
- Attach failures (DevTools open, another debugger) → typed error surfaced in side panel with plain-language explanation; session start aborts cleanly.
- Handle `chrome.debugger.onDetach` (user clicked the banner's Cancel, tab closed): mark tab detached, emit a session note event, keep session alive on other tabs; offer "re-attach" in panel.
- Add `debugger` permission to manifest here.

### 2.2 Network capture
- Per-request assembly — CDP delivers a request across 3–4 events keyed by `requestId`:

```
pending: Map<requestId, PartialRequest>

on Network.requestWillBeSent(e):
    pending[e.requestId] = {method, url, reqHeaders, reqBody(postData),
                            initiator, resourceType, tsStart}
on Network.responseReceived(e):
    merge status, respHeaders, mime, timing into pending
on Network.loadingFinished(e):
    body = Network.getResponseBody(requestId)     # must happen NOW,
    if body.size > CAP: keep first CAP bytes,     # bodies get evicted
                        store full body as asset if < asset cap
    event = redact(assemble(pending[e.requestId], body))
    recordEvent(event); delete pending[...]
on Network.loadingFailed(e):
    record as net-request with failure reason (high importance)
```

- Websockets: `webSocketCreated/FrameSent/FrameReceived` → one `net-request` event per socket with an appended frame log (frames capped).
- Config knobs (options page later): inline body cap (default 256 KB), overflow-to-asset cap (default 2 MB).

### 2.3 Redaction (`lib/capture/redaction`) — pure functions, unit-tested
- `redactHeaders(headers)`: case-insensitive blocklist → `«redacted»`.
- `redactBody(text, mime)`: if JSON, recursive walk —

```
walk(node):
    for key, value in node:
        if key matches /token|secret|password|api[-_]?key|session|auth/i:
            node[key] = "«redacted»"
        else recurse into objects/arrays
```

  non-JSON: regex pass for `key=value` pairs with sensitive keys (form-urlencoded).
- `redactUrl(url)`: same patterns over query params.
- Applied inside the network assembler **before** `recordEvent` — raw secrets never reach IndexedDB. Custom rules merge with defaults (Phase 8 options UI).

### 2.4 Console & exceptions
- `Runtime.consoleAPICalled` → `console` event (level, formatted args — stringify with depth cap 3, length cap 2 KB).
- `Runtime.exceptionThrown` → `error` event with message + stack.
- `Log.entryAdded` → network/security warnings the console API misses.
- Dedup at capture: identical consecutive console messages within 1 s collapse to one event with a counter (guards against log-spam loops flooding storage).

### 2.5 Multi-tab tracking

```
sessionTabs: Set<tabId>          # persisted in session record

on tabs.onCreated(tab):
    if tab.openerTabId in sessionTabs:
        adopt(tab)               # attach debugger, inject content scripts,
                                 # add to set, recordEvent(tab-opened)
on Page.windowOpen / target created via CDP:    # popups w/o openerTabId
    resolve to tabId, adopt(tab)
on tabs.onActivated:
    if both old & new tab in sessionTabs: recordEvent(tab-switch)
on tabs.onRemoved:
    remove from set, recordEvent(tab-closed); if set empty → auto-stop session
```

- Every event already carries `tabId` (Phase 1 funnel); report rendering resolves tab titles from the session's tab registry.

### 2.6 Screenshot scheduler (`lib/capture/screenshots`)
- Replace Phase 1 implementation with CDP `Page.captureScreenshot` (JPEG q80) — works on unfocused tabs.
- Policy knob (`every-interaction` / `key-moments` / `on-demand`) read from session settings:
  - *every-interaction*: subscribe to click/nav/spa-route/scroll-end events from the funnel, debounce 500 ms per tab.
  - *key-moments*: subscribe to nav, spa-route, `error`, net-request with status ≥ 400, annotation-exit.
  - Both: plus the manual button.
- Dedup: average-hash (8×8 grayscale) of each capture; if hamming distance to previous shot on that tab ≤ threshold, don't store — increment a repeat counter on the prior screenshot event.

### 2.7 Service worker resilience
- Rehydration: on SW start, check storage for a session in `recording` state → restore in-memory state, re-attach debugger to surviving tabs, re-inject content scripts, emit a `note` event ("recorder restarted, gap of N seconds possible").
- Keep-alive: active debugger sessions + a low-frequency `chrome.alarms` heartbeat that also flushes the event buffer.

**Exit criteria:** record a session against a real SaaS app: API request/response bodies visible in stored events with auth headers redacted; console errors captured; an OAuth-style popup gets adopted and captured; killing the SW from `chrome://serviceworker-internals` mid-session recovers without data loss beyond the buffer window.

---

## Phase 3 — Export v1 (full fidelity)

Goal: zip with `report.md` + `session.json` + assets at L0. Doing this before trimming/annotations/voice means every later feature is validated against real output.

### 3.1 Schema freeze
- Review every event payload shape produced by Phases 1–2; write `docs/event-schema.md` (one section per event type, field meanings). This document is the contract for the renderer and trimmer; later phases may *add* event types but not change existing shapes.

### 3.2 Markdown renderer (`lib/export/markdown`) — pure function: `(session, events, assets, level) → string`
- Header block: app URL(s), date, duration, tab registry, capture settings, level used, event-count table.
- Body: single chronological walk. Per-type formatting rules:
  - interactions → one-liners: `[00:42] CLICK "Submit order" (button#checkout, tab 1)`
  - nav/spa-route/tab events → `##`-level section breaks (they segment the story).
  - net-request → collapsed block: status+method+path on one line, then request/response bodies in fenced blocks (at L0, full up to capture cap).
  - console/error → fenced, prefixed with level; errors get a `⚠` and blank-line isolation so they stand out to the LLM.
  - screenshot → `![desc](screenshots/NNN.jpg)` plus one line of context (what triggered it).
  - marker/note → blockquote, visually loud.
- Timestamps as `[mm:ss]` from session start, consistent everywhere (this is the join key across transcript/screenshots/events for the LLM).
- Appendices: network index (every request one-line), console dump, `MANIFEST.md` content.
- Unit tests: golden-file tests with synthetic sessions (fixture builder helper).

### 3.3 Zip assembly & download
- `session.json`: the event stream + session meta, serialized after asset refs are rewritten to zip-relative paths.
- Assemble with `fflate` in the offscreen document (zipping big blobs in the SW risks its lifetime; add `offscreen` permission here).
- Naming: `screenshots/{seq}-{mmss}.jpg`, `network/{seq}-{host}-{path-slug}.json`, `files/{original-name}`, `audio/{seq}.webm`.
- `chrome.downloads.download` with a generated blob URL; add `downloads` permission.

### 3.4 Export UI (side panel, post-stop view)
- Session summary (counts, sizes) → level selector (only L0 enabled for now) → Download button with progress.

**Exit criteria:** a recorded session downloads as a zip; pasting `report.md` into Claude and asking "what did the user do and what went wrong?" yields a correct answer. This is the real acceptance test — run it every phase after this.

---

## Phase 4 — Trimming engine

Goal: L1–L3 levels with live token estimates. All pure functions in `lib/export/trimmer` — the most unit-testable code in the project.

### 4.1 Importance scoring
- Static score assigned per event by a table (see PLAN.md §5): marker/annotation/narration-adjacent > error > mutating request (POST/PUT/DELETE/PATCH) > nav > click > GET xhr/fetch > static asset > scroll.
- "Narration-adjacent": any event within ±5 s of a voice segment gets a score boost (the user was talking about it) — implemented now, activates when voice lands in Phase 6.

### 4.2 Compaction transforms — each a pure `(events) → events` pass
- `truncateBodies(maxBytes)` — keep head, note original size.
- `bodyToShapeSummary` — JSON → structural sketch:

```
shape(node, depth):
    object → { key: shape(value) for first ~10 keys }, note "+N more keys"
    array  → "Array(len) of " + shape(first element)
    leaf   → type name, plus the literal value if it's short & non-sensitive
```

- `collapseRepeatedRequests` — group by `method + normalized path` (path segments that look like ids/uuids → `:id`); keep first occurrence full, replace rest with one summary line: count, statuses seen, note any that differ in status (those stay full — anomalies are signal).
- `dropStaticAssets` — mime/URL heuristics (images, fonts, css, analytics/telemetry domains list) → single summary line per page-load.
- `thinScreenshots(keepPolicy)` — keep nav/error/annotation/manual shots; drop interaction-debounce shots; already-deduped repeats stay as counters.
- `coalesceScrolls`, `dedupConsole` — tighter versions of the capture-time passes.
- Never-trim guard: transforms skip events flagged protected (transcript, annotations + their screenshots, markers, notes, errors + their linked requests, file metadata).

### 4.3 Level executor

```
plan(level) = ordered list of transforms with parameters, e.g.
  L1: [dropStaticAssets, coalesceScrolls, truncateBodies(4KB),
       thinScreenshots(keep-key-moments), dedupConsole]
  L2: L1 then [bodyToShapeSummary, collapseRepeatedRequests,
       thinScreenshots(keep-annotation+error only)]
  L3: L2 then [dropBodiesEntirely-except-error-linked,
       interactionsToTextOnly, screenshotsToManifestOnly]

export(level):
    events' = apply plan(level) to full-fidelity events from IndexedDB
    estimate = tokens(render(events'))     # chars/4
    → renderer → zip
```

- Levels are cumulative transform pipelines, not budget solvers — deterministic and explainable. The token *targets* (150k/50k/15k) are calibration goals for choosing transform parameters, verified against fixture sessions, not runtime constraints.

### 4.4 Export UI v2
- All four levels selectable, each showing estimated tokens (computed lazily on panel open, cached per session). A footnote lists what each level omits — transparency about trimming is part of "intelligent."

**Exit criteria:** a deliberately long fixture session (500+ requests, log spam, repeated polling calls) renders at all four levels; L2/L3 land within ±30% of targets; golden-file tests for each transform; the Claude paste-test still answers correctly at L2.

---

## Phase 5 — Annotation mode

### 5.1 Overlay lifecycle (`content/annotations`)
- Toggled via side panel button or `chrome.commands` shortcut. Injects a full-viewport container in a **shadow DOM** (style isolation), `position: fixed`, max z-index; swallows all pointer/key events → page is frozen while annotating.
- Records `annotation-start` event; page scroll is locked so drawings stay registered to what's on screen.

### 5.2 Drawing engine
- Vector model, not raster: `shapes: [{tool, points/geometry, color, strokeWidth, text?}]` rendered to a canvas on each change.
- Tools: pen (point array), arrow (start/end), rect, ellipse, text label, highlighter (translucent pen), redact-box (solid fill).
- Tool state machine: pointerdown → draft shape → pointermove updates → pointerup commits to shape list. Undo/redo = index into shape history list.

### 5.3 Toolbar
- Floating, draggable, inside the same shadow root: tool buttons, color swatches, stroke width, undo/redo, clear, ✓ Done, ✗ Cancel.

### 5.4 Exit flow
- Done → CDP screenshot (overlay is in-DOM so drawings are captured) → store as asset; store shape list as `annotation` event payload; remove overlay; unlock scroll.
- **Semantic enrichment:** for each shape, hit-test the page at the shape's center/endpoint (`elementFromPoint`, temporarily ignoring the overlay) and attach the underlying element's descriptor. The renderer can then emit: *"user circled the region around button 'Submit order'"* — text the LLM can use without vision.

**Exit criteria:** annotate mid-recording; zip contains the annotated screenshot; `report.md` describes each shape with its target element; undo/redo and cancel behave; works on a page with aggressive CSS (style isolation holds).

---

## Phase 6 — Voice narration

### 6.1 Permission flow
- First mic toggle: open the dedicated permission page (from Spike B), request `getUserMedia`, close on grant. Persist a "mic granted" flag; subsequent sessions skip straight to recording.

### 6.2 Recorder (offscreen document)
- `MediaRecorder` (webm/opus), `timeslice` chunking; cut a segment every 30 s **and** on pause/stop. Each segment stored as an asset immediately + `voice-segment` event with `{tStart, tEnd, assetId, transcript: null}`.
- Side panel mic button shows live level meter (AnalyserNode, throttled level messages).

### 6.3 Transcription providers (`lib/transcription`)
- Interface: `transcribe(audioBlob, config) → {text, words?: [{word, t}]}` .
- Implementations: OpenAI-compatible (configurable baseURL + model + key; default OpenAI Whisper), Deepgram, ElevenLabs Scribe. Options page: provider picker, credentials, "test with 2 s sample" button. Keys in `chrome.storage.local` only.

### 6.4 Pipeline
- Queue in background: segments transcribe as they close (during recording), sequential with retry/backoff; failures leave `transcript: null` + error noted. Post-stop view shows progress ("7/9 segments transcribed") with per-segment retry.
- Renderer interleaves transcript text at segment timestamps as blockquoted narration — visually distinct, never trimmed. Word-level timestamps (when the provider gives them) let the renderer split a segment across events happening mid-segment.

**Exit criteria:** narrate while clicking through a bug repro; report interleaves speech with the actions being described at the right timestamps; audio files present in zip; no-key configured → clean degradation to audio-only with a report note.

---

## Phase 7 — Files, markers, notes

### 7.1 Upload interception (`content/file-capture`)
- `change` listener on `input[type=file]` (capture phase, works for hidden inputs triggered by styled buttons) + `drop` events with `dataTransfer.files`.
- For each file ≤ cap (default 25 MB): read → asset + `file-captured` event with context = nearest form/dialog heading or `aria-label` (walk up the DOM for the first heading-ish text). Over cap: metadata-only event.

### 7.2 Manual attachments
- Side panel "Attach" → file picker + optional note → `file-attached` event. Allowed while recording and in post-stop review (attach logs/specs after the fact).

### 7.3 Markers & notes
- Marker button + `chrome.commands` shortcut → prompt-free instant `marker` event (auto-named "Marker 3"), renameable in post-stop review. Note field in panel → `note` event. Both rendered loud in `report.md` and never trimmed.

**Exit criteria:** uploading a CSV into a demo app lands the same CSV in the zip with correct context text; shortcut-dropped marker appears prominently in the report.

---

## Phase 8 — Hardening & polish

- **Edge-case matrix (manual test checklist, run against 3–4 real SaaS apps):** SPA with client routing + service worker; OAuth popup flow; page that navigates cross-origin mid-session; iframe-heavy app; page with CSP that blocks inline styles (annotation overlay); 60-minute session with polling (storage + trimmer behavior); DevTools-open conflict messaging.
- **Performance:** event-buffer tuning; ensure blobs never pass through runtime messaging (write from the capturing context or transfer via asset ids); export of a 500 MB session doesn't OOM (stream zip entries).
- **Storage management:** options-page usage view per session, `navigator.storage.estimate()` warning at 80%, oldest-session cleanup prompt.
- **Options page completion:** redaction custom rules editor, capture knobs (screenshot policy default, body caps, file cap), STT config (from Phase 6), keyboard shortcut reference.
- **Session browser polish:** rename sessions, re-export at any level, per-session size.
- **Docs:** README (install, permissions rationale — especially the debugger banner), `docs/report-format.md` for LLM-consumer guidance (how to prompt an agent with the zip).

**Exit criteria:** full matrix passes; a stranger can install from the README, record a bug in their own app, and hand the zip to Claude Code with a working outcome.

---

## Cross-cutting practices

- **Testing:** unit tests concentrate where the logic is pure and gnarly — trimmer transforms, redaction, markdown renderer, shape summary, request collapsing (golden files with fixture sessions). Capture code is validated via the per-phase manual checklists plus a bundled `demo/` test page (buttons that fire fetches, errors, file inputs, log spam) served locally for repeatable manual runs.
- **The paste-test as regression gate:** from Phase 3 onward, every phase ends by pasting a fresh `report.md` into an LLM and asking it to reconstruct the session. Degradation in its answer = regression in the product, whatever the unit tests say.
- **Event funnel discipline:** every new capture source goes through `recordEvent`; every new event type gets a schema-doc entry, a renderer rule, a trimmer classification (protected / droppable / compactable), and an importance score — enforced by an exhaustiveness check on the event-type union so forgetting one is a compile error.
- **Permissions hygiene:** each permission added in the phase that needs it, with a line in the README explaining why it's required.

## Sequencing rationale

Phases 1→4 build the spine (capture → persist → export → trim); each of 5/6/7 is an independent capture source that plugs into the existing funnel and renderer, so after Phase 4 they can be reordered or parallelized if priorities shift. Export lands early (Phase 3) because report quality is the product — every subsequent feature is judged by what it does to `report.md`.
