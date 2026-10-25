import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex } from '@noble/hashes/utils';
import workerSource from './access-worker.js?raw';
import type { ExportFile } from '@/lib/export/bundle';
import type { CloudflareConfig } from './settings';

const API = 'https://api.cloudflare.com/client/v4';
export const PAGES_FILE_LIMIT = 25 * 1024 * 1024;
export interface Deployment {
  id: string;
  url: string;
  environment: string;
  latest_stage?: { name: string; status: string };
}
interface Project {
  name: string;
  subdomain: string;
  production_branch: string;
  source?: unknown;
  deployment_configs?: { preview?: { fail_open?: boolean } };
}
interface AccessApp {
  type: string;
  domain?: string;
  aud?: string;
  self_hosted_domains?: string[];
  destinations?: { type: string; uri?: string; overrides?: unknown[] }[];
}
interface AccessPolicy {
  decision: string;
}
interface Envelope<T> {
  success: boolean;
  result: T;
  result_info?: { total_pages?: number };
}

function accountPath(config: CloudflareConfig): string {
  return `/accounts/${config.accountId}`;
}
function projectPath(config: CloudflareConfig): string {
  return `${accountPath(config)}/pages/projects/${config.projectName}`;
}
function validateConfig(config: CloudflareConfig): void {
  if (!config.apiToken.trim())
    throw new Error('Add a Cloudflare API token in Sharing settings.');
  if (!/^[a-f0-9]{32}$/i.test(config.accountId))
    throw new Error('Enter the 32-character Cloudflare account ID.');
  if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(config.projectName))
    throw new Error(
      'Enter a valid Pages project name (lowercase letters, digits and hyphens).',
    );
  if (!/^[a-f0-9-]{36}$/i.test(config.accessAppId))
    throw new Error(
      'Enter the Access application ID from Zero Trust → Access → Applications.',
    );
  teamIssuer(config.teamDomain);
}
export function teamIssuer(value: string): string {
  const host = value
    .trim()
    .replace(/^https:\/\//, '')
    .replace(/\/$/, '');
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(host))
    throw new Error('Enter your team domain, such as your-team.cloudflareaccess.com.');
  return `https://${host}`;
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Envelope<T>> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token.trim()}`, ...init.headers },
    credentials: 'omit',
    redirect: 'error',
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(60_000)])
      : AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(
      `Cloudflare request failed (${response.status}). Check your token permissions, account, project and Access application.`,
    );
  const data = (await response.json()) as Envelope<T>;
  if (data.success !== true)
    throw new Error(
      'Cloudflare rejected the request. Check the project and API token in Cloudflare.',
    );
  return data;
}

export async function verifyCloudflare(
  config: CloudflareConfig,
  signal?: AbortSignal,
): Promise<{ project: Project; audience: string; issuer: string }> {
  validateConfig(config);
  const project = (
    await request<Project>(projectPath(config), config.apiToken, { signal })
  ).result;
  if (project.source)
    throw new Error(
      'Use a dedicated Direct Upload Pages project for reports. Git-connected projects are not supported.',
    );
  if (!/^[a-z0-9-]+\.pages\.dev$/.test(project.subdomain))
    throw new Error('Cloudflare returned an invalid Pages hostname.');
  const appPath = `${accountPath(config)}/access/apps/${config.accessAppId}`;
  const app = (await request<AccessApp>(appPath, config.apiToken, { signal })).result;
  const expected = `*.${project.subdomain}`;
  const hosts = app.destinations?.length
    ? app.destinations.filter((d) => d.type === 'public').map((d) => d.uri)
    : [app.domain, ...(app.self_hosted_domains ?? [])];
  if (
    !['self_hosted', 'end_user'].includes(app.type) ||
    !hosts.includes(expected) ||
    !app.aud ||
    !/^[a-f0-9]{64}$/i.test(app.aud)
  ) {
    throw new Error(
      `Configure an Access application for ${expected} (all paths), then paste its application ID. Production-domain protection alone does not protect reports.`,
    );
  }
  if (app.destinations?.some((d) => d.overrides?.length))
    throw new Error(
      'Remove public path overrides from this Access application before publishing.',
    );
  const policies: AccessPolicy[] = [];
  for (let page = 1; page <= 100; page++) {
    const data = await request<AccessPolicy[]>(
      `${appPath}/policies?page=${page}&per_page=100`,
      config.apiToken,
      { signal },
    );
    policies.push(...data.result);
    if (page >= (data.result_info?.total_pages ?? 1)) break;
    if (page === 100)
      throw new Error(
        'Too many Access policies to verify. Use a dedicated report application.',
      );
  }
  if (
    !policies.some((p) => p.decision === 'allow') ||
    policies.some((p) => !['allow', 'deny'].includes(p.decision))
  ) {
    throw new Error(
      'Configure an Allow policy for your report readers. Bypass and Service Auth policies are not supported for report sharing.',
    );
  }
  // Verify team domain is reachable before shipping an issuer into the Worker.
  const issuer = teamIssuer(config.teamDomain);
  const certs = await fetch(`${issuer}/cdn-cgi/access/certs`, {
    credentials: 'omit',
    redirect: 'error',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
  });
  if (!certs.ok || !Array.isArray((await certs.json()).keys))
    throw new Error(
      'Cannot load Access signing keys. Check your Cloudflare team domain.',
    );
  return { project, audience: app.aud, issuer };
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function pagesAsset(file: ExportFile): {
  key: string;
  value: string;
  metadata: { contentType: string };
  base64: true;
} {
  const bytes = file.bytes ?? new TextEncoder().encode(file.text ?? '');
  const value = base64(bytes);
  const extension = file.path.split('/').pop()!.split('.').slice(1).pop() ?? '';
  // Match Wrangler's hashFile: BLAKE3(base64 contents + extension), first 128 bits.
  const key = bytesToHex(blake3(new TextEncoder().encode(value + extension))).slice(
    0,
    32,
  );
  const contentType =
    (
      {
        html: 'text/html; charset=utf-8',
        md: 'text/plain; charset=utf-8',
        json: 'application/json',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webm: file.path.startsWith('audio/') ? 'audio/webm' : 'video/webm',
      } as Record<string, string>
    )[extension] ?? 'application/octet-stream';
  return { key, value, metadata: { contentType }, base64: true };
}

export function validateFiles(files: ExportFile[]): void {
  if (files.length > 20_000)
    throw new Error(
      'This report exceeds the Pages limit of 20,000 files. Choose a lower detail level.',
    );
  const paths = new Set<string>();
  for (const file of files) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(file.path) ||
      file.path.startsWith('/') ||
      file.path.split('/').some((p) => p === '..' || p === '.') ||
      file.path.startsWith('_') ||
      paths.has(file.path)
    )
      throw new Error('The report contains an unsafe or duplicate file path.');
    paths.add(file.path);
    if (
      (file.bytes?.byteLength ?? new TextEncoder().encode(file.text ?? '').length) >
      PAGES_FILE_LIMIT
    )
      throw new Error(
        `${file.path} exceeds Cloudflare Pages’ 25 MiB file limit. Choose Compact/Minimal or remove the large recording before publishing.`,
      );
  }
}

export async function publishReport(
  config: CloudflareConfig,
  files: ExportFile[],
  progress: (message: string) => void,
  signal?: AbortSignal,
  onCreated?: (deployment: Deployment) => Promise<void>,
): Promise<Deployment> {
  validateFiles(files);
  progress('Checking Cloudflare Access…');
  const { project, audience, issuer } = await verifyCloudflare(config, signal);
  if (project.deployment_configs?.preview?.fail_open !== false) {
    const secured = (
      await request<Project>(projectPath(config), config.apiToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deployment_configs: { production: { fail_open: false }, preview: { fail_open: false } } }),
        signal,
      })
    ).result;
    if (secured.deployment_configs?.preview?.fail_open !== false)
      throw new Error(
        'Set Pages Functions to fail closed in the project settings before publishing.',
      );
  }
  // Only preview deployments; unique branches keep reports independent.
  const branch = `report-${crypto.randomUUID()}`;
  if (branch === project.production_branch)
    throw new Error('Refusing to publish a report to production.');
  const { jwt } = (
    await request<{ jwt: string }>(
      `${projectPath(config)}/upload-token`,
      config.apiToken,
      { signal },
    )
  ).result;
  const manifest: Record<string, string> = {};
  for (let i = 0; i < files.length; i++) {
    signal?.throwIfAborted();
    const file = files[i]!;
    progress(`Uploading file ${i + 1} of ${files.length}…`);
    const asset = pagesAsset(file);
    // One asset per upload bounds peak base64 memory even for video recordings.
    await request('/pages/assets/upload', jwt, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([asset]),
      signal,
    });
    manifest[`/${file.path}`] = asset.key;
  }
  await request('/pages/assets/upsert-hashes', jwt, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes: Object.values(manifest) }),
    signal,
  });
  const worker =
    workerSource.replace(
      'export default function createAccessWorker',
      'function createAccessWorker',
    ) +
    `\nexport default createAccessWorker(${JSON.stringify({ issuer, audience })});\n`;
  const form = new FormData();
  form.append('manifest', JSON.stringify(manifest));
  form.append('branch', branch);
  form.append('commit_message', 'Session Recorder protected report');
  form.append(
    '_worker.js',
    new Blob([worker], { type: 'application/javascript+module' }),
    '_worker.js',
  );
  form.append(
    '_routes.json',
    new Blob([JSON.stringify({ version: 1, include: ['/*'], exclude: [] })], {
      type: 'application/json',
    }),
    '_routes.json',
  );
  signal?.throwIfAborted();
  progress('Creating protected deployment…');
  const deployment = (
    await request<Deployment>(`${projectPath(config)}/deployments`, config.apiToken, {
      method: 'POST',
      body: form,
      // Once creation starts, collect its ID even if the user cancels. Aborting
      // the response would discard the only handle to a potentially live report.
    })
  ).result;
  if (
    deployment.environment !== 'preview' ||
    !validDeploymentUrl(deployment.url, project.subdomain)
  )
    throw new Error(
      'Cloudflare returned an unexpected deployment. Inspect the project in Cloudflare before retrying.',
    );
  // Persist the ID immediately: a tab closure or timeout must not lose a live deployment.
  await onCreated?.(deployment);
  return waitForDeployment(config, deployment, progress, signal);
}

function validDeploymentUrl(value: string, domain: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith(`.${domain}`) &&
      url.hostname.split('.').length === 4 &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export async function waitForDeployment(
  config: CloudflareConfig,
  deployment: Deployment,
  progress: (message: string) => void,
  signal?: AbortSignal,
): Promise<Deployment> {
  let current = deployment;
  for (let attempt = 0; attempt < 60; attempt++) {
    signal?.throwIfAborted();
    if (
      current.latest_stage?.status === 'failure' ||
      current.latest_stage?.status === 'canceled'
    )
      throw new Error(
        'Cloudflare deployment failed. Open the project dashboard for build details.',
      );
    if (
      current.latest_stage?.name === 'deploy' &&
      current.latest_stage.status === 'success'
    )
      return current;
    progress('Waiting for Cloudflare deployment…');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    current = (
      await request<Deployment>(
        `${projectPath(config)}/deployments/${encodeURIComponent(deployment.id)}`,
        config.apiToken,
        { signal },
      )
    ).result;
  }
  throw new Error(
    'Cloudflare is still deploying. Use Check deployment to resume without uploading again.',
  );
}

export async function deletePublishedReport(
  config: CloudflareConfig,
  id: string,
): Promise<void> {
  validateConfig(config);
  await request(
    `${projectPath(config)}/deployments/${encodeURIComponent(id)}?force=true`,
    config.apiToken,
    { method: 'DELETE' },
  );
}
