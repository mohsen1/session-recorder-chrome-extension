import { repositoryPath } from './github';

export type SummaryProvider = 'openai' | 'compatible' | 'anthropic' | 'google';
export interface ModelConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}
export interface CloudflareConfig {
  apiToken: string;
  accountId: string;
  projectName: string;
  accessAppId: string;
  teamDomain: string;
}
export interface GitHubRepository {
  id: string;
  repository: string;
  token: string;
}
export interface SharingSettings {
  cloudflare: CloudflareConfig;
  repository: string;
  /** Legacy fields are read only for migration. */
  githubToken: string;
  repositories: GitHubRepository[];
  lastRepository: string;
  provider: SummaryProvider;
  models: Record<SummaryProvider, ModelConfig>;
}
export const SHARING_KEY = 'sharingSettings';
export const LAST_REPOSITORY_KEY = 'lastIssueRepository';
// Verified against official provider catalogs on 2026-10-24. Custom IDs remain supported.
export const SUMMARY_PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-6.1-sol'],
    baseUrl: 'https://api.openai.com/v1',
    keysUrl: 'https://platform.openai.com/api-keys',
  },
  { id: 'compatible', label: 'OpenAI compatible', baseUrl: '', keysUrl: '', models: [] },
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'],
    baseUrl: 'https://api.anthropic.com/v1',
    keysUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    models: ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keysUrl: 'https://aistudio.google.com/apikey',
  },
] as const;

export function defaultSharingSettings(): SharingSettings {
  return {
    cloudflare: {
      apiToken: '',
      accountId: '',
      projectName: '',
      accessAppId: '',
      teamDomain: '',
    },
    repository: '',
    githubToken: '',
    repositories: [],
    lastRepository: '',
    provider: 'openai',
    models: Object.fromEntries(
      SUMMARY_PROVIDERS.map((p) => [
        p.id,
        { apiKey: '', model: p.models[0] ?? '', baseUrl: p.baseUrl },
      ]),
    ) as SharingSettings['models'],
  };
}

export async function loadSharingSettings(): Promise<SharingSettings> {
  const stored = await chrome.storage.local.get([SHARING_KEY, LAST_REPOSITORY_KEY]);
  const saved = stored[SHARING_KEY] as Partial<SharingSettings> | undefined;
  const defaults = defaultSharingSettings();
  return {
    ...defaults,
    ...saved,
    repositories: configuredRepositories(saved),
    lastRepository: stored[LAST_REPOSITORY_KEY] ?? saved?.lastRepository ?? '',
    cloudflare: { ...defaults.cloudflare, ...saved?.cloudflare },
    models: Object.fromEntries(
      SUMMARY_PROVIDERS.map((p) => [
        p.id,
        { ...defaults.models[p.id], ...saved?.models?.[p.id] },
      ]),
    ) as SharingSettings['models'],
  };
}

export async function saveSharingSettings(settings: SharingSettings): Promise<void> {
  // Content scripts have no reason to access provider credentials.
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const { lastRepository: _last, ...rest } = settings;
  await chrome.storage.local.set({
    [SHARING_KEY]: { ...rest, repository: '', githubToken: '' },
  });
}

/** Cloudflare's supported token-template URL: user still reviews and creates it. */
export function cloudflareTokenUrl(accountId: string): string {
  const query = new URLSearchParams({
    permissionGroupKeys: JSON.stringify([
      { key: 'page', type: 'edit' },
      { key: 'access', type: 'read' },
    ]),
    accountId: /^[a-f0-9]{32}$/i.test(accountId) ? accountId : '*',
    zoneId: 'all',
    name: 'Session Recorder publishing',
  });
  return `https://dash.cloudflare.com/profile/api-tokens?${query}`;
}

/** Migrate the single-repository configuration without losing its credential. */
export function configuredRepositories(settings?: Partial<SharingSettings>): GitHubRepository[] {
  if (settings?.repositories?.length) return settings.repositories;
  if (!settings?.repository) return [];
  return [{ id: 'legacy', repository: settings.repository, token: settings.githubToken ?? '' }];
}

export function tokenForRepository(settings: SharingSettings, repository: string): string {
  const path = repositoryPath(repository).toLowerCase();
  const configured = configuredRepositories(settings).find((entry) => {
    try { return repositoryPath(entry.repository).toLowerCase() === path; }
    catch { return false; }
  });
  if (!configured?.token.trim())
    throw new Error(`Add a GitHub token for ${repositoryPath(repository)} in Settings → GitHub.`);
  return configured.token;
}

export function preferredRepository(settings: SharingSettings): string {
  const entries = configuredRepositories(settings);
  return entries.find((entry) => entry.repository.toLowerCase() === settings.lastRepository.toLowerCase())?.repository
    ?? entries[0]?.repository ?? settings.repository;
}

export async function rememberRepository(repository: string): Promise<void> {
  await chrome.storage.local.set({ [LAST_REPOSITORY_KEY]: repositoryPath(repository) });
}

export function githubTokenUrl(repository: string): string {
  const query = new URLSearchParams({
    name: 'Session Recorder', description: 'File issues from recorded sessions', issues: 'write',
  });
  try { query.set('target_name', repositoryPath(repository).split('/')[0]!); } catch { /* Incomplete entry. */ }
  return `https://github.com/settings/personal-access-tokens/new?${query}`;
}
