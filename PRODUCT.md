# Session Recorder by Proofline

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
- Proofline connection is optional. Explicitly choose Proofline credits, private hosted reports and GitHub App issue filing; standalone mode retains personal API keys and Cloudflare Access. Existing settings are preserved.
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

## Proofline Integration

The extension uses Proofline’s official mark, Geist typography, neutral console surfaces and ink primary controls. Record stays centered. An account link lives beside the brand; the paying workspace lives in Settings → Proofline, and service modes live in Settings → Services. Models remain automatic with an advanced override.

The existing 10,000-credit grant requires Proofline onboarding and GitHub App installation. Report readers are explicitly selected, and outside readers need a free Proofline account. Paid AI pauses at exhausted credits; personal keys are never a silent fallback. Publishing and issue requests save durable IDs before sending so retries resume their original operations.
