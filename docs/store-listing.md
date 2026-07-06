# Chrome Web Store listing — Session Recorder

Copy/paste source for the Developer Dashboard. Keep this in sync with the actual
behavior and with `docs/PRIVACY.md`.

## Basics

- **Name:** Session Recorder
- **Category:** Developer Tools
- **Language:** English
- **Visibility:** Unlisted (recommended for first submission — see notes below)

## Short description (≤132 chars)

> Record a web session — clicks, network, screenshots, voice — and export an
> LLM-ready bug report. Everything stays on your machine.

## Detailed description

> Session Recorder captures a full session of someone using a web app and exports
> a single zip whose `report.md` is written for an LLM coding agent, so the agent
> can reproduce bugs and analyze behavior.
>
> **What it captures**
> - Network requests, responses, headers, timing, and websockets (via Chrome's
>   debugger/CDP)
> - Console logs, exceptions, and failed requests
> - Clicks, inputs, scrolls, keys, and SPA navigations
> - Screenshots at a configurable frequency, with near-duplicates deduped
> - Voice narration, with optional cloud transcription
> - Annotations drawn on the page, and files you upload or attach
>
> **Your data stays local.** There is no account and no backend. Sessions live in
> your browser and export as a zip you save yourself. The only data that ever
> leaves your machine is audio you choose to transcribe with your own third-party
> API key.
>
> **Redaction on by default.** Auth headers, token-like fields, sensitive URL
> params, and passwords are masked at capture time, before anything is stored.
>
> **Deterministic trimming.** Export at four verbosity levels (Full → Minimal),
> each with a live token estimate, without ever trimming your explicit signals:
> transcript, annotations, markers, notes, errors, and file metadata.

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
- **offscreen** — Run `MediaRecorder` for voice narration in an offscreen
  document.
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
- **Privacy policy URL:** <host docs/PRIVACY.md and paste the URL here>

## Store assets

- **Icon:** `public/icon/128.png` ✓
- **Screenshots (need 1280×800 or 640×400):** source frames in
  `design/screenshots/` — `idle.png`, `recording.png`, `annotate.png`,
  `export.png`. Verify/resize to an accepted size before upload.
- **Small promo tile (440×280):** not yet created (optional unless featured).

## Submission notes

- Expect **manual review and extra delay** because of `debugger` + `<all_urls>`.
  This is normal for this class of extension, not a rejection signal.
- Submit as **Unlisted** first: you get a real install link to validate the store
  build and permission prompts without public exposure, then flip to Public.
