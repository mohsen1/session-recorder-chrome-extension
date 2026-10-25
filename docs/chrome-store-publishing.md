# Publish a Chrome Web Store release

Publishing a stable GitHub release tagged `vMAJOR.MINOR.PATCH` runs
`.github/workflows/release.yml`. The workflow validates the tag against
`package.json` and the built manifest, runs the extension checks, and attaches
`session-recorder.zip` and its SHA-256 checksum to the release. It then uploads
the same package to the existing Chrome Web Store item
`dboiheheijgmfpfhbmjggiijpgondghh` and submits it for Google's review.

A successful submission is not proof that the update is live. Google publishes
it after approval using the listing's existing visibility and rollout settings.
The workflow does not change the publisher, store description, screenshots,
privacy disclosures or visibility. Update those in the publisher dashboard.

## Account setup

The workflow uses GitHub OIDC and Google Workload Identity Federation. It creates
no service-account key and needs no OAuth refresh-token secret. The Google
access token lasts 15 minutes and has only the
`https://www.googleapis.com/auth/chromewebstore` scope.

The repository variables are:

| Variable | Value |
| --- | --- |
| `CWS_WORKLOAD_IDENTITY_PROVIDER` | `projects/376004211572/locations/global/workloadIdentityPools/recorder-publishing/providers/github-release` |
| `CWS_SERVICE_ACCOUNT` | `recorder-store-publisher@proofline-ci.iam.gserviceaccount.com` |
| `CWS_PUBLISHER_ID` | The publisher ID from the Chrome Web Store Developer Dashboard |

The first two variables and their Google identity configuration are configured.
The provider trusts only the immutable repository and owner IDs for
`prooflinedev/session-recorder-chrome-extension`, `release` events, `v` tag refs,
and this repository's `.github/workflows/release.yml` workflow at that tag.
The `chrome-web-store` GitHub environment can add approval restrictions if the
publisher requires them.

The Chrome Web Store API is enabled in `proofline-ci`. Before publishing, link the
service account in the publisher dashboard's Account section, and set
`CWS_PUBLISHER_ID`. The dashboard supports one linked service account per
publisher. Linking it grants access to that publisher's items; use the intended
Proofline publisher and preserve the existing extension item ID. A GitHub
repository transfer does not transfer Chrome Web Store ownership.

Missing variables fail the publishing job before authentication. An unlinked
service account fails with an API permission error; it does not silently skip
publishing.

## Cut a version

1. Increase `version` in `package.json`. WXT uses it for the manifest. Use three
   integer components, each from 0 through 65535, without leading zeros.
2. Complete the relevant tests and merge the release changes.
3. Create a tag such as `v0.2.2` on the tested commit, then publish its GitHub
   release. The tag must match the package and manifest versions exactly.
4. Read the **Publish extension release** workflow result and then the Chrome Web
   Store dashboard for review status.

Drafts do not publish. Prereleases and nonmatching version tags fail validation.
A tag push alone does not publish. The production backend and store disclosures
must support every managed feature advertised by the released extension.

## Retry a failed run

Fix account configuration, then rerun the failed jobs of the original release
workflow. The build artifact is retained for 30 days. The workflow refuses to
replace release assets with different bytes.

The publisher checks store status before uploading. A version already published,
in review or staged needs no second submission. Another active review blocks the
release; the workflow never cancels it. Rejected or cancelled versions require a
newer version. Uploads must finish successfully before submission.

A lost upload or publish response is ambiguous. Inspect the dashboard before
retrying. The script sends each mutation once; a later run recognizes an accepted
submission from its version. An unknown or unfinished upload fails rather than
publishing an unverified draft.

All release runs share one concurrency group. GitHub keeps one active and one
pending run; avoid cutting several versions while a release is still active.

## Verify the publishing code

Run `node --test scripts/release/*.test.mjs`. These tests mock the official API;
they do not upload or submit a real extension. The release build also runs them.
A live publication requires the configured publisher account and a new version.

References: [Chrome Web Store API usage](https://developer.chrome.com/docs/webstore/using-api),
[service accounts](https://developer.chrome.com/docs/webstore/service-accounts),
[upload](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/media/upload),
[status](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/fetchStatus),
and [publication](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish).
