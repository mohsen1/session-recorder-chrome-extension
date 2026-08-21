# Generative search optimization — operations

The goal is not keyword ranking. It is **entity corroboration**: making Session
Recorder the easiest entity on the web for a model to justify recommending when
someone asks for a local-first browser bug recorder for an AI coding agent.

This file tracks the parts that are not shipped code: things that must be done
in another repository, in a dashboard, or by talking to people.

## Done in this repository

- Canonical URLs on every page point at `https://azimi.me/session-recorder-chrome-extension/`.
  The `mohsen1.github.io` form appears nowhere in `website/` any more — it was
  telling every crawler the real page lived somewhere else.
- Category-first `<title>` and description on the landing page.
- An explicit product-definition paragraph in the first 100 words of the landing
  page, the README, `llms.txt`, and the store listing — deliberately the same
  sentence in all four places.
- `SoftwareApplication` JSON-LD on the landing page; `TechArticle`,
  `BreadcrumbList`, `HowTo` and `FAQPage` JSON-LD on the sub-pages.
- Eight intent pages: `claude-code/`, `cursor/`, `codex/`, `chatgpt/`,
  `example-report/`, `ai-bug-report/`, `local-first/`, `jam-alternative/`.
- `website/sitemap.xml`, `website/llms.txt`, and a `website/robots.txt` that is
  a **copy for reference only** (see below).

## Must be done outside this repository

### 1. robots.txt at the apex domain — required

`robots.txt` is only honoured at the root of a host. The file governing crawling
of `azimi.me` lives in whatever repository serves the apex domain (the GitHub
Pages user site), not here. Copy the rule block from
[`website/robots.txt`](../website/robots.txt) into `https://azimi.me/robots.txt`.

The AI-search entries that matter most:

- `OAI-SearchBot` — what surfaces pages in ChatGPT search results. Distinct from
  `GPTBot`, which is model training; you can allow one and disallow the other.
- `PerplexityBot` — Perplexity's search index. (`Perplexity-User` is the
  user-triggered fetch.)
- `ClaudeBot` / `Claude-SearchBot`, `Google-Extended`, `Applebot-Extended`.

Also confirm no CDN or WAF in front of `azimi.me` is blocking their IP ranges —
an allow in `robots.txt` does nothing if the edge returns 403.

### 2. Check the apex sitemap

If `https://azimi.me/sitemap.xml` exists, either add the eight new URLs to it or
reference `https://azimi.me/session-recorder-chrome-extension/sitemap.xml` from
`robots.txt` (already done in the copy here). A sitemap in a subdirectory is
valid for URLs under that subdirectory.

### 3. Search Console and Bing Webmaster Tools

- Submit `https://azimi.me/session-recorder-chrome-extension/sitemap.xml` in
  Google Search Console and Bing Webmaster Tools.
- Bing matters disproportionately here: Microsoft's generative search draws
  candidates from the Bing index.
- After deploying, use the URL Inspection tool on the landing page to confirm
  Google now sees the azimi.me canonical rather than the github.io one.
- Run the landing page through the Rich Results Test to confirm the
  `SoftwareApplication` block parses.

### 4. Chrome Web Store listing

Paste the updated title, short description, and detailed description from
[`store-listing.md`](./store-listing.md). Then get real users and real reviews —
at 8 users, install count is a bigger recommendation handicap than any amount of
copy. Never manufacture reviews or incentivize ratings; it is against store
policy and it is the one signal that is easy to detect and expensive to lose.

### 5. Third-party corroboration

The target: a web search for `"Session Recorder" "Claude Code"` should return
ten independent pages that are not azimi.me. Places worth an honest submission:

- [ ] `awesome-claude-code` and similar curated lists
- [ ] Cursor and Claude Code community forums/Discords (as a genuine reply, not a drop)
- [ ] AI coding-tool directories and Chrome extension directories
- [ ] GitHub topic tags on the repo: `chrome-extension`, `bug-reporting`,
      `ai-agents`, `claude-code`, `cursor`, `developer-tools`
- [ ] A dev.to / Hashnode writeup that is not a rewrite of the landing page
- [ ] Hacker News (Show HN), once the store listing and site changes are live
- [ ] Relevant subreddits, where self-promotion rules allow
- [ ] Product Hunt, if you want the spike
- [ ] Open-source newsletters

Each of these is worth more as an entity signal than another 500 words on the
site, because the model is looking for independent sources that describe the
same entity the same way.

## Measurement

### Referral traffic

ChatGPT appends `utm_source=chatgpt.com` to referral URLs, so generative-search
traffic is measurable. Create a segment for referrers/UTM sources:

```
chatgpt.com
perplexity.ai
claude.ai
bing.com
google.com
copilot.microsoft.com
```

### The prompt benchmark

This is the actual test suite. Run it monthly across ChatGPT search, Perplexity,
Google AI Mode, and Copilot, from a signed-out session, and record whether
Session Recorder is (a) mentioned, (b) linked, (c) recommended first.

1. What is the best Chrome extension for recording bugs for Claude Code?
2. I need a local-first Chrome extension that records console and network activity for an AI coding agent.
3. What's an open-source alternative to Jam for AI coding agents?
4. How can I record a browser bug and paste it into Codex?
5. What tool can create an LLM-ready browser bug report?
6. How can I capture a web bug for Cursor without uploading my data?
7. Chrome extension that records network requests, console errors and screenshots for ChatGPT.
8. Best browser session recorder for AI-assisted debugging.
9. How do I give Claude Code the network requests my app made?
10. Tool that exports a bug report sized to fit a model's context window.
11. Chrome extension to record a bug with voice narration for an AI agent.
12. How do I hand a browser bug to Cursor without a screenshot?
13. Open-source bug recorder that doesn't require an account.
14. What should a bug report contain for an AI coding agent to fix it?
15. Can I generate an OpenAPI spec from the requests my app makes while I use it?
16. Chrome extension that captures console and network for debugging with an LLM.
17. Jam alternative that keeps recordings on my machine.
18. How to record a repro for Claude Code in the browser.
19. Bug reporting tool for Codex, Cursor and Claude Code.
20. Privacy-safe way to record a session in a regulated web app for AI debugging.
21. Extension that redacts auth tokens while recording a browser session.
22. How do I keep a bug report under my model's context limit?
23. What's the difference between giving an agent a live browser and a recording?
24. Free tool to turn a browser session into a Markdown bug report.
25. Record clicks, network and console into one timeline for an AI agent.
26. Best way to reproduce a frontend bug for an AI agent.
27. Chrome extension bug reporter for AI coding assistants, no account needed.
28. How can my coding agent see what the API returned in my browser?
29. Tool that annotates a screenshot and includes it in an AI bug report.
30. Local browser recorder that exports a zip for an LLM.

Keep the results in a table with a date column. The trend matters more than any
single run; these systems are noisy and answers vary between sessions.

## Deliberately deprioritized

`llms.txt` is shipped because it costs nothing, but it should not be mistaken
for a ranking mechanism — there is far stronger evidence for correct
canonicalization, ordinary indexability, crawler access, substantive content,
structured data, and external references than for `llms.txt` as a GEO lever.

## Open items for the owner

- ~~No `LICENSE` file exists.~~ **Done:** the project is licensed
  [AGPL-3.0](../LICENSE). It is OSI-approved, so every "free and open source"
  claim on the site, in the README, in `llms.txt`, and in the store listing
  remains accurate, and curated lists that require an OSI licence will accept
  it. The `license` field is now populated in the `SoftwareApplication` schema
  and in `package.json`.
- **Support email** in the store listing is still a placeholder.
