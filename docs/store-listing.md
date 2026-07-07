# Chrome Web Store listing — Session Recorder

Copy/paste source for the Developer Dashboard. Keep this in sync with the actual
behavior and with `docs/PRIVACY.md`.

## Basics

- **Name:** Session Recorder
- **Category:** Developer Tools
- **Language:** English
- **Visibility:** Unlisted (recommended for first submission — see notes below)

## Account & contact

- **Publisher / account owner:** Mohsen Azimi (mohsen1) — developer account
  registered, $5 fee paid.
- **Support email:** <add your support email>
  - Note: this address is required and is shown publicly on the listing. To keep
    spam down, don't also fill the optional "Support URL" with a mailto, and
    consider a Gmail filter for `[chrome web store]`-style subjects. If spam
    becomes a problem later, swap in a dedicated alias — it doesn't affect the
    account owner.
- **Website:** https://mohsen1.github.io/session-recorder-chrome-extension/
  (or your custom domain if configured, e.g.
  https://azimi.me/session-recorder-chrome-extension/)

## Short description (≤132 chars) — paste as-is

Record a bug — clicks, network, console, screenshots, video, voice — and export one clean report your AI agent can read.

## Detailed description — paste as-is (plain text; the field does NOT render markdown)

Record a bug. Hand your agent the whole story.

Reproducing a bug for an AI coding agent means describing a hundred little things: what you clicked, what the app requested, the error in the console, what you expected. Session Recorder captures all of it while you use your web app, then exports one clean report your agent can actually read — so it can reproduce the bug and reason about what went wrong.

Hit record, use your app like normal, then export. That's the whole loop.


WHAT IT CAPTURES

• Clicks, typing, scrolls, and keys — every interaction, with the element you touched
• Network activity — requests, responses, headers, timing, websockets, and failures (via Chrome's DevTools Protocol)
• Console logs, exceptions, and failed requests
• Page and SPA route changes as you move through the app
• Screenshots as you go, at a frequency you choose, with near-duplicate frames deduped
• Video of the tab, with its sound — pause and resume as you go; clips play inline in the report
• Text you select on the page, so a highlight becomes part of the story
• New tabs the app opens — recording follows you there and back
• Voice narration — talk through what you're doing while you record
• Annotations — freeze the screen and mark it up with arrows, boxes, highlights, and text
• Files you upload to the app, plus files you attach yourself
• Markers and notes you drop at the exact moment something matters
• Optionally, an OpenAPI spec compiled from the requests your app made

Everything lands on one timeline, in the order it happened, so the report reads as a coherent story instead of a pile of logs.


EVERYTHING STAYS ON YOUR MACHINE

There is no account and no backend. Sessions are stored locally in your browser and exported as a zip file you save yourself. Nothing is uploaded.

The only exception is voice transcription, and only if you turn it on: if you add your own API key for a transcription provider (Deepgram, OpenAI, or ElevenLabs), the recorded audio is sent to that provider to produce a text transcript. Without a key, audio never leaves your machine.


SECRETS ARE HIDDEN BY DEFAULT

Redaction is on out of the box. Authorization headers, token-like JSON and form fields, sensitive URL parameters, and password inputs are masked at capture time — before anything is written to storage. You can add your own rules, or turn redaction off per session, on the options page.


RIGHT-SIZED FOR ANY MODEL

Long sessions get big. At export you pick a detail level and see a live token estimate for each, so the report fits your model's context window:

• Full — everything, nothing omitted
• Standard — trimmed bodies, static assets and analytics collapsed
• Compact — bodies reduced to a shape summary, repeated requests collapsed
• Minimal — a concise narrative skeleton

Your explicit signals — voice transcript, annotations, markers, notes, errors, and file metadata — are never trimmed, at any level. The same recording can be re-exported at a different level later without recording again.


HOW TO USE THE REPORT

Unzip the export and hand report.md to your coding agent. It's a chronological narrative with [mm:ss] timestamps that ties interactions, network summaries, errors, narration, and annotations together. At the more compact levels it stands on its own without the asset files.


Built for developers. Manifest V3. Free and open source.

## Single-purpose statement (required field)

> Session Recorder has one purpose: to record a web-app session and export it as a
> structured, LLM-optimized report for debugging. Every permission and feature —
> network capture, screenshots, voice, annotations, file capture — serves that
> single recording-and-export purpose.

## Permission justifications (Dashboard asks per permission)

- **debugger** — Capture network request/response bodies, console logs, and
  exceptions via the Chrome DevTools Protocol. This is the only API that exposes
  response bodies and console streams; the recording is incomplete without it.
- **host_permissions `<all_urls>`** — The user points the recorder at whatever web
  app they are debugging. The app's domain is unknown in advance, so access
  cannot be scoped to a fixed host list.
- **tabs / webNavigation** — Track which tab is being recorded across multi-tab
  flows and capture navigation and SPA route changes.
- **scripting** — Inject the content scripts that record interactions,
  annotations, and file uploads on the recorded page.
- **storage / unlimitedStorage** — Persist the in-progress session to IndexedDB so
  it survives service-worker restarts; recordings can exceed default quotas.
- **sidePanel** — The recording and export UI.
- **offscreen** — Run `MediaRecorder` for voice narration and tab video in an
  offscreen document.
- **tabCapture** — Record the tab as video (with the tab's audio) when the
  user turns video capture on.
- **downloads** — Save the exported zip report to the user's machine.
- **alarms** — Periodically flush the buffered event queue while recording.

## Data Usage disclosures (Dashboard privacy tab)

Answer the certification form as follows:

- **What user data do you collect?**
  - "Website content" — yes (network, DOM interactions, screenshots captured
    during recording, stored locally)
  - "Audio" — yes, only when the user records voice narration
  - "Authentication information / personal communications / financial / health /
    location / web history / personally identifiable info" — not collected by the
    developer (data is local; redaction masks credentials by default)
- **Is data collected/transmitted to a server you control?** No.
- **Is data used for anything besides the single purpose?** No.
- **Is data sold or shared with third parties?** No. (User-initiated
  transcription sends audio to a provider chosen and keyed by the user; disclosed
  in the privacy policy.)
- **Do you use remote code?** No. All code is bundled in the package.
- **Privacy policy URL:**
  https://mohsen1.github.io/session-recorder-chrome-extension/privacy.html
  (published from `website/privacy.html` via GitHub Pages; use the custom-domain
  equivalent if configured)

## Store assets

- **Icon:** `public/icon/128.png` ✓
- **Screenshots (1280×800, ready to upload):** in `design/store/`, upload in
  order —
  1. `01-record.png` — side panel, ready to record the active tab
  2. `02-recording.png` — live timeline: interactions, screenshots, network
  3. `03-annotate.png` — annotating the page with an arrow + text callout
  4. `04-export.png` — export levels with token estimates, Download .zip

  These are exact 1280×800 (Chrome rejects other sizes). The same shots at 2×
  drive the website gallery (`website/shots/`).
- **Small promo tile (440×280):** not yet created (optional unless featured).

## Submission notes

- Expect **manual review and extra delay** because of `debugger` + `<all_urls>`.
  This is normal for this class of extension, not a rejection signal.
- Submit as **Unlisted** first: you get a real install link to validate the store
  build and permission prompts without public exposure, then flip to Public.
