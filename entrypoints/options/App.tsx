/**
 * Options page UI.
 *
 * A thin wrapper around the shared <SettingsForm/> (the same component the side
 * panel renders behind its header gear), centered in a narrow column so both
 * entry points stay in sync from one implementation.
 */

import React from 'react';
import { SettingsForm } from '../sidepanel/components/SettingsForm';

export function App(): React.JSX.Element {
  return (
    <div className="options-page">
      <header className="options-page__header">
        <img
          className="options-page__logo"
          src="/icon/128.png"
          alt=""
          aria-hidden="true"
          width={34}
          height={34}
        />
        <div>
          <h1 className="options-page__title">Session Recorder Settings</h1>
          <p className="options-page__subtitle">
            Configure transcription, redaction, capture, and manage stored data.
          </p>
        </div>
      </header>
      <SettingsForm />
    </div>
  );
}
