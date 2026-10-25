# Comparison research notes

Checked: October 25, 2026. Primary vendor sources only. Update `scripts/website/pages-compare.mjs`
and rerun the build when these change.

| Vendor | Sources | Facts used | Deliberately omitted |
|---|---|---|---|
| Jam | https://jam.dev/pricing | Free $0, 30 Jams/month; Team $14 per creator/month billed yearly; Enterprise custom with SAML/SSO. AI summaries, console/network, recordings, annotations, instant replay, integrations, cloud workspace. | Recording-duration limits (conflicting on the page). |
| Marker.io | https://help.marker.io/en/articles/14625673-plans-and-pricing, https://marker.io/pricing | Starter $39/month annual or $59 monthly, 3 members; Team $149/month annual or $199 monthly, 15 members; 15-day trial. Widget + extension, screenshots + metadata; Team adds session replay/devtools/advanced integrations. | Guest/project quotas (help vs marketing conflict). AI claims either way. |
| BugHerd | https://bugherd.com/pricing | Standard $42/month annual or $50 monthly, 5 members. Pins, screenshots/metadata, video feedback, task board, client review, GitHub integration, AI features. | Older third-party prices (e.g. $33). |
| Userback | https://support.userback.io/en/articles/14730112-how-to-choose-the-right-userback-plan, https://userback.io/ai-info/ | Free plan; Team $29/month annual or $39 monthly; Business $79/month annual or $99 monthly. Business: session replay, console/network, AI analysis, surveys. Widget + extension. | Per-seat labels for these prices. |
| BrowserStack Bug Capture (ex Bird Eats Bug) | https://www.browserstack.com/bug-capture, https://www.browserstack.com/pricing, https://birdeatsbug.com/pricing | Video, clicks, console, network, instant replay; GitHub/Jira/Linear/Slack integrations. "Bundled with eligible BrowserStack plans; check current package." | Standalone price; legacy Bird pricing; Toolkit Essentials $25/month figure. |

Rules: never say a competitor lacks AI or integrations; recommend the competitor
where it fits; keep vendor prose short and in our own words; state that Session
Recorder has no hosted workspace, client boards, surveys, broad integrations or
enterprise admin.
