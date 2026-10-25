# Session Recorder SEO campaign — historical

> This is the October 17, 2026 campaign record, retained for its dated observations. The Proofline repository and website migration supersede its host-specific execution instructions. Revalidate measurements before using them. Current product behavior is in [README](../README.md); development and ownership are in [DEVELOPMENT](../DEVELOPMENT.md).

Start: 17 October 2026. First review: 24 October. Six-week review: 28 November.
Owner: Mohsen Azimi. This is the campaign execution record; `gso.md` contains
background and an optional generative-search benchmark.

## Positioning and outcome

For developers who can reproduce a browser bug but spend time reconstructing
it for a coding agent: Session Recorder captures browser evidence and exports
a Markdown bug report. Lead with that workflow. Free, open source and local
storage support the promise. Optional transcription sends audio to the chosen
provider; do not describe the product as universally offline.

The business outcome is more relevant installs and useful bug reports. Search
impressions, clicks and store visits are diagnostic measures, not the outcome.

## Baseline observed on 17 October 2026

- The public website responds HTTP 200 and already has crawlable HTML, canonical
  URLs, structured data and eight intent pages. Preserve those URLs.
- The project sitemap responds HTTP 200 and contains ten URLs before this change.
- `https://azimi.me/robots.txt` and `https://azimi.me/sitemap.xml` return HTTP 404.
  A missing robots file does not block crawling. Add a root robots file pointing
  at the existing project sitemap to improve discovery. An apex sitemap is not
  required for this project.
- The public Chrome Web Store listing is reachable and describes the product,
  but the search result still shows the generic name “Session Recorder” and
  summary “Record rich, multi-modal web-app sessions and export an LLM-optimized
  report.” Verify the live dashboard before updating it from `store-listing.md`.
- Search sampling found the repository, store listing and third-party extension
  listings for branded queries. This is evidence of discoverability, not a
  complete index audit or a reliable ranking baseline.
- Search Console clicks, impressions, CTR, indexing status and actual install
  attribution are **unknown**. No account data was available in this audit.

## Query-to-page map

These are intent hypotheses, not keyword-volume estimates. Validate them with
Search Console queries before commissioning more content. Each page should
answer a distinct question; improve an existing URL before making variants.

| Intent / example queries | Destination | Action |
| --- | --- | --- |
| browser bug recorder for AI agents; Chrome bug reporting extension | `/` | Keep the product definition and install CTA clear |
| bug report template for AI; browser bug report template Markdown | `/bug-report-template/` | New template, downloadable Markdown, filled example and handoff prompt |
| record browser bug for Claude Code | `/claude-code/` | Update from real workflow feedback |
| give Cursor console errors and network requests | `/cursor/` | Update from real workflow feedback |
| browser bug report for Codex | `/codex/` | Check local and cloud instructions against current product behavior |
| upload browser bug report to ChatGPT | `/chatgpt/` | Check attachment instructions against current product behavior |
| what should an AI bug report contain | `/ai-bug-report/` | Link to template and worked example |
| Markdown session recording example | `/example-report/` | Keep a concrete, sanitized artifact available |
| local-first bug recorder; open-source bug recording extension | `/local-first/` | Explain storage, redaction limits and transcription exception |
| Jam alternative for AI coding agents | `/jam-alternative/` | Recheck competitor facts before revising or distributing |

## Week-by-week execution

| Window | Work | Completion evidence |
| --- | --- | --- |
| 17–23 Oct | Merge the template/internal-link/sitemap PR and root robots PR. Confirm Pages deployments. Verify store visibility and update its descriptive title/summary. Establish Search Console and store baselines. | Live template and download return 200; root robots references the sitemap; dashboard export saved |
| 24–30 Oct | Submit the project sitemap in Google Search Console and Bing Webmaster Tools. Inspect homepage, template and two workflow URLs. Resolve any actual indexing/canonical errors. | Submission status and inspection results recorded; no assumed indexing |
| 31 Oct–6 Nov | Run one real bug from reproduction through a code fix. Publish a sanitized technical case study with the exact report, diagnosis, patch and verification. Add a short screen recording if available. | Reproducible example and source/patch links; no fabricated success claim |
| 7–13 Nov | Offer the useful case study to one relevant developer community and one curated open-source list, after checking submission rules. Disclose authorship. | Relevant published links or logged submissions; separate acceptance from submission |
| 14–20 Nov | Use Search Console to select a page with relevant impressions. Improve its title/description if the snippet is unclear, or content if it misses the query. Fix onboarding problems reported by actual users. | Query/page evidence, one documented change and user feedback |
| 21–27 Nov | Compare the first complete 28-day period with the available prior period. Identify which pages attract relevant traffic and which sources send users who install. | Written review on 28 Nov; next actions based on data |

Publishing community posts or sending outreach requires a specific instruction
from Mohsen. Drafts below are ready for review; they have not been posted or sent.
No paid promotion or recurring automation is part of this launch.

## Measurement and decisions

Create a Search Console domain property for `azimi.me` if one is not already
verified, or use a verified URL-prefix property for this project. Submit:
`https://azimi.me/session-recorder-chrome-extension/sitemap.xml`.
In URL Inspection check the selected canonical and indexing status, not just
whether a live fetch succeeds. A sitemap submission does not guarantee indexing.

Every Saturday export the previous complete seven days, noting Search Console
reporting delays. Filter page URLs to this project's prefix and keep the same
country/device/search-type filters. Save query and page breakdowns. Record:

| Metric | Source | Starting value |
| --- | --- | --- |
| Indexed campaign URLs / submitted URLs | Search Console | Unknown; verify after submission |
| Nonbranded organic clicks and impressions | Search Console query/page export | Unknown |
| Organic CTR by landing page | Search Console | Unknown; do not compare unlike query mixes |
| Store page visits, installs and uninstalls | Web Store dashboard, where available | Unknown |
| Relevant referring pages | Verified public links / webmaster reports | Not yet counted |
| Reports successfully exported by recruited testers | Voluntary user feedback | Not yet measured |

Keep branded and nonbranded queries separate using an explicit reviewed query
list. Do not treat the generic phrase “session recorder” as automatically branded.
Search Console omits some queries, so query totals may differ from page totals.
Do not add extension telemetry merely to run this campaign: the product promises
no telemetry. Store visits and installs may only be available in aggregate;
without attribution, do not call all install growth an SEO result.

Use campaign parameters on links in future approved external posts, for example:
`?utm_source=devto&utm_medium=community&utm_campaign=seo_2026_10`.
These are a naming convention, not working analytics: parameters alone collect
nothing. Confirm website analytics access and reporting before relying on them.

Decision rules:

- If pages are excluded for a genuine technical reason, fix that before expanding
  content. Do not interpret low impressions alone as an indexing defect.
- If relevant impressions rise but clicks do not, review the actual query/snippet
  match. Avoid broad clickbait and keyword stuffing.
- If visits rise without installs, inspect the listing, screenshots, permissions
  explanation and first recording experience.
- If the six-week sample is too small, extend measurement instead of declaring
  success or failure. Set numeric growth goals after a complete baseline exists.

## Launch copy for review

### Short developer-community post

I built Session Recorder because I kept moving between a broken web app and my
coding agent to copy console errors, network responses and screenshots.

It is a free, open-source Chrome extension that records the reproduction and
exports a Markdown timeline for Claude Code, Cursor, Codex or ChatGPT. Sessions
stay in your browser; optional voice transcription uses your chosen provider.

I also wrote a browser bug report template you can use without the extension:
https://azimi.me/session-recorder-chrome-extension/bug-report-template/

If you try it on a real bug, which evidence was missing from the report?

### Technical article brief

Working title: “From a failed browser request to a fix: the bug report I gave my
coding agent.” Start with one real symptom, show the sanitized timeline, show
which evidence changed the diagnosis, then link the patch and verify the repro.
Include a failed hypothesis if one occurred. Link naturally to the template and
relevant agent workflow; do not rewrite the landing page. Do not publish the
illustrative checkout example as a real customer result.

### Curated-list submission draft

Session Recorder — free, AGPL-3.0 Chrome extension that records browser
interactions, console errors, network activity and screenshots into a Markdown
bug report for AI coding agents. Local recording storage; optional transcription
uses a configured provider. Source:
https://github.com/mohsen1/session-recorder-chrome-extension

Check list eligibility, link format, activity requirements and contribution
instructions before submitting. Disclose that the submitter is the author.

## Reference guidance

- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Chrome Web Store listing guidance](https://developer.chrome.com/docs/webstore/best-listing)

Use accurate useful content, descriptive links and factual metadata. Existing
FAQ/HowTo markup does not establish rich-result eligibility, and app markup
without required review/rating properties should not be sold as a guaranteed
rich result. Never invent reviews, ratings, downloads or ranking results.
