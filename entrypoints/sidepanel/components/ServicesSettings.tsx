import { SlidersHorizontal } from 'lucide-react';
import { useProoflineSettings } from './useProoflineSettings';

export function ServicesSettings(): React.JSX.Element {
  const { state } = useProoflineSettings();
  if (state.status === 'loading') return <p role="status">Loading services…</p>;
  if (state.error) return <p className="export__error" role="alert">{state.error}</p>;
  const connected = !!state.settings.connection;
  return (
    <section className="settings__section proofline-settings" aria-label="Services">
      <header className="proofline-settings__heading">
        <SlidersHorizontal size={22} aria-hidden="true" />
        <h2>Services</h2>
      </header>
      <p className="settings__hint">
        {connected
          ? 'Using Proofline for all AI services, private report hosting and GitHub issues.'
          : 'Using personal API keys, your Cloudflare account and repository tokens.'}
      </p>
      <a href="#proofline">{connected ? 'Manage connection' : 'Connect to Proofline'}</a>
    </section>
  );
}
