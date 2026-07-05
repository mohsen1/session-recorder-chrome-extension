# Internal API surface (build contract)

This document is the authoritative interface spec for every module. It exists so
modules can be built in parallel and still interlock. **Implement the signatures
exactly as written.** The runtime types come from `lib/session/types.ts`,
`lib/session/events.ts`, `lib/session/settings.ts`, and `lib/messaging.ts` — read
those first.

## Global conventions

- **Runtime**: Chrome MV3. Use `chrome.*` APIs directly (types via `@types/chrome`).
  Do **not** import WXT's `browser`. In content scripts / background, `chrome` is global.
- **WXT entrypoints**: import define helpers from `wxt/sandbox`
  (`defineBackground`, `defineContentScript`, `defineUnlistedScript`).
- **Imports**: use the `@/` path alias for cross-tree imports, e.g.
  `import type { SessionEvent } from '@/lib/session/types'`. Relative imports
  within the same directory are fine.
- **TS strictness**: `strict` + `noUncheckedIndexedAccess` are on. Guard array/`Map`
  access. No `any` in public signatures (internal `any` for CDP params is OK, typed as
  `Record<string, unknown>` where reasonable).
- **Purity**: modules marked _(pure)_ must not touch `chrome`, DOM, network, or
  global mutable state, and must not mutate their inputs (clone first). They are
  unit-tested in node.
- **No blobs over messaging**: never send a `Blob`/`ArrayBuffer` through
  `chrome.runtime.sendMessage`. Use data URLs for the few small cross-context
  transfers (file attach, audio segment) or write to IndexedDB and pass the id.
- **IDs**: `import { newId } from '@/lib/util/ids'`.
- Every source file: concise top-of-file comment stating its role. Match the
  house style of the already-written `lib/session/*` files.

---

## lib/util/ids.ts
```
export function newId(prefix?: string): string   // url-safe nanoid(21); if prefix, `${prefix}_${id}`
```

## lib/util/hash.ts
```
export async function sha256Hex(data: ArrayBuffer | Uint8Array | Blob): Promise<string>
// Average-hash (aHash) as 16-char hex (64 bits). Uses OffscreenCanvas (available in
// service worker + window). Downscale to 8x8 grayscale, threshold at mean.
export async function averageHashFromBitmap(bitmap: ImageBitmap): Promise<string>
export async function averageHashFromBlob(blob: Blob): Promise<string>
export function hammingHex(a: string, b: string): number   // bit distance between two hex strings
```

## lib/dom/descriptor.ts  (DOM context: content scripts)
```
import type { ElementDescriptor } from '@/lib/session/types'
export function buildDescriptor(el: Element): ElementDescriptor
export function bestSelector(el: Element): string          // id > [data-testid] > tag.class > nth-of-type ancestor path (max depth ~4)
export function visibleText(el: Element, cap?: number): string   // trimmed, collapsed whitespace, default cap 80
export function isSensitiveInput(el: Element): boolean     // type=password, or name/id/autocomplete matching /pass|secret|token|cc-|card|cvv|ssn/i
export function nearestHeading(el: Element): string | undefined  // walk ancestors; first <h1..h6>, [role=heading], legend, [aria-label], or dialog/form label text
```

## lib/storage/index.ts
IndexedDB via `idb`. DB name `session-recorder`, version 1.
Stores: `sessions` (keyPath `id`); `events` (keyPath `id`, index `by-session` on `['sessionId','t']`); `assets` (keyPath `id`, index `by-session` on `sessionId`).
```
import type { Asset, AssetMeta, Session, SessionEvent } from '@/lib/session/types'
export async function createSession(s: Session): Promise<void>
export async function updateSession(s: Session): Promise<void>
export async function getSession(id: string): Promise<Session | undefined>
export async function listSessions(): Promise<Session[]>          // newest first (by startedAt desc)
export async function deleteSession(id: string): Promise<void>    // cascade delete its events + assets
export async function appendEvents(events: SessionEvent[]): Promise<void>
export async function getEvents(sessionId: string): Promise<SessionEvent[]>   // ordered by t asc
export async function putAsset(a: Asset): Promise<void>
export async function getAsset(id: string): Promise<Asset | undefined>
export async function getAssets(sessionId: string): Promise<Asset[]>
export async function getAssetsMeta(sessionId: string): Promise<AssetMeta[]>   // strip .blob
export async function storageEstimate(): Promise<{ usage: number; quota: number }>  // navigator.storage.estimate fallback {0,0}

// Batched writer used by the background funnel.
export class EventWriter {
  constructor(opts?: { flushMs?: number; maxBatch?: number; onFlush?: (n: number) => void }) // defaults 1000ms / 50
  add(e: SessionEvent): void      // buffers; auto-flushes when maxBatch reached or timer fires
  flush(): Promise<void>          // force-write buffered events now
  size(): number
  dispose(): void                 // clear timer, flush pending synchronously best-effort
}
```

## lib/capture/redaction.ts  (pure)
```
import type { NetHeader, RedactionRules } from '@/lib/session/types'
export const REDACTED = '«redacted»'
export const DEFAULT_HEADER_BLOCKLIST: string[]   // lowercased: authorization, cookie, set-cookie, x-api-key, x-auth-token, proxy-authorization, www-authenticate
export const DEFAULT_KEY_PATTERN: RegExp          // /token|secret|password|passwd|api[-_]?key|session|auth|credential|bearer/i
export function buildKeyMatcher(rules: RedactionRules): (key: string) => boolean
export function redactHeaders(headers: NetHeader[], rules: RedactionRules): NetHeader[]
// JSON: parse, recursively replace values whose key matches -> REDACTED, re-stringify (pretty).
// form-urlencoded (mime includes 'x-www-form-urlencoded' or looks like k=v&k=v): redact matching keys' values.
// Anything else: return unchanged. `redacted` true if any replacement happened. Never throw on bad JSON.
export function redactBody(text: string, mime: string | undefined, rules: RedactionRules): { text: string; redacted: boolean }
export function redactUrl(url: string, rules: RedactionRules): string   // redact matching query-param VALUES
```
Redaction is a no-op passthrough when called with an all-empty rules set? No — defaults ALWAYS apply; the per-session master switch is handled by the caller (background only calls redaction when `settings.redactionEnabled`).

## lib/capture/debugger.ts
Wrapper over `chrome.debugger`. Protocol `1.3`.
```
export type CdpEventHandler = (tabId: number, method: string, params: Record<string, unknown>) => void
export type DetachHandler = (tabId: number, reason: string) => void
export class DebuggerManager {
  attach(tabId: number): Promise<void>
  // chrome.debugger.attach({tabId}, '1.3'); then send Network.enable (maxResourceBufferSize/maxTotalBufferSize large),
  // Page.enable, Runtime.enable, Log.enable. On failure (DevTools open / already attached) throw Error with a
  // human-readable .message. Idempotent if already attached.
  detach(tabId: number): Promise<void>       // swallow "not attached" errors
  isAttached(tabId: number): boolean
  attachedTabs(): number[]
  send<T = Record<string, unknown>>(tabId: number, method: string, params?: object): Promise<T>
  onEvent(h: CdpEventHandler): void           // registers one shared chrome.debugger.onEvent listener, fans out to handlers
  onDetach(h: DetachHandler): void            // chrome.debugger.onDetach
  captureScreenshot(tabId: number, quality: number): Promise<{ data: string }>  // Page.captureScreenshot {format:'jpeg', quality}; data = base64 (no data: prefix)
  dispose(): void
}
```
Register the `chrome.debugger.onEvent`/`onDetach` listeners once in the constructor and fan out to arrays of handlers.

## lib/capture/network.ts
Assembles CDP Network events into `NetRequestPayload`. See pseudocode in IMPLEMENTATION.md §2.2.
```
import type { CaptureSettings, RawEvent } from '@/lib/session/types'
export interface NetworkDeps {
  send: (tabId: number, method: string, params?: object) => Promise<Record<string, unknown>>  // = DebuggerManager.send
  getSettings: () => CaptureSettings
  emit: (raw: RawEvent) => void                 // the background recordEvent funnel
  storeBodyAsset: (text: string, mime: string, base64: boolean) => Promise<string>  // returns assetId; used on overflow
  sessionStart: () => number                    // ms epoch of session start, for ws frame timestamps
}
export class NetworkCapturer {
  constructor(deps: NetworkDeps)
  handle(tabId: number, method: string, params: Record<string, unknown>): void  // route Network.* here
  reset(): void   // clear pending map
}
```
Behavior:
- `requestWillBeSent` → open pending record (method, url, headers, postData, initiator.type, resourceType via later `responseReceived`).
- `requestWillBeSentExtraInfo` → merge full request headers if available.
- `responseReceived` → status, statusText, response headers, mimeType, timing.
- `loadingFinished` → **immediately** `send(tabId,'Network.getResponseBody',{requestId})`; if `base64Encoded` keep as base64 (mark base64). Apply redaction (when settings.redactionEnabled) to headers/url/text. Truncate text to `inlineBodyCapBytes` (mark truncated + originalSize). If original ≤ `assetBodyCapBytes`, also `storeBodyAsset` and set `responseBody.assetId`. Emit `{type:'net-request', tabId, payload}`.
- `loadingFailed` → emit with `failed:true, failureReason`.
- Websockets: `webSocketCreated` open pending ws; `webSocketFrameSent/Received` append to `wsFrames` (cap ~100 frames, text cap 2KB each); `webSocketClosed` emit. Set `websocket:true`.
- getResponseBody can reject (body evicted) — catch and emit with `responseBody.present=false`.
- Redaction is applied here, before emit. Import from `./redaction`.

## lib/capture/console.ts
```
import type { RawEvent } from '@/lib/session/types'
export class ConsoleCapturer {
  constructor(emit: (raw: RawEvent) => void)
  handle(tabId: number, method: string, params: Record<string, unknown>): void
  reset(): void
}
```
- `Runtime.consoleAPICalled` → `console` event. `params.type` maps to level (`error|warning->warn|...`). Stringify `params.args` (RemoteObject[]) to readable strings (prefer `.value`, else `.description`, else `.preview`), join with space, cap 2KB. Extract `source` from `stackTrace.callFrames[0]` as `url:line`.
- `Runtime.exceptionThrown` → `error` event `{origin:'exception', message, stack}` from `exceptionDetails`.
- `Log.entryAdded` → if `level==='error'` emit an `error` event `{origin:'log'}`, else a `console` event.
- Consecutive-duplicate coalescing: hold one pending `console` event; if the next identical (same level+text) arrives within 1000ms, bump `payload.repeat` instead of emitting a second; flush the pending event when a different one arrives or after 1000ms of quiet (use setTimeout).

## lib/capture/screenshots.ts
```
import type { CaptureSettings, RawEvent, ScreenshotTrigger, SessionEvent } from '@/lib/session/types'
export interface ScreenshotDeps {
  captureScreenshot: (tabId: number, quality: number) => Promise<{ data: string }>  // = DebuggerManager.captureScreenshot
  getSettings: () => CaptureSettings
  emit: (raw: RawEvent) => void
  storeScreenshot: (jpegBase64: string) => Promise<{ assetId: string; size: number }>
}
export class ScreenshotScheduler {
  constructor(deps: ScreenshotDeps)
  onEvent(e: SessionEvent): void            // apply the policy to a just-recorded event
  capture(tabId: number, trigger: ScreenshotTrigger, contextText?: string): Promise<void>  // explicit/manual
  reset(): void
}
```
Policy (from `getSettings().screenshotPolicy`):
- `every-interaction`: on click / key / scroll / nav / spa-route / tab-switch events → debounce 500ms per tab, then capture(trigger derived).
- `key-moments`: on nav / spa-route / error / net-request(status>=400) / tab events → capture.
- `on-demand`: `onEvent` does nothing; only `capture()` (manual + annotation exit) fires.
Dedup: before storing, compute aHash of the JPEG (`averageHashFromBlob`). Keep `lastHashByTab`. If `hammingHex(new,last) <= settings.screenshotDedupThreshold`, DROP (don't store, don't emit). Else store + emit `{type:'screenshot', tabId, payload:{assetId,width,height,trigger,ahash,contextText}}` and update lastHash. Get width/height from the decoded `ImageBitmap`.

## lib/capture/multitab.ts
```
export interface MultiTabDeps {
  isSessionTab: (tabId: number) => boolean
  adopt: (tabId: number, openerTabId?: number) => Promise<void>
  onActivated: (tabId: number) => void
  onClosed: (tabId: number) => void
}
export class MultiTabTracker {
  constructor(deps: MultiTabDeps)
  start(): void   // add chrome.tabs.onCreated (adopt if opener is a session tab), onActivated, onRemoved
  stop(): void    // remove those listeners
}
```

## lib/export/tokens.ts  (pure)
```
export function estimateTokens(text: string): number   // ceil(text.length / 4)
```

## lib/export/shape-summary.ts  (pure)
```
// Structural sketch of a JSON value. Objects: `{ key: <shape>, ... }` first maxKeys keys + `, +N more`.
// Arrays: `Array(len) of <shape-of-first>` (or `Array(0)`). Leaves: `string|number|boolean|null`,
// optionally with a short literal for scalars (<=24 chars, no redaction concerns — redaction happened upstream).
export function shapeSummary(value: unknown, opts?: { maxKeys?: number; maxDepth?: number }): string   // defaults 10 / 4
export function jsonShapeFromText(text: string): string | null   // JSON.parse then shapeSummary; null if unparseable
```

## lib/export/trimmer.ts  (pure)
```
import type { AssetMeta, CaptureSettings, SessionEvent, VerbosityLevel } from '@/lib/session/types'
export interface TrimContext { assetsById: Map<string, AssetMeta>; settings: CaptureSettings }
export type Transform = (events: SessionEvent[], ctx: TrimContext) => SessionEvent[]
export function truncateBodies(maxBytes: number): Transform
export function bodyToShapeSummary(): Transform         // set payload.bodyShape from request/response text; keep bodies' text short note
export function collapseRepeatedRequests(): Transform   // group by method + path-with-:id; first stays, rest -> one collapsed marker event
export function dropStaticAssets(): Transform           // drop net-request for images/fonts/css/media + analytics hosts (unless status>=400)
export function thinScreenshots(keep: 'key-moments' | 'annotation-error' | 'manifest-only'): Transform
export function coalesceScrolls(): Transform            // merge runs of consecutive scroll events on same tab into one
export function dedupConsole(): Transform               // merge consecutive identical console events, sum repeat
export function dropBodiesExceptErrors(): Transform     // clear net bodies unless linked to an error or status>=400
export function interactionsToTextOnly(): Transform     // strip descriptors to text/selector only
export function planFor(level: VerbosityLevel): Transform[]
export function applyLevel(events: SessionEvent[], level: VerbosityLevel, ctx: TrimContext): SessionEvent[]
```
Rules: every transform clones (never mutates input events); every transform SKIPS events where `isProtected(e)` is true (import from `@/lib/session/events`) — except purely cosmetic ones like coalesceScrolls that only touch scroll (never protected). `planFor` per IMPLEMENTATION.md §4.3 (L0 = [], L1/L2/L3 cumulative).

## lib/export/markdown.ts  (pure)
```
import type { AssetMeta, Session, SessionEvent, VerbosityLevel } from '@/lib/session/types'
export interface RenderInput {
  session: Session
  events: SessionEvent[]
  assets: AssetMeta[]
  level: VerbosityLevel
  assetPath: (assetId: string) => string | undefined   // zip-relative path, or undefined if not included
}
export function renderReport(input: RenderInput): string     // the full report.md
export function renderManifest(input: RenderInput): string   // MANIFEST.md asset index
export function formatClock(ms: number): string              // mm:ss (or h:mm:ss), exported for reuse/tests
```
Renderer rules per IMPLEMENTATION.md §3.2: header block (app urls, date, duration, tab registry, settings, level, per-type count table); chronological body with per-type one-liners; `[mm:ss]` timestamps everywhere; nav/tab events as `##` section breaks; net-request collapsed block with fenced bodies (or shape summary if `payload.bodyShape` set, or collapsed marker if `payload.collapsed`); console/error fenced, errors prefixed `⚠`; screenshot as `![context](path)`; marker/note as loud blockquote; voice-segment as `> 🎙️ transcript`; annotation as a described list of shapes + target elements + `![](path)`; appendices (network index, console dump). Must be self-sufficient (readable without opening assets) at L2/L3.

## lib/export/zip.ts
```
import type { ExportFile } from './bundle'
export async function zipFiles(files: ExportFile[], rootDir: string): Promise<Uint8Array>  // fflate zip; prefix every path with `${rootDir}/`
```

## lib/export/bundle.ts
```
import type { Asset, AssetMeta, Session, SessionEvent, VerbosityLevel } from '@/lib/session/types'
import type { TokenEstimate } from '@/lib/messaging'
export interface ExportFile { path: string; text?: string; bytes?: Uint8Array }
export interface BuildBundleInput { session: Session; events: SessionEvent[]; assets: Asset[]; level: VerbosityLevel }
export async function buildBundle(input: BuildBundleInput): Promise<ExportFile[]>
// 1) trimmed = applyLevel(events, level, {assetsById, settings})
// 2) assign zip-relative paths to every asset still referenced by a surviving event
//    (screenshots/{seq}-{mmss}.jpg, audio/{seq}-{mmss}.webm, files/{safeName}, network/{seq}-{host}-{slug}.json).
//    Always include annotation screenshots, audio, file assets regardless of level.
// 3) files: report.md (renderReport), session.json (trimmed events + session meta, asset refs -> paths),
//    MANIFEST.md (renderManifest), transcript.json (voice segments). Plus every included asset as bytes.
export function estimateForLevels(events: SessionEvent[], assets: AssetMeta[], session: Session): TokenEstimate[]
// For each of L0..L3: run applyLevel + renderReport (with a stub assetPath), estimateTokens, list omitted categories.
```

## lib/transcription/*
`provider.ts`:
```
export interface TranscriptionResult { text: string; words?: { word: string; t: number }[] }
export interface TranscriptionConfig {
  provider: 'openai' | 'deepgram' | 'elevenlabs'
  baseUrl?: string
  model?: string
  apiKey: string
  language?: string
}
export interface TranscriptionProvider { transcribe(audio: Blob, config: TranscriptionConfig): Promise<TranscriptionResult> }
```
`openai-compatible.ts`, `deepgram.ts`, `elevenlabs.ts`: one class each implementing `TranscriptionProvider` via `fetch` (multipart for OpenAI `/audio/transcriptions` default model `whisper-1`, baseUrl default `https://api.openai.com/v1`; Deepgram `https://api.deepgram.com/v1/listen` Nova model with word timings; ElevenLabs `https://api.elevenlabs.io/v1/speech-to-text` model `scribe_v1`). Throw `Error` on non-2xx with body text.
`index.ts`:
```
export function getProvider(name: TranscriptionConfig['provider']): TranscriptionProvider
export async function transcribe(audio: Blob, config: TranscriptionConfig): Promise<TranscriptionResult>
export const PROVIDERS: { id: TranscriptionConfig['provider']; label: string; defaultBaseUrl: string; defaultModel: string }[]
```

## lib/fixtures/session-builder.ts  (test helper)
```
import type { Asset, Session, SessionEvent } from '@/lib/session/types'
// Fluent builder for synthetic sessions used by trimmer/markdown/bundle tests.
export class SessionBuilder {
  constructor(overrides?: Partial<Session>)
  click(text: string, opts?: {...}): this
  input(name: string, value: string, opts?: {...}): this
  scroll(): this
  nav(url: string, title?: string): this
  net(method: string, url: string, opts?: { status?: number; reqBody?: string; resBody?: string; mime?: string }): this
  consoleLog(level: string, text: string): this
  error(message: string): this
  screenshot(trigger?: string): this   // registers a fake asset too
  marker(name: string): this
  note(text: string): this
  voice(transcript: string, tStart: number, tEnd: number): this
  annotation(shapes?: unknown[]): this
  file(name: string, size: number): this
  build(): { session: Session; events: SessionEvent[]; assets: Asset[] }
}
export function tinyPngBlob(): Blob   // 1x1 png for screenshot assets
```
Give each event a monotonically increasing `t` and correct `importance` (use `scoreEvent`) and `protected` where appropriate. Keep it small but expressive enough that trimmer/markdown tests are meaningful.

---

## Entry points (see separate build tasks for detailed behavior)

- `entrypoints/background.ts` — the orchestrator; wires all the above.
- `entrypoints/interactions.content.ts`, `annotations.content.ts`, `file-capture.content.ts` — ISOLATED-world content scripts.
- `entrypoints/sidepanel/*`, `entrypoints/options/*` — React apps.
- `entrypoints/offscreen/*`, `entrypoints/mic-permission/*` — audio + permission pages.

Navigation (`nav`) and SPA route (`spa-route`) events are captured in the
**background** via `chrome.webNavigation` (onCommitted / onHistoryStateUpdated /
onReferenceFragmentUpdated) — NOT in content scripts.
