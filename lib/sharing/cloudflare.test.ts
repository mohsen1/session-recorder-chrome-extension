import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishReport, validateFiles, PAGES_FILE_LIMIT } from './cloudflare';
import type { CloudflareConfig } from './settings';

const config: CloudflareConfig = {
  apiToken: 'secret-token',
  accountId: 'a'.repeat(32),
  projectName: 'reports',
  accessAppId: '12345678-1234-1234-1234-123456789abc',
  teamDomain: 'team.cloudflareaccess.com',
};
const envelope = (result: unknown) => Response.json({ success: true, result });
const project = {
  name: 'reports',
  subdomain: 'reports.pages.dev',
  production_branch: 'main',
  deployment_configs: { production: { fail_open: false }, preview: { fail_open: false } },
};
const app = { type: 'self_hosted', domain: '*.reports.pages.dev', aud: 'b'.repeat(64) };
afterEach(() => vi.unstubAllGlobals());
function cloudflareMock(accessApp = app, policies = [{ decision: 'allow' }]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/pages/projects/reports')) return envelope(project);
    if (url.endsWith(`/access/apps/${config.accessAppId}`)) return envelope(accessApp);
    if (url.includes('/policies?')) return envelope(policies);
    if (url.endsWith('/cdn-cgi/access/certs')) return Response.json({ keys: [] });
    if (url.endsWith('/upload-token')) return envelope({ jwt: 'upload-jwt' });
    if (url.includes('/pages/assets/')) return envelope(null);
    if (url.endsWith('/deployments') && init?.method === 'POST')
      return envelope({
        id: 'deployment-1',
        url: 'https://abc.reports.pages.dev',
        environment: 'preview',
        latest_stage: { name: 'deploy', status: 'success' },
      });
    throw new Error(`Unexpected request ${url}`);
  });
}
describe('Cloudflare publishing', () => {
  it('retains the deployment handle when canceled while creation is in flight', async () => {
    const controller = new AbortController();
    const baseFetch = cloudflareMock();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/deployments')) controller.abort();
        return baseFetch(url, init);
      }),
    );
    const created = vi.fn();
    await expect(
      publishReport(
        config,
        [{ path: 'index.html', text: 'Report' }],
        () => {},
        controller.signal,
        created,
      ),
    ).rejects.toThrow();
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'deployment-1' }),
    );
  });

  it('sets preview Functions to fail closed before uploading report data', async () => {
    const baseFetch = cloudflareMock();
    const operations: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/pages/projects/reports')) {
          if (init?.method === 'PATCH') {
            operations.push('secure');
            expect(JSON.parse(init.body as string)).toEqual({
              deployment_configs: { production: { fail_open: false }, preview: { fail_open: false } },
            });
            return envelope(project);
          }
          return envelope({
            ...project,
            deployment_configs: { preview: { fail_open: true } },
          });
        }
        if (url.endsWith('/pages/assets/upload')) operations.push('upload');
        return baseFetch(url, init);
      }),
    );
    await publishReport(config, [{ path: 'index.html', text: 'Report' }], () => {});
    expect(operations).toEqual(['secure', 'upload']);
  });

  it('uploads a guarded preview, never a production deployment or an API key', async () => {
    const fetcher = cloudflareMock();
    vi.stubGlobal('fetch', fetcher);
    const created = vi.fn();
    const deployment = await publishReport(
      config,
      [{ path: 'index.html', text: '<h1>Report</h1>' }],
      () => {},
      undefined,
      created,
    );
    expect(created).toHaveBeenCalledWith(deployment);
    const [, init] = fetcher.mock.calls.find(([url]) => url.endsWith('/deployments'))!;
    const form = init!.body as FormData;
    expect(form.get('branch')).toMatch(/^report-/);
    expect(JSON.parse(form.get('manifest') as string)['/index.html']).toMatch(
      /^[a-f0-9]{32}$/,
    );
    const worker = await (form.get('_worker.js') as Blob).text();
    expect(worker).toContain('crypto.subtle.verify');
    expect(worker).toContain(app.aud);
    expect(worker).not.toContain(config.apiToken);
    expect(JSON.parse(await (form.get('_routes.json') as Blob).text())).toEqual({
      version: 1,
      include: ['/*'],
      exclude: [],
    });
    const [, upload] = fetcher.mock.calls.find(([url]) =>
      url.endsWith('/pages/assets/upload'),
    )!;
    expect((upload!.headers as Record<string, string>).Authorization).toBe(
      'Bearer upload-jwt',
    );
  });
  it.each([
    ['wrong domain', { ...app, domain: 'reports.pages.dev' }, [{ decision: 'allow' }]],
    ['bypass policy', app, [{ decision: 'allow' }, { decision: 'bypass' }]],
    ['no reader policy', app, []],
  ] as const)('uploads no report data with %s', async (_name, accessApp, policies) => {
    const fetcher = cloudflareMock(accessApp, [...policies]);
    vi.stubGlobal('fetch', fetcher);
    await expect(
      publishReport(config, [{ path: 'index.html', text: 'secret report' }], () => {}),
    ).rejects.toThrow();
    expect(
      fetcher.mock.calls.some(
        ([url]) => url.includes('/pages/assets/') || url.endsWith('/deployments'),
      ),
    ).toBe(false);
  });
  it('rejects unsafe paths and overlarge media before making any requests', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(() => validateFiles([{ path: '../_worker.js', text: 'bad' }])).toThrow(
      /unsafe/,
    );
    await expect(
      publishReport(
        config,
        [{ path: 'video/large.webm', bytes: new Uint8Array(PAGES_FILE_LIMIT + 1) }],
        () => {},
      ),
    ).rejects.toThrow(/25 MiB/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
