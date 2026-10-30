export const PROOFLINE_ORIGIN = 'https://proofline.sh';
export const PROOFLINE_SETTINGS_KEY = 'prooflineSettings';
export const PRODUCT_WEBSITE = `${PROOFLINE_ORIGIN}/session-recorder-chrome-extension/`;
export function recorderHelpUrl(
  topic?: 'cloudflare' | 'github' | 'ai-summaries' | 'proofline',
): string {
  return `${PROOFLINE_ORIGIN}/help/session-recorder${topic ? `-${topic}` : ''}/`;
}
export const PRODUCT_REPOSITORY =
  'https://github.com/prooflinedev/session-recorder-chrome-extension';

export interface ProoflineOrganization {
  id: string;
  login: string;
  name: string | null;
  is_personal: boolean;
}
export interface ProoflineAccount {
  user: { id: string; login: string };
  organization: ProoflineOrganization;
  organizations: ProoflineOrganization[];
  default_organization_id: string | null;
  credits: { balance_microcredits: number; microcredits_per_credit: number };
  repositories: { id: string; full_name: string; github_repository_id: number }[];
}
export interface ProoflineConnection {
  accessToken: string;
  organizationId: string;
  expiresAt: number;
  account: ProoflineAccount;
}
export interface ProoflineSettings {
  aiMode: 'personal' | 'proofline';
  publishing: 'cloudflare' | 'proofline';
  github: 'personal' | 'proofline';
  model: string;
  connection?: ProoflineConnection;
}
export const defaultProoflineSettings = (): ProoflineSettings => ({
  aiMode: 'personal',
  publishing: 'cloudflare',
  github: 'personal',
  model: '',
});
export async function loadProoflineSettings(): Promise<ProoflineSettings> {
  const stored = await chrome.storage.local.get(PROOFLINE_SETTINGS_KEY);
  return connectedSettings({
    ...defaultProoflineSettings(),
    ...stored[PROOFLINE_SETTINGS_KEY],
  });
}
export async function saveProoflineSettings(
  settings: ProoflineSettings,
): Promise<ProoflineSettings> {
  const next = connectedSettings(settings);
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.storage.local.set({ [PROOFLINE_SETTINGS_KEY]: next });
  return next;
}
/** A connected workspace owns every service, including older saved profiles. */
function connectedSettings(settings: ProoflineSettings): ProoflineSettings {
  if (!settings.connection) return settings;
  return {
    ...settings,
    aiMode: 'proofline',
    publishing: 'proofline',
    github: 'proofline',
    model: '',
  };
}
export function requireConnection(settings: ProoflineSettings): ProoflineConnection {
  if (!settings.connection || settings.connection.expiresAt <= Date.now())
    throw new Error(
      'Your Proofline connection has expired. Reconnect in Settings → Proofline.',
    );
  return settings.connection;
}
