# Session Recorder

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

QA and product teams reporting bugs. They record a reproduction in Chrome, point out the problem, and hand actionable evidence to a developer.

## Product Purpose

Turn a recorded browser session into a useful GitHub issue without manually assembling screenshots, logs, and reproduction context. The core flow is record → annotate → file an issue in one click.

## Capabilities and Constraints

- Chrome extension built with WXT, React and TypeScript.
- Live element annotations can be toggled while recording; screenshot markup remains available.
- Once configured, filing automatically generates an LLM summary, publishes the report to Cloudflare Pages, and creates a GitHub issue linking to it.
- Reports require Cloudflare Access login by default. Users configure their own publishing and model credentials.
- Model integrations support OpenAI, compatible endpoints, Anthropic and Google.
- State belongs in focused hooks and reducers; avoid effects for user-action orchestration.
- No mandatory report-review acknowledgment checkbox.
- Multiple GitHub repositories have separate credentials. The File issue dropdown remembers the last selection for new reports, while existing drafts retain their destination.
- Annotations and notes lead issue summaries; background diagnostics are supporting evidence. Configured models also name new stopped sessions automatically without blocking the report.
- Filing opens a full-page stage indicator with Cancel. Cancellation preserves checkpoints; uncertain GitHub requests are checked before any retry to avoid duplicates.

## Product Principles

- Make reproducing and communicating a bug the central workflow.
- Configure integrations once; keep routine filing to one action.
- Preserve captured evidence and user-written context.
- Keep credentials outside published reports.

## Evidence on Hand

The repository contains a demo app and automated browser tests. A real recording, annotation, automatic summary, protected deployment and GitHub issue have been exercised. Test issue #7 was closed after verification.

## Confirmed Design References

The user names Linear and Raycast as references: compact, clean, with sharp typography. The current UI has too much text, too many boxes, and oversized buttons. Recording and filing an issue must be obvious; advanced functionality should stay out of the primary flow. These are explicit user constraints for the redesign, not approval to copy either application's branding.

## Approved Design

The user selected **Report first** on October 24, 2026: a full-page document with a narrow navigation rail, prominent File issue action, evidence below the draft, and secondary metadata. Stopping opens this report automatically. Compact light and dark themes follow system appearance. Advanced technical and publishing controls stay in disclosures.

Live annotations follow the supplied Codex reference: click an element or drag a freeform rectangle, then use an anchored minimal comment bar with numbered pins. Screenshot markup remains available. The replacement system supersedes the previous card-heavy design.
