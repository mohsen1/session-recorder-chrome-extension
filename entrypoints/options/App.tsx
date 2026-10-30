import { recorderHelpUrl } from '@/lib/proofline/settings';
/**
 * Options page UI.
 *
 * The full settings page, opened by the recorder's gear button.
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { SettingsForm } from '../sidepanel/components/SettingsForm';

export function App(): React.JSX.Element {
  return (
    <div className="options-page">
      <header className="options-page__header">
        <div className="options-page__identity">
          <h1 className="options-page__title">Settings</h1>
        </div>
        <a className="options-page__help" href={recorderHelpUrl()} target="_blank" rel="noreferrer">
          Help <ExternalLink size={12} aria-hidden="true" />
        </a>
      </header>
      <SettingsForm />
    </div>
  );
}
