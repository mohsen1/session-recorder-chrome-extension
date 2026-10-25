import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import createAccessWorker from './access-worker.js';

const issuer = 'https://team.cloudflareaccess.com';
const audience = 'a'.repeat(64);
let pair: CryptoKeyPair;
let jwk: JsonWebKey;
const encode = (data: string | Uint8Array) => Buffer.from(data).toString('base64url');
beforeAll(async () => {
  pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
});
afterEach(() => vi.unstubAllGlobals());
async function token(patch: Record<string, unknown> = {}) {
  const header = encode(JSON.stringify({ alg: 'RS256', kid: 'test-key' }));
  const claims = encode(
    JSON.stringify({
      iss: issuer,
      aud: [audience],
      exp: Date.now() / 1000 + 600,
      ...patch,
    }),
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    pair.privateKey,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${encode(new Uint8Array(signature))}`;
}
describe('deployed Access guard', () => {
  it.each([
    '/',
    '/index.html',
    '/screenshots/001.jpg',
    '/files/private.html',
    '/session.json',
  ])('denies anonymous access to %s without ever reading assets', async (path) => {
    const assets = vi.fn();
    const worker = createAccessWorker({ issuer, audience });
    const response = await worker.fetch(
      new Request(`https://alias.reports.pages.dev${path}`),
      { ASSETS: { fetch: assets } },
    );
    expect(response.status).toBe(403);
    expect(assets).not.toHaveBeenCalled();
  });
  it('verifies a signed JWT before serving assets with private, script-free headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ keys: [{ ...jwk, kid: 'test-key' }] })),
    );
    const assets = vi.fn().mockResolvedValue(new Response('private report'));
    const worker = createAccessWorker({ issuer, audience });
    const response = await worker.fetch(
      new Request('https://abc.reports.pages.dev/session.json', {
        headers: { 'Cf-Access-Jwt-Assertion': await token() },
      }),
      { ASSETS: { fetch: assets } },
    );
    expect(fetch).toHaveBeenCalledWith(`${issuer}/cdn-cgi/access/certs`,
      expect.objectContaining({ redirect: 'manual' }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('private report');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "default-src 'none'",
    );
    expect(response.headers.get('Content-Disposition')).toBe('attachment');
  });
  it('rejects redirected signing keys without serving assets', async () => {
    const fetchKeys = vi.fn().mockResolvedValue(new Response(null, {
      status: 302, headers: { Location: 'https://untrusted.example/keys' },
    }));
    vi.stubGlobal('fetch', fetchKeys);
    const assets = vi.fn();
    const response = await createAccessWorker({ issuer, audience }).fetch(
      new Request('https://abc.reports.pages.dev', {
        headers: { 'Cf-Access-Jwt-Assertion': await token() },
      }),
      { ASSETS: { fetch: assets } },
    );
    expect(fetchKeys).toHaveBeenCalledWith(`${issuer}/cdn-cgi/access/certs`,
      expect.objectContaining({ redirect: 'manual' }));
    expect(response.status).toBe(403);
    expect(assets).not.toHaveBeenCalled();
  });
  it.each([
    { aud: ['different-app'] },
    { iss: 'https://attacker.example' },
    { exp: 1 },
    { nbf: Date.now() / 1000 + 3600 },
  ])('rejects a signed but unauthorized token %j', async (claims) => {
    const assets = vi.fn();
    const worker = createAccessWorker({ issuer, audience });
    const response = await worker.fetch(
      new Request('https://abc.reports.pages.dev', {
        headers: { 'Cf-Access-Jwt-Assertion': await token(claims) },
      }),
      { ASSETS: { fetch: assets } },
    );
    expect(response.status).toBe(403);
    expect(assets).not.toHaveBeenCalled();
  });
  it('fails closed on forged signatures and unavailable signing keys', async () => {
    const signed = await token();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ keys: [{ ...jwk, kid: 'test-key' }] })),
    );
    const assets = vi.fn();
    const worker = createAccessWorker({ issuer, audience });
    const forged =
      signed.slice(0, signed.lastIndexOf('.') + 1) + encode(new Uint8Array(256));
    expect(
      (
        await worker.fetch(
          new Request('https://abc.reports.pages.dev', {
            headers: { 'Cf-Access-Jwt-Assertion': forged },
          }),
          { ASSETS: { fetch: assets } },
        )
      ).status,
    ).toBe(403);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const freshWorker = createAccessWorker({ issuer, audience });
    expect(
      (
        await freshWorker.fetch(
          new Request('https://abc.reports.pages.dev', {
            headers: { 'Cf-Access-Jwt-Assertion': signed },
          }),
          { ASSETS: { fetch: assets } },
        )
      ).status,
    ).toBe(403);
    expect(assets).not.toHaveBeenCalled();
  });
});
