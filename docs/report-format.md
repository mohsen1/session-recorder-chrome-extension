# Report format & LLM handoff

This document describes the **exported zip** a recorded session produces, and how
to hand `report.md` to an LLM coding agent so it can diagnose what the user did
and what went wrong.

The zip is assembled by [`lib/export/bundle.ts`](../lib/export/bundle.ts) →
[`lib/export/zip.ts`](../lib/export/zip.ts); the human-readable report is rendered
by [`lib/export/markdown.ts`](../lib/export/markdown.ts); the trimming that
determines what each verbosity level contains lives in
[`lib/export/trimmer.ts`](../lib/export/trimmer.ts).

## Zip layout

Every path is prefixed with a single root directory named after the session, so
the archive unpacks into one folder:

```
<session-name>/
  report.md            # the LLM entry point — self-sufficient at L2/L3
  session.json         # trimmed event stream + session meta, asset refs → zip paths
  MANIFEST.md          # index of every included asset (path, kind, size)
  transcript.json      # voice segments (timestamps + transcript), when audio was recorded
  screenshots/
    001-0004.jpg       # {seq}-{mmss}.jpg — seq order, timestamp in the name
    002-0011.jpg
    …
  network/
    001-api.example.com-todos.json   # {seq}-{host}-{path-slug}.json — full request/response
    …
  files/
    import.csv         # {original-name} — files the user uploaded/attached
    …
  audio/
    001.webm           # {seq}.webm — recorded voice segments
    …
```

Notes:

- **`report.md` is the primary artifact.** It is a single chronological narrative
  with `[mm:ss]` timestamps, section breaks at navigations/tab switches, fenced
  network bodies and console/error output, screenshot references, and loud
  blockquotes for the user's markers and notes. At **L2/L3 it is designed to be
  self-sufficient** — an agent can answer "what happened and what went wrong?"
  without opening any asset.
- **`session.json`** is the machine-readable mirror: the trimmed event stream
  (same events, same order as the report) plus session metadata, with all asset
  references rewritten to their zip-relative paths. Use it when you want to
  program against the events rather than read prose.
- **`MANIFEST.md`** lists every asset actually included in the zip (some are
  dropped at higher verbosity levels — see below), so the report never points at
  a file that isn't there.
- **Asset naming embeds sequence + timestamp** (`{seq}-{mmss}`) so files sort in
  capture order and cross-reference the `[mm:ss]` marks in `report.md`.
- Only assets still referenced by a surviving event are included — with the
  exception of annotation screenshots, audio, and file assets, which are
  **always** included regardless of level (they are protected signal).

## Verbosity levels

Levels are **cumulative transform pipelines**, not budget solvers: each higher
level runs the previous level's transforms plus a few more, so the output is
deterministic and explainable. The token figures below are calibration targets
(chars/4 estimate), not hard runtime limits.

| Level | Target | What it contains |
| ----- | ------ | ---------------- |
| **L0 — Full** | everything | No trimming. Full request/response bodies up to the capture cap, every screenshot, every event. The complete fidelity that lives in IndexedDB. |
| **L1 — Standard** | ~150k tokens | Static-asset requests (images/fonts/css + analytics hosts) collapsed to one summary line; response bodies truncated to the first ~4 KB (original size noted); consecutive scrolls coalesced; consecutive duplicate console lines deduped with counts; screenshots thinned to key moments; near-duplicate screenshots already folded. |
| **L2 — Compact** | ~50k tokens | Everything in L1, plus: JSON bodies reduced to a **shape summary** (keys + types + array lengths, e.g. `{ users: Array(50) of { id, name, email } }`); repeated calls to the same endpoint collapsed to the first occurrence + a `×N similar` marker (requests with a *differing* status stay full — anomalies are signal); screenshots kept only for annotations and errors. |
| **L3 — Minimal** | ~15k tokens | Everything in L2, plus: network bodies dropped except those linked to an error or `status >= 400`; interactions stripped to element text/selector only; screenshots reduced to a filename manifest. A narrative skeleton: navigations, clicks, transcript, markers/notes, annotations, and errors with request/response one-liners. |

Pick the **lowest level that fits the target model's context window** while still
containing the bodies/screenshots the question needs. For most debugging, **L2 is
the sweet spot**: it stays readable and self-sufficient while fitting comfortably
in a large context. Drop to L3 only when the session is very long or the model's
window is tight; go to L1/L0 when you specifically need full response bodies.

### What is never trimmed (at any level)

The trimmer skips any event where `isProtected(e)` is true. That covers, at every
level including L3:

- **markers** and **notes** (the user's explicit signals),
- **errors** (`error` events) and the network requests they link to via
  `linkedRequestId` (those bodies stay full),
- **annotations** and their screenshots,
- **voice segments** / transcript,
- **file** captures/attachments (metadata always; the file asset is always
  included in the zip),
- **session notes** (rehydrate/detach/info/warning).

Any event explicitly flagged `protected: true` is likewise preserved. So no
matter how aggressively you trim for token budget, the user's intent and every
error survive.

## Handing `report.md` to an LLM coding agent

1. **Unzip** the archive. Everything the agent needs to read is `report.md`.
2. **Paste `report.md`** into the agent (or attach the whole unzipped folder if
   the agent can browse files — then it can also open the referenced screenshots
   and `network/*.json` bodies).
3. If the report is long, prefer exporting at **L2** first; only re-export at a
   lower or higher level if the agent asks for more/less detail. Re-export is
   free and lossless-from-source because full fidelity is retained in IndexedDB.

### Suggested prompt

> You are a debugging assistant. Below is `report.md` — a chronological recording
> of a user session in a web app, captured by a browser extension. Timestamps are
> `[mm:ss]` from the start of the session and are the join key across events,
> screenshots, and the voice transcript. Section headings (`##`) mark navigations
> and tab switches. Network requests show method, URL, status, and (depending on
> verbosity) bodies or a JSON shape summary; a `×N similar` marker means repeated
> identical calls were collapsed. Errors are prefixed with `⚠`. The user's own
> markers and notes appear as blockquotes and are the most important signal.
>
> Please:
> 1. Summarize what the user was trying to do, step by step.
> 2. Identify what went wrong — the first error and its likely root cause, citing
>    the `[mm:ss]` timestamps and the specific requests/console lines involved.
> 3. Suggest the concrete code change or investigation that would fix it.
>
> If a detail you need was trimmed (e.g. a full response body), say which
> `[mm:ss]` event you'd want re-exported at a higher verbosity level.
>
> ```
> <paste report.md here>
> ```

### Tips

- **Cite timestamps.** Asking the agent to reference `[mm:ss]` keeps its answer
  verifiable against the report and the screenshots.
- **Trust the blockquotes.** Markers/notes are the user narrating their own
  intent — they are never trimmed and are the best anchor for "what was expected."
- **Follow `linkedRequestId`.** Errors point at the network request that caused
  them; at every level that request's body is preserved, so the agent can inspect
  the exact failing payload.
- **Escalate verbosity surgically.** If the agent needs one full body, re-export
  at L1/L0 rather than dumping the whole session at full fidelity.
