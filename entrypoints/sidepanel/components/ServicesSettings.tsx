import { SlidersHorizontal } from 'lucide-react';
import { useProoflineSettings } from './useProoflineSettings';

export function ServicesSettings(): React.JSX.Element {
  const { state, patch } = useProoflineSettings();
  const { settings, status, error } = state;
  const account = settings.connection?.account;
  const busy = status !== 'idle';
  const expired = settings.connection && settings.connection.expiresAt <= Date.now();
  return (
    <section className="settings__section proofline-settings" aria-label="Services">
      <header className="proofline-settings__heading">
        <SlidersHorizontal size={22} aria-hidden="true" />
        <h2>Services</h2>
      </header>
      {!account && (
        <p className="settings__hint">
          <a href="#proofline">Connect Proofline</a> to use credits and private report hosting.
        </p>
      )}
      {account && (settings.aiMode !== 'proofline' ||
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
      {error && <p className="export__error" role="alert">{error}</p>}
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
    </section>
  );
}
