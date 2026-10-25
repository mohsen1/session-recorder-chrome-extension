import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ProoflineMark } from '@/lib/ui/ProoflineMark';
import { useProoflineSettings } from './useProoflineSettings';
import { PROOFLINE_ORIGIN, recorderHelpUrl } from '@/lib/proofline/settings';
export function ProoflineSettings(): React.JSX.Element {
  const { state, patch, connect, disconnect, refresh, cancel } = useProoflineSettings();
  const { settings, status, error, code } = state;
  const account = settings.connection?.account;
  const busy = status !== 'idle';
  const expired = settings.connection && settings.connection.expiresAt <= Date.now();
  return (
    <section className="settings__section proofline-settings" aria-label="Proofline account">
      <header className="proofline-settings__heading">
        <ProoflineMark size={26} />
        <h2>Proofline</h2>
      </header>
      {account ? (
        <>
          <div className="proofline-account">
            <strong>{account.user.login}</strong>
            <span>{account.organization.name || account.organization.login}</span>
          </div>
          <label className="settings__field">
            <span className="settings__label">Workspace paying for usage</span>
            <select
              disabled={busy}
              value={settings.connection!.organizationId}
              onChange={(event) => void connect(event.target.value)}
            >
              {account.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name || org.login}
                  {org.is_personal ? ' (personal)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="proofline-credit-row">
            <span>
              {(
                account.credits.balance_microcredits /
                account.credits.microcredits_per_credit
              ).toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
              credits
            </span>
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Refresh
            </button>
          </div>
          {(settings.aiMode !== 'proofline' ||
            settings.publishing !== 'proofline' ||
            settings.github !== 'proofline') && (
            <button
              className="btn btn--primary btn--sm proofline-settings__connect"
              disabled={busy || !!expired}
              onClick={() =>
                void patch({
                  aiMode: 'proofline',
                  publishing: 'proofline',
                  github: 'proofline',
                })
              }
            >
              Use Proofline for AI and sharing
            </button>
          )}
          <div className="settings__actions">
            <button
              className="btn btn--sm"
              disabled={busy}
              onClick={() => void connect()}
            >
              {expired ? 'Reconnect' : 'Change account'}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <div className="proofline-settings__intro">
          <p className="proofline-settings__description">
            Use Proofline credits for AI and share private reports with your team.
          </p>
          <button
            className="btn btn--primary btn--sm proofline-settings__connect"
            disabled={busy}
            onClick={() => void connect()}
          >
            Connect Proofline
          </button>
          <p className="settings__hint proofline-settings__onboarding">
            Finish Proofline onboarding and install the GitHub App to get 10,000
            credits.
          </p>
        </div>
      )}
      {status === 'connecting' && (
        <div role="status" className="proofline-connection-status">
          <span>
            Approve in your browser
            {code ? (
              <>
                {' '}
                · <code>{code}</code>
              </>
            ) : (
              '…'
            )}
          </span>
          <button className="btn btn--sm" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p className="export__error" role="alert">
          {error}
        </p>
      )}
      <div className="proofline-settings__services">
        <label className="settings__field proofline-settings__service">
          <span className="settings__label">AI usage</span>
          <select
            disabled={busy}
            value={settings.aiMode}
            onChange={(event) =>
              void patch({ aiMode: event.target.value as typeof settings.aiMode })
            }
          >
            <option value="personal">Personal API keys</option>
            <option value="proofline" disabled={!account}>
              Proofline credits
            </option>
          </select>
        </label>
        <label className="settings__field proofline-settings__service">
          <span className="settings__label">Report hosting</span>
          <select
            disabled={busy}
            value={settings.publishing}
            onChange={(event) =>
              void patch({
                publishing: event.target.value as typeof settings.publishing,
                ...(event.target.value === 'cloudflare'
                  ? { github: 'personal' as const }
                  : {}),
              })
            }
          >
            <option value="cloudflare">My Cloudflare account</option>
            <option value="proofline" disabled={!account}>
              Proofline · private
            </option>
          </select>
        </label>
        <label className="settings__field proofline-settings__service">
          <span className="settings__label">GitHub issue creation</span>
          <select
            disabled={busy}
            value={settings.github}
            onChange={(event) =>
              void patch({
                github: event.target.value as typeof settings.github,
                ...(event.target.value === 'proofline'
                  ? { publishing: 'proofline' as const }
                  : {}),
              })
            }
          >
            <option value="personal">Personal repository tokens</option>
            <option value="proofline" disabled={!account}>
              Proofline GitHub App
            </option>
          </select>
        </label>
      </div>
      {settings.aiMode === 'proofline' && (
        <details>
          <summary>Advanced model settings</summary>
          <label className="settings__field">
            <span className="settings__label">Model override</span>
            <input
              defaultValue={settings.model}
              placeholder="Automatic"
              onBlur={(event) => {
                if (event.target.value !== settings.model)
                  void patch({ model: event.target.value });
              }}
            />
          </label>
        </details>
      )}
      <div className="settings__actions proofline-settings__links">
        <a href={`${PROOFLINE_ORIGIN}/`} target="_blank" rel="noreferrer">
          Open Proofline <ExternalLink size={12} />
        </a>
        <a href={recorderHelpUrl('proofline')} target="_blank" rel="noreferrer">
          Setup help
        </a>
      </div>
    </section>
  );
}
