# Chrome Web Store listing

Publication copy for **Session Recorder by Proofline**. Match the submitted package and deployed services; this file does not establish that a store update or publisher transfer has happened.

## Listing identity

- Item ID: `dboiheheijgmfpfhbmjggiijpgondghh`.
- Name: Session Recorder by Proofline.
- Category: Developer Tools.
- Language: English.
- Source and issue support: https://github.com/prooflinedev/session-recorder-chrome-extension.
- Website destination: https://proofline.sh/session-recorder-chrome-extension/.
- Privacy policy destination: https://proofline.sh/session-recorder-chrome-extension/privacy.html.

Keep the existing item ID and install link when transferring to the Proofline publisher. GitHub repository ownership and Chrome Web Store publisher ownership are separate. Confirm the active publisher, public support email, visibility and working website/privacy URLs in the dashboard before submission. The backend and website are deployed; managed speech still requires provider configuration.

## Short description

Record browser bugs with screenshots, annotations, console, network and voice. Export a report or file a GitHub issue.

## Detailed description

Session Recorder by Proofline is a free, open-source Chrome extension for QA and product teams. Record a browser bug, point out what went wrong, and give a developer or coding agent the evidence to investigate it.

RECORD THE REPRODUCTION

Capture clicks, inputs, navigation, console messages, exceptions, network requests and responses, and screenshots. Recording follows tabs opened by the recorded app. Optional microphone narration, tab video with sound, files, markers and notes stay on the same timeline.

POINT OUT THE PROBLEM

Toggle annotation while recording. Select a page element or drag a freeform rectangle and add a comment. Dictate into the comment using the recording microphone, or mark up a screenshot with arrows, boxes and text.

FILE AN ISSUE

Configure a GitHub repository and protected Cloudflare publishing once. After stopping, review the full-page report and select File issue. With an AI provider configured, the extension automatically creates an editable summary, publishes the report and files the issue with a link. The repository picker supports multiple destinations and remembers your last choice for new reports.

Annotations and narration lead the summary; background diagnostics support them. Configured AI also names stopped sessions. Personal providers include OpenAI, OpenAI-compatible endpoints, Anthropic and Google. Voice transcription supports Deepgram, ElevenLabs and OpenAI-compatible services. Provider and hosting charges are separate from the free extension.

EXPORT FOR A CODING AGENT

Recording, annotations and local ZIP export require no account or API key. Give report.md and the included assets to Claude Code, Codex, Cursor, ChatGPT or another coding agent. Full, Standard, Compact and Minimal export levels let you choose how much evidence to include. Trimming runs locally without an LLM and preserves protected signals such as annotations, narration, notes and errors.

LOCAL STORAGE AND OPTIONAL SHARING

Sessions stay in Chrome locally by default. Redaction masks common credentials and structured sensitive fields during capture. Screenshots, audio, files and arbitrary text can still contain private information. Optional transcription sends audio to the service you select; AI sends bounded text evidence. Publishing uploads the report and included attachments. A protected report link does not make public GitHub issue text private.

## Managed-service copy

The public listing's paragraph that says the backend deployment is pending is obsolete. Replace it with:

> The optional Proofline account connection remains in preview. The Proofline backend is deployed. Managed speech is unavailable until its providers are configured. Personal API keys and your own Cloudflare account work independently.

After authorized customer acceptance, use the following paragraph to describe the managed services:

> Connect Proofline to use workspace credits for AI and share private reports with selected readers. The existing 10,000-credit grant requires Proofline onboarding and GitHub App installation. Personal API keys and your own Cloudflare account remain supported. Outside report readers need a free Proofline account. Paid AI pauses when credits are unavailable; the extension does not silently switch to personal keys.

## Single purpose

Record a web-app session and turn its evidence into a debugging report. Capture, annotation, transcription, report export and issue filing support that purpose.

## Permission justifications

| Permission | Purpose |
| --- | --- |
| `debugger` | Capture network request/response details, console messages, exceptions and screenshots through CDP. Chrome shows its debugger banner while attached. |
| `<all_urls>` | Record the web application the user selects; the application domain is not known in advance. |
| `tabs`, `webNavigation` | Track recorded tabs and page/SPA navigation. |
| `scripting` | Activate interaction, annotation and file capture content scripts. |
| `storage`, `unlimitedStorage` | Persist settings, sessions, events and assets locally. |
| `sidePanel` | Present recording controls and session list. |
| `offscreen` | Record microphone and tab media in an offscreen document. |
| `tabCapture` | Record the selected tab's video and sound when enabled. |
| `downloads` | Save exported report ZIPs. |
| `alarms` | Flush buffered capture events during recording. |

## Privacy disclosures

Use [PRIVACY.md](PRIVACY.md) and the actual package to complete the dashboard form. Do not reuse the old “no server you control” answer for a release with managed Proofline services enabled.

- Captured website content can include personal or sensitive information. Redaction reduces exposure; it does not justify declaring those data categories impossible.
- Audio and tab video are captured only when enabled.
- Personal transcription sends audio to the selected provider. Personal AI sends text to the configured provider; vocabulary extraction can include bounded visible page labels.
- Managed AI sends relevant text or audio through Proofline to configured providers. Usage is recorded against the selected workspace.
- Publishing sends the report and included assets to Proofline or the user's Cloudflare account. GitHub receives the issue title, summary and report link.
- Credentials stay in trusted extension storage and are sent to their configured service; they are not report attachments.
- The extension has no advertising or analytics and does not sell recorded data. It does transmit data to optional processing services, so do not describe all third-party sharing as absent.
- Extension code is bundled locally. Provider responses are data, not remotely executed extension code.

## Assets and release

Use screenshots of the package being submitted. [`docs/screenshots/`](screenshots/) contains the documentation captures; [`design/store/`](../design/store/) contains store-sized assets. Recheck older store images against the new branding and live-annotation UI before upload. Do not present mock account balances or fabricated bug reports as real customer data.

The release workflow attaches `session-recorder.zip` and its SHA-256 checksum to a published GitHub release. The stable asset path is `https://github.com/prooflinedev/session-recorder-chrome-extension/releases/latest/download/session-recorder.zip`; it works only after a release containing that asset exists. After validating the version and package, the workflow submits that same ZIP to Chrome Web Store for review using the configured publisher account. See [Chrome Web Store publishing](chrome-store-publishing.md) for account setup, version tags and recovery; submission does not mean Google has approved the update.
