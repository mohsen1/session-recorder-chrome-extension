# Event schema (frozen contract)

This document is the **schema freeze** for the recorder's event stream. It is the
authoritative reference for the renderer (`lib/export/markdown`) and the trimmer
(`lib/export/trimmer`): both read events by `type` and rely on the payload fields
described here being present and shaped as stated.

The runtime source of truth is [`lib/session/types.ts`](../lib/session/types.ts).
Later phases may **add** new `EventType`s (extend `EventType` + `EventPayloadMap`)
but must **never** change the shape of an existing payload. If a field's meaning
would change, add a new field instead.

## Envelope

Every event is a `BaseEvent<T>` — a discriminated union member keyed on `type`:

| Field        | Type                        | Meaning |
| ------------ | --------------------------- | ------- |
| `id`         | `string`                    | Unique event id (`newId`). |
| `sessionId`  | `string`                    | Owning session id. |
| `t`          | `number`                    | **Milliseconds from session start** (not epoch). This is the join key across events, screenshots, and the voice transcript; the renderer prints it as `[mm:ss]`. |
| `tabId`      | `number` (optional)         | Source tab, when the event belongs to a specific tab. |
| `type`       | `EventType`                 | Discriminant selecting the payload shape. |
| `importance` | `number`                    | Static importance score assigned once at capture by `scoreEvent` (see [`lib/session/events.ts`](../lib/session/events.ts)). Higher survives trimming longer. |
| `protected`  | `boolean` (optional)        | When `true`, the trimmer never drops or compacts this event. Also implied for the `PROTECTED_TYPES` set even when this flag is unset — the trimmer must consult `isProtected(e)`, not just this flag. |
| `payload`    | `EventPayloadMap[type]`     | Per-type body, documented below. |

A `RawEvent` is what a capture source emits *before* the background funnel stamps
`id`/`sessionId`/`t`/`importance`: it carries only `type`, optional `tabId`,
optional `at` (explicit ms-epoch timestamp; the funnel defaults to now), and
`payload`.

### Shared value objects

- **`Rect`** — `{ x, y, w, h }` (numbers).
- **`Point`** — `{ x, y }` (numbers).
- **`ElementDescriptor`** — best-effort description of a DOM element built in a
  content script: `tag` (required), optional `id`, `role`, `ariaLabel`, `name`,
  `text` (visible text, capped ~80 chars), `selector` (best-effort CSS selector:
  id > `[data-testid]` > short ancestor path), and `rect`.
- **`NetHeader`** — `{ name, value }` (both strings).
- **`NetBody`** — see [net-request](#net-request).

### Protected types

`isProtected(e)` returns `true` for any event with `protected: true`, and for all
of these types regardless of the flag:
`marker`, `note`, `annotation`, `voice-segment`, `error`, `file-captured`,
`file-attached`, `session-note`. These are the user's explicit signals plus
errors — the reason the recording exists — and the trimmer must preserve them at
every verbosity level.

---

## Interaction events

### `click`
`ClickPayload` — a pointer click on an element.

| Field        | Type                 | Meaning |
| ------------ | -------------------- | ------- |
| `descriptor` | `ElementDescriptor`  | The clicked element. |
| `modifiers`  | `string[]`           | Held modifier keys, e.g. `['ctrl','shift']`. Empty array when none. |
| `button`     | `number` (optional)  | Mouse button (0 = primary), when not the default. |

### `input`
`InputPayload` — a committed value change on a form field.

| Field       | Type                | Meaning |
| ----------- | ------------------- | ------- |
| `descriptor`| `ElementDescriptor` | The field. |
| `value`     | `string`            | The recorded value, **or the redaction marker** when `redacted` is true. |
| `redacted`  | `boolean`           | True for sensitive fields (password/token/etc. per `isSensitiveInput`); `value` then holds the marker, never the real input. |
| `inputType` | `string` (optional) | The `<input type=…>` (e.g. `password`, `email`). |

### `scroll`
`ScrollPayload` — a scroll gesture. Lowest importance; runs of consecutive
scrolls on the same tab are coalesced by the trimmer.

| Field      | Type                | Meaning |
| ---------- | ------------------- | ------- |
| `from`     | `Point`             | Scroll offset before the gesture. |
| `to`       | `Point`             | Scroll offset after. |
| `container`| `string` (optional) | Selector of the scroll container, or `'window'`. |

### `key`
`KeyPayload` — a notable key press (Enter/Escape/Tab/shortcut chords).

| Field       | Type                          | Meaning |
| ----------- | ----------------------------- | ------- |
| `key`       | `string`                      | Normalized key, e.g. `'Enter'`, `'Escape'`, `'Ctrl+K'`. |
| `modifiers` | `string[]`                    | Held modifiers. |
| `descriptor`| `ElementDescriptor` (optional)| The focused element, when known. |

---

## Navigation & tab events

These segment the story; the renderer turns them into `##` section breaks.

### `nav`
`NavPayload` — a full-page navigation (captured in the background via
`chrome.webNavigation.onCommitted`).

| Field           | Type                | Meaning |
| --------------- | ------------------- | ------- |
| `url`           | `string`            | Destination URL. |
| `title`         | `string` (optional) | Page title, when available. |
| `transitionType`| `string` (optional) | Chrome transition type (e.g. `link`, `typed`, `reload`). |

### `spa-route`
`SpaRoutePayload` — a client-side route change (History API / fragment), captured
via `onHistoryStateUpdated` / `onReferenceFragmentUpdated`.

| Field   | Type                                        | Meaning |
| ------- | ------------------------------------------- | ------- |
| `url`   | `string`                                    | New route URL. |
| `title` | `string` (optional)                         | Title, when available. |
| `method`| `'pushState' \| 'replaceState' \| 'popstate'`| How the route changed. |

### `tab-switch`
`TabSwitchPayload` — the active tab changed within the session.

| Field       | Type                | Meaning |
| ----------- | ------------------- | ------- |
| `fromTabId` | `number` (optional) | Previously active tab. |
| `toTabId`   | `number`            | Newly active tab. |
| `toUrl`     | `string` (optional) | URL of the newly active tab. |
| `toTitle`   | `string` (optional) | Its title. |

### `tab-opened`
`TabOpenedPayload` — a new tab was adopted into the session.

| Field        | Type                | Meaning |
| ------------ | ------------------- | ------- |
| `url`        | `string` (optional) | Initial URL, when known. |
| `title`      | `string` (optional) | Initial title. |
| `openerTabId`| `number` (optional) | The tab that opened it (must be a session tab to be adopted). |

### `tab-closed`
`TabClosedPayload` — a session tab was closed.

| Field  | Type                | Meaning |
| ------ | ------------------- | ------- |
| `url`  | `string` (optional) | Last known URL. |
| `title`| `string` (optional) | Last known title. |

---

## Deep-capture events

### `net-request`
`NetRequestPayload` — one network request/response assembled from CDP
`Network.*` events. Redaction (when enabled) is applied to headers, URL, and
bodies before emit.

| Field            | Type                    | Meaning |
| ---------------- | ----------------------- | ------- |
| `requestId`      | `string`                | CDP request id; also the join key for `ErrorPayload.linkedRequestId`. |
| `method`         | `string`                | HTTP method. Mutating methods (POST/PUT/DELETE/PATCH) score higher. |
| `url`            | `string`                | Request URL (query-param values may be redacted). |
| `resourceType`   | `string` (optional)     | CDP resource type (`XHR`, `Fetch`, `Image`, `Font`, `Stylesheet`, …). Used by `dropStaticAssets`. |
| `status`         | `number` (optional)     | Response status. `>= 400` scores higher and is never dropped as a static asset. |
| `statusText`     | `string` (optional)     | Response status text. |
| `requestHeaders` | `NetHeader[]`           | Request headers (redacted). |
| `responseHeaders`| `NetHeader[]`           | Response headers (redacted). |
| `requestBody`    | `NetBody` (optional)    | Request body (see below). |
| `responseBody`   | `NetBody` (optional)    | Response body (see below). |
| `timing`         | `{ startedAt: number; durationMs?: number }` (optional) | Timing. |
| `initiator`      | `string` (optional)     | Initiator type/description. |
| `failed`         | `boolean` (optional)    | True when the request failed (network error). Scores highest. |
| `failureReason`  | `string` (optional)     | CDP failure reason when `failed`. |
| `fromCache`      | `boolean` (optional)    | Served from cache. |
| `mime`           | `string` (optional)     | Response MIME type. |
| `websocket`      | `boolean` (optional)    | True for WebSocket connections. |
| `wsFrames`       | `WsFrame[]` (optional)  | WebSocket frames (capped ~100, each text capped ~2 KB). |
| `collapsed`      | `{ count: number; statuses: number[]; note?: string }` (optional) | **Set by the trimmer** when repeated calls to the same endpoint are folded into this representative request. |
| `bodyShape`      | `{ request?: string; response?: string }` (optional) | **Set by the trimmer** when a body was reduced to a JSON shape summary. |

**`NetBody`** — `{ present, mime?, text?, truncated?, originalSize?, assetId?, base64? }`:
- `present` — whether a body exists (false when the CDP body was evicted).
- `mime` — body MIME.
- `text` — possibly truncated and/or redacted body text.
- `truncated` — true when `text` was cut to the inline cap.
- `originalSize` — original (pre-truncation) size in bytes.
- `assetId` — id of the full body stored as a `net-body` asset when it overflowed the inline cap.
- `base64` — true when `text` is base64 (binary body).

**`WsFrame`** — `{ dir: 'sent' | 'recv'; opcode: number; ts: number; text?: string; truncated?: boolean }`; `ts` is ms from session start.

### `console`
`ConsolePayload` — a `console.*` call or non-error `Log.entryAdded`.

| Field   | Type                  | Meaning |
| ------- | --------------------- | ------- |
| `level` | `ConsoleLevel`        | One of `log \| info \| warn \| error \| debug \| trace`. `error` and `warn` score higher. |
| `text`  | `string`              | Stringified, space-joined args, capped ~2 KB. |
| `args`  | `string[]` (optional) | Individual stringified arguments. |
| `repeat`| `number` (optional)   | Consecutive-duplicate collapse count (same level+text within 1000 ms). |
| `stack` | `string` (optional)   | Stack trace, when present. |
| `source`| `string` (optional)   | Origin as `url:line` (from the first stack frame). |

### `error`
`ErrorPayload` — an error surfaced from any source. Protected; the renderer
isolates these with a `⚠` prefix.

| Field            | Type                                             | Meaning |
| ---------------- | ------------------------------------------------ | ------- |
| `message`        | `string`                                         | Error message. |
| `stack`          | `string` (optional)                              | Stack trace. |
| `origin`         | `'exception' \| 'console' \| 'network' \| 'log'` | Where it came from: uncaught exception, `console.error`, network failure, or an error-level `Log.entryAdded`. |
| `linkedRequestId`| `string` (optional)                              | The `net-request` this error is tied to (its body is never dropped). |

---

## Visual events

### `screenshot`
`ScreenshotPayload` — a captured viewport JPEG (stored as an asset).

| Field           | Type                 | Meaning |
| --------------- | -------------------- | ------- |
| `assetId`       | `string`             | Id of the stored JPEG asset. |
| `width`         | `number`             | Image width (from the decoded bitmap). |
| `height`        | `number`             | Image height. |
| `trigger`       | `ScreenshotTrigger`  | Why it was taken: `interaction \| nav \| error \| annotation \| manual \| key-moment`. `annotation`/`manual` score highest, then `error`, then `nav`. |
| `ahash`         | `string` (optional)  | 64-bit average hash as hex, for near-duplicate dedup. |
| `repeat`        | `number` (optional)  | Consecutive near-duplicate count folded into this shot. |
| `contextText`   | `string` (optional)  | One-line description of what triggered it (used as the image alt/caption). |
| `hasAnnotations`| `boolean` (optional) | True when annotation shapes were drawn over it. |

### `annotation-start`
`AnnotationStartPayload` — the user entered annotation mode.

| Field     | Type                   | Meaning |
| --------- | ---------------------- | ------- |
| `viewport`| `{ w: number; h: number }` | Viewport size at entry (annotation coordinate space). |

### `annotation`
`AnnotationPayload` — a set of shapes drawn over a screenshot. Protected; the
renderer describes each shape and its target element in text so the report is
readable without opening the image.

| Field              | Type                       | Meaning |
| ------------------ | -------------------------- | ------- |
| `shapes`           | `AnnotationShape[]`        | The drawn shapes (see below). |
| `screenshotAssetId`| `string` (optional)        | The screenshot being annotated. |
| `viewport`         | `{ w: number; h: number }` | Coordinate space for the shapes. |

**`AnnotationShape`** — `{ tool, color, strokeWidth, points?, rect?, from?, to?, text?, targetDescriptor? }`:
- `tool` — one of `pen \| arrow \| rect \| ellipse \| text \| highlighter \| redact`.
- `color`, `strokeWidth` — stroke styling.
- `points` — path for `pen` / `highlighter`.
- `rect` — bounds for `rect` / `ellipse` / `redact`.
- `from`, `to` — endpoints for `arrow`.
- `text` — label for `text`.
- `targetDescriptor` — the element under the shape's anchor, for text-only description to the LLM.

---

## Voice events

### `voice-segment`
`VoiceSegmentPayload` — a recorded audio segment plus its transcript. Protected.

| Field               | Type                                | Meaning |
| ------------------- | ----------------------------------- | ------- |
| `assetId`           | `string`                            | Id of the stored audio (`.webm`) asset. |
| `tStart`            | `number`                            | Segment start, ms from session start. |
| `tEnd`              | `number`                            | Segment end, ms from session start. |
| `transcript`        | `string \| null`                    | Transcribed text; `null` when not yet transcribed or transcription failed. |
| `words`             | `{ word: string; t: number }[]` (optional) | Per-word timings (ms from session start), when the provider supplies them. |
| `transcriptionError`| `string` (optional)                 | Error message when transcription failed. |
| `provider`          | `string` (optional)                 | Transcription provider used. |

---

## File events

Both use `FilePayload`. Protected.

### `file-captured`
A file the user selected/uploaded on a page, captured by the file-capture content
script.

### `file-attached`
A file the user attached directly through the extension UI.

**`FilePayload`**:

| Field         | Type                | Meaning |
| ------------- | ------------------- | ------- |
| `assetId`     | `string` (optional) | Id of the stored file asset; **undefined when metadata-only** (oversized). |
| `fileName`    | `string`            | Original file name. |
| `mime`        | `string`            | MIME type. |
| `size`        | `number`            | File size in bytes. |
| `contextText` | `string` (optional) | Where it was used, e.g. `"uploaded to Import CSV dialog"`. |
| `metadataOnly`| `boolean` (optional)| True when the file exceeded `fileCapBytes` and only metadata was kept. |
| `note`        | `string` (optional) | Free-form note. |

---

## User-signal events

### `marker`
`MarkerPayload` — an explicit user marker. Protected; rendered as a loud
blockquote.

| Field  | Type     | Meaning |
| ------ | -------- | ------- |
| `name` | `string` | Marker label. |

### `note`
`NotePayload` — a typed note from the user. Protected; rendered as a loud
blockquote.

| Field  | Type     | Meaning |
| ------ | -------- | ------- |
| `text` | `string` | Note text. |

---

## System events

### `session-note`
`SessionNotePayload` — a note the system records about the session itself
(rehydration, debugger detach, info/warning). Protected.

| Field  | Type                                          | Meaning |
| ------ | --------------------------------------------- | ------- |
| `text` | `string`                                      | Note text. |
| `kind` | `'rehydrate' \| 'detach' \| 'info' \| 'warning'` | Category of system note. |
