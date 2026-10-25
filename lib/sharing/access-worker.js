// Self-contained Pages advanced-mode Worker. This source is also uploaded verbatim.
// No credentials are embedded: issuer and audience are public Access identifiers.
export default function createAccessWorker(config) {
  let keys = [];
  let fetchedAt = 0;
  function decode(part) {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
      (c) => c.charCodeAt(0),
    );
  }
  async function authorized(request) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token || token.length > 32_768) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now = Date.now() / 1000;
    if (
      header.alg !== 'RS256' ||
      typeof header.kid !== 'string' ||
      claims.iss !== config.issuer ||
      !Array.isArray(claims.aud) ||
      !claims.aud.includes(config.audience) ||
      typeof claims.exp !== 'number' ||
      claims.exp <= now ||
      (claims.nbf !== undefined &&
        (typeof claims.nbf !== 'number' || claims.nbf > now)) ||
      (claims.iat !== undefined &&
        (typeof claims.iat !== 'number' || claims.iat > now + 60))
    )
      return false;
    if (
      Date.now() - fetchedAt > 300_000 ||
      !keys.some((key) => key.kid === header.kid)
    ) {
      const response = await fetch(`${config.issuer}/cdn-cgi/access/certs`, {
        // Workers only support follow/manual; reject redirects via response.ok.
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return false;
      const jwks = await response.json();
      if (!Array.isArray(jwks.keys)) return false;
      keys = jwks.keys;
      fetchedAt = Date.now();
    }
    const jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  }
  return {
    async fetch(request, env) {
      try {
        if (!(await authorized(request))) throw new Error('Unauthorized');
      } catch {
        return new Response(
          'Sign in through the Cloudflare Access-protected report URL. If you cannot sign in, ask the report owner to check the Access policy.',
          {
            status: 403,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          },
        );
      }
      // There is no path, method, asset, or deployment-alias exception to authentication.
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      response.headers.set(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-same-origin allow-downloads",
      );
      const path = new URL(request.url).pathname;
      if (/^\/(files|network)\//.test(path) || /\.(json|md|zip)$/.test(path)) {
        response.headers.set('Content-Disposition', 'attachment');
      }
      return response;
    },
  };
}
