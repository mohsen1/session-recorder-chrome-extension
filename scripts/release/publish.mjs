import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validateRelease } from './version.mjs';

export const ITEM_ID = 'dboiheheijgmfpfhbmjggiijpgondghh';
const API = 'https://chromewebstore.googleapis.com';
const activeStates = new Set(['PENDING_REVIEW', 'STAGED', 'PUBLISHED', 'PUBLISHED_TO_TESTERS']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const versions = (revision) => revision?.distributionChannels?.map((channel) => channel.crxVersion) ?? [];
function validateRevision(revision, states) {
  if (!revision) return;
  if (!states.has(revision.state) || !Array.isArray(revision.distributionChannels) || !revision.distributionChannels.length) {
    throw new Error('Unknown store revision state or version. Inspect the publisher dashboard before releasing.');
  }
  for (const version of versions(revision)) {
    if (typeof version !== 'string' || !/^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,3}$/.test(version) || version.split('.').some((part) => Number(part) > 65535)) {
      throw new Error('Unknown store revision version. Inspect the publisher dashboard before releasing.');
    }
  }
}
function compare(a, b) {
  for (let i = 0; i < 4; i++) {
    const difference = (Number(a.split('.')[i]) || 0) - (Number(b.split('.')[i]) || 0);
    if (difference) return difference;
  }
  return 0;
}

// Mutations are never retried automatically. A lost response requires a status
// check on the next run; an accepted submission is recognized before any upload.
export async function publish({ publisherId, token, version, zip, fetchImpl = fetch, wait = sleep, maxPolls = 60 }) {
  validateRelease(`v${version}`, version);
  if (!publisherId || !/^[A-Za-z0-9_-]+$/.test(publisherId)) throw new Error('Set CWS_PUBLISHER_ID to the publisher ID from the Web Store dashboard.');
  if (!token) throw new Error('A short-lived Chrome Web Store access token is required.');
  const name = `publishers/${publisherId}/items/${ITEM_ID}`;
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${API}/${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, ...options.headers },
        signal: AbortSignal.timeout(120_000),
        redirect: 'error',
      });
    } catch {
      throw new Error('Chrome Web Store response was lost. Check the dashboard before retrying; no mutation was automatically repeated.');
    }
    if (!response.ok) {
      // Do not print provider payloads or headers: they can contain credentials
      // or private listing validation details. The dashboard owns those details.
      throw new Error(`Chrome Web Store API returned HTTP ${response.status}. Check the publisher dashboard; no mutation was automatically repeated.`);
    }
    try { return await response.json(); }
    catch { throw new Error('Chrome Web Store returned an unreadable response. Check the dashboard before retrying.'); }
  }
  const status = await request(`v2/${name}:fetchStatus`);
  if (status.takenDown || status.warned) throw new Error('Resolve the item policy warning or takedown in the publisher dashboard before release.');
  const published = status.publishedItemRevisionStatus;
  const submitted = status.submittedItemRevisionStatus;
  validateRevision(published, new Set(['PUBLISHED', 'PUBLISHED_TO_TESTERS']));
  validateRevision(submitted, new Set([...activeStates, 'REJECTED', 'CANCELLED']));
  if (activeStates.has(published?.state) && versions(published).some((v) => compare(v, version) === 0)) {
    return `Version ${version} is already published (${published.state}); no changes made.`;
  }
  if (activeStates.has(submitted?.state)) {
    if (versions(submitted).length && versions(submitted).every((v) => compare(v, version) === 0)) {
      return `Version ${version} is already submitted (${submitted.state}); no changes made.`;
    }
    throw new Error('Another revision is submitted or staged. Finish it in the publisher dashboard before releasing this version.');
  }
  if ([...versions(published), ...versions(submitted)].some((v) => compare(v, version) >= 0)) {
    throw new Error('The release version must be newer than every published, rejected or cancelled store revision.');
  }
  if (status.lastAsyncUploadState === 'IN_PROGRESS') {
    throw new Error('An earlier upload is still processing. Wait for it in the dashboard before retrying.');
  }
  const upload = await request(`upload/v2/${name}:upload`, {
    method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: zip,
  });
  if (upload.crxVersion && upload.crxVersion !== version) throw new Error('The uploaded package version differs from the release; it was not submitted.');
  let uploadState = upload.uploadState;
  for (let poll = 0; uploadState === 'IN_PROGRESS' && poll < maxPolls; poll++) {
    await wait(5000);
    const pending = await request(`v2/${name}:fetchStatus`);
    if (pending.submittedItemRevisionStatus && activeStates.has(pending.submittedItemRevisionStatus.state)) {
      throw new Error('Submission changed while uploading. Inspect the dashboard; this run will not publish it.');
    }
    uploadState = pending.lastAsyncUploadState;
  }
  if (uploadState !== 'SUCCEEDED') throw new Error(`Upload did not complete successfully (${uploadState || 'unknown'}). The package was not submitted.`);
  const result = await request(`v2/${name}:publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH', skipReview: false, blockOnWarnings: true }),
  });
  if (!['PENDING_REVIEW', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'].includes(result.state)) {
    throw new Error(`Unexpected publication state (${result.state || 'unknown'}). Check the publisher dashboard; no retry was sent.`);
  }
  return `Version ${version}: ${result.state}. Store availability follows Google's review and the existing listing visibility/rollout settings.`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const manifest = JSON.parse(readFileSync('release-assets/manifest.json', 'utf8'));
    const version = validateRelease(process.env.RELEASE_TAG, JSON.parse(readFileSync('package.json', 'utf8')).version, manifest.version);
    const message = await publish({
      publisherId: process.env.CWS_PUBLISHER_ID,
      token: process.env.CWS_ACCESS_TOKEN,
      version,
      zip: readFileSync('release-assets/session-recorder.zip'),
    });
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
