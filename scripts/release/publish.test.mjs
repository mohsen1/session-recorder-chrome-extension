import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publish, ITEM_ID } from './publish.mjs';
import { validateRelease } from './version.mjs';

const revision = (state, version) => ({ state, distributionChannels: [{ crxVersion: version }] });
const base = { publishedItemRevisionStatus: revision('PUBLISHED', '0.2.0') };
function fixture(responses) {
  const calls = [];
  return {
    calls,
    options: {
      publisherId: 'publisher-123', token: 'secret-do-not-print', version: '0.2.1', zip: Buffer.from('zip'), wait: async () => {},
      fetchImpl: async (url, options) => {
        calls.push({ url, ...options });
        const next = responses.shift();
        if (next instanceof Error) throw next;
        assert.ok(next, 'unexpected API call');
        return new Response(JSON.stringify(next.body ?? next), { status: next.http ?? 200 });
      },
    },
  };
}

test('only matching, Chrome-compatible stable tag versions can reach publishing', () => {
  assert.equal(validateRelease('v1.2.3', '1.2.3', '1.2.3'), '1.2.3');
  for (const tag of ['1.2.3', 'v01.2.3', 'v1.2.3-beta', 'v1.2.3.4', 'v65536.2.3', 'v0.0.0', 'v1.2.3\n']) {
    assert.throws(() => validateRelease(tag, '1.2.3'));
  }
  assert.throws(() => validateRelease('v1.2.3', '1.2.2', '1.2.3'));
  assert.throws(() => validateRelease('v1.2.3', '1.2.3', '1.2.2'));
});

test('uploads only after status admission and submits for normal review', async () => {
  const f = fixture([base, { uploadState: 'SUCCEEDED', crxVersion: '0.2.1' }, { state: 'PENDING_REVIEW' }]);
  assert.match(await publish(f.options), /PENDING_REVIEW/);
  assert.deepEqual(f.calls.map((c) => [c.url, c.method ?? 'GET']), [
    [`https://chromewebstore.googleapis.com/v2/publishers/publisher-123/items/${ITEM_ID}:fetchStatus`, 'GET'],
    [`https://chromewebstore.googleapis.com/upload/v2/publishers/publisher-123/items/${ITEM_ID}:upload`, 'POST'],
    [`https://chromewebstore.googleapis.com/v2/publishers/publisher-123/items/${ITEM_ID}:publish`, 'POST'],
  ]);
  assert.deepEqual(JSON.parse(f.calls[2].body), { publishType: 'DEFAULT_PUBLISH', skipReview: false, blockOnWarnings: true });
});

test('a rerun skips the exact version already published, in review or staged', async () => {
  for (const [field, state] of [['publishedItemRevisionStatus', 'PUBLISHED'], ['submittedItemRevisionStatus', 'PENDING_REVIEW'], ['submittedItemRevisionStatus', 'STAGED']]) {
    const f = fixture([{ ...base, [field]: revision(state, '0.2.1') }]);
    assert.match(await publish(f.options), /no changes made/);
    assert.equal(f.calls.length, 1);
  }
});

test('refuses other pending releases, downgrades, rejected versions and unsafe item states before upload', async () => {
  for (const status of [
    { ...base, submittedItemRevisionStatus: revision('PENDING_REVIEW', '0.2.2') },
    { publishedItemRevisionStatus: revision('PUBLISHED', '1.0.0') },
    { publishedItemRevisionStatus: revision('PUBLISHED', 'unknown') },
    { publishedItemRevisionStatus: revision('UNKNOWN', '0.2.0') },
    { ...base, submittedItemRevisionStatus: revision('REJECTED', '0.2.1') },
    { ...base, submittedItemRevisionStatus: { state: 'UNRECOGNIZED' } },
    { ...base, submittedItemRevisionStatus: { state: 'PENDING_REVIEW' } },
    { ...base, takenDown: true }, { ...base, warned: true },
    { ...base, lastAsyncUploadState: 'IN_PROGRESS' },
  ]) {
    const f = fixture([status]);
    await assert.rejects(publish(f.options));
    assert.equal(f.calls.length, 1);
  }
});

test('polls an asynchronous upload and publishes only after it succeeds', async () => {
  const f = fixture([base, { uploadState: 'IN_PROGRESS' }, { lastAsyncUploadState: 'IN_PROGRESS' }, { lastAsyncUploadState: 'SUCCEEDED' }, { state: 'PENDING_REVIEW' }]);
  await publish(f.options);
  assert.equal(f.calls.filter((c) => c.url.endsWith(':upload')).length, 1);
  assert.equal(f.calls.at(-1).url.endsWith(':publish'), true);
});

test('failed, unknown, timed-out or wrong-version uploads never publish', async () => {
  for (const responses of [
    [base, { uploadState: 'FAILED' }],
    [base, { uploadState: 'UNKNOWN' }],
    [base, { uploadState: 'SUCCEEDED', crxVersion: '0.3.0' }],
    [base, { uploadState: 'IN_PROGRESS' }, { lastAsyncUploadState: 'IN_PROGRESS' }],
    [base, { uploadState: 'IN_PROGRESS' }, { lastAsyncUploadState: 'NOT_FOUND' }],
    [base, { uploadState: 'IN_PROGRESS' }, { submittedItemRevisionStatus: revision('PENDING_REVIEW', '0.3.0') }],
  ]) {
    const f = fixture(responses);
    await assert.rejects(publish({ ...f.options, maxPolls: 1 }));
    assert.equal(f.calls.some((c) => c.url.endsWith(':publish')), false);
  }
});

test('ambiguous mutations are sent only once and errors never print server bodies or tokens', async () => {
  for (const responses of [[base, new Error('secret-do-not-print')], [base, { uploadState: 'SUCCEEDED' }, new Error('secret-do-not-print')], [base, { http: 403, body: { secret: 'secret-do-not-print' } }]]) {
    const f = fixture(responses);
    await assert.rejects(publish(f.options), (error) => !error.message.includes('secret-do-not-print'));
    assert.equal(f.calls.filter((c) => c.url.endsWith(':upload')).length, 1);
    assert.ok(f.calls.filter((c) => c.url.endsWith(':publish')).length <= 1);
  }
});

test('missing configuration fails before network access', async () => {
  for (const overrides of [{ publisherId: '' }, { publisherId: '../wrong' }, { token: '' }, { version: '0.2.1-beta' }]) {
    const f = fixture([]);
    await assert.rejects(publish({ ...f.options, ...overrides }));
    assert.equal(f.calls.length, 0);
  }
});
