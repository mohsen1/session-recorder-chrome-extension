import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ProoflineMark } from '@/lib/ui/ProoflineMark';
import { useProoflineSettings } from './useProoflineSettings';
import { PROOFLINE_ORIGIN, recorderHelpUrl } from '@/lib/proofline/settings';
export function ProoflineSettings(): React.JSX.Element {
  const { state, connect, disconnect, refresh, cancel } =
    useProoflineSettings();
  const { settings, status, error, code } = state;
  const account = settings.connection?.account;
  const busy = status !== 'idle';
  const expired =
    settings.connection && settings.connection.expiresAt <= Date.now();
  return (
    <section
      className="settings__section proofline-settings"
      aria-label="Proofline account"
    >
      <header className="proofline-settings__heading">
        <ProoflineMark size={26} />
        <h2>Proofline</h2>
      </header>
      {account ? (
        <>
          <div className="proofline-account">
            <strong>{account.user.login}</strong>
            <span>
              {account.organization.name || account.organization.login}
            </span>
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
            Connect your Proofline workspace to use its credits for AI, share
            private reports and file GitHub issues.
          </p>
          <button
            className="btn btn--primary btn--sm proofline-settings__connect"
            disabled={busy}
            onClick={() => void connect()}
          >
            Connect to Proofline
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
      <div className="settings__actions proofline-settings__links">
        <a href="#services">Manage services</a>
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
