/**
 * Options page UI.
 *
 * The full settings page, opened by the recorder's gear button.
 */

import React from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { SettingsForm } from '../sidepanel/components/SettingsForm';

export function App(): React.JSX.Element {
  return (
    <div className="options-page">
      <header className="options-page__header">
        <div className="options-page__identity">
          <img src="/icon/32.png" width="22" height="22" alt="" />
          <span className="options-page__brand">Session Recorder</span>
          <ChevronRight className="options-page__separator" size={14} aria-hidden="true" />
          <h1 className="options-page__title">Settings</h1>
        </div>
        <a className="options-page__help" href="https://azimi.me/session-recorder-chrome-extension/help/" target="_blank" rel="noreferrer">
          Help <ExternalLink size={12} aria-hidden="true" />
        </a>
      </header>
      <SettingsForm />
    </div>
  );
}
