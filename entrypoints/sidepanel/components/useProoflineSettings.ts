import { useEffect, useReducer, useRef } from 'react';
import {
  beginProoflineSignIn,
  finishProoflineSignIn,
} from '@/lib/proofline/auth';
import { prooflineRequest } from '@/lib/proofline/client';
import {
  defaultProoflineSettings,
  loadProoflineSettings,
  saveProoflineSettings,
  PROOFLINE_SETTINGS_KEY,
  PROOFLINE_ORIGIN,
  type ProoflineAccount,
  type ProoflineSettings,
} from '@/lib/proofline/settings';

interface State {
  settings: ProoflineSettings;
  status: 'loading' | 'idle' | 'connecting' | 'saving';
  code: string;
  error: string;
}
type Action =
  | { type: 'loaded'; settings: ProoflineSettings }
  | { type: 'start'; status: State['status'] }
  | { type: 'code'; code: string }
  | { type: 'error'; error: string }
  | { type: 'finish' };
export function prooflineSettingsReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return {
        ...state,
        settings: action.settings,
        status: 'idle',
        error: '',
        code: '',
      };
    case 'start':
      return { ...state, status: action.status, error: '' };
    case 'code':
      return { ...state, code: action.code };
    case 'error':
      return { ...state, status: 'idle', code: '', error: action.error };
    case 'finish':
      return { ...state, status: 'idle', code: '' };
  }
}
export function useProoflineSettings() {
  const [state, dispatch] = useReducer(prooflineSettingsReducer, {
    settings: defaultProoflineSettings(),
    status: 'loading',
    code: '',
    error: '',
  });
  const controller = useRef<AbortController>();
  // Browser lifecycle only; all network actions originate in explicit handlers.
  useEffect(() => {
    let active = true;
    const reload = () =>
      void loadProoflineSettings()
        .then((settings) => {
          if (active) dispatch({ type: 'loaded', settings });
        })
        .catch((error) => {
          if (active) dispatch({ type: 'error', error: String(error) });
        });
    const changed = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && changes[PROOFLINE_SETTINGS_KEY]) reload();
    };
    reload();
    chrome.storage.onChanged.addListener(changed);
    return () => {
      active = false;
      controller.current?.abort();
      chrome.storage.onChanged.removeListener(changed);
    };
  }, []);
  async function perform(
    task: () => Promise<void>,
    status: State['status'] = 'saving',
  ) {
    if (controller.current) return;
    dispatch({ type: 'start', status });
    try {
      await task();
    } catch (error) {
      dispatch({
        type: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'Proofline settings could not be saved.',
      });
    } finally {
      dispatch({ type: 'finish' });
    }
  }
  async function patch(patch: Partial<ProoflineSettings>) {
    return perform(async () => {
      const next = { ...(await loadProoflineSettings()), ...patch };
      await saveProoflineSettings(next);
      dispatch({ type: 'loaded', settings: next });
    });
  }
  async function connect(organizationId?: string) {
    return perform(async () => {
      const abort = new AbortController();
      controller.current = abort;
      try {
        const settings = await loadProoflineSettings();
        const code = await beginProoflineSignIn(abort.signal, organizationId);
        const url = new URL(code.verification_uri_complete);
        dispatch({ type: 'code', code: code.user_code });
        const settingsTab = await chrome.tabs.getCurrent();
        const approvalTab = await chrome.tabs.create({
          url: url.href,
          ...(settingsTab?.id !== undefined
            ? { openerTabId: settingsTab.id }
            : {}),
        });
        const connection = await finishProoflineSignIn(
          code,
          settings,
          abort.signal,
        );
        if (organizationId && connection.organizationId !== organizationId)
          throw new Error(
            'A different workspace was approved. Your existing connection was kept; reconnect and select the intended workspace.',
          );
        const next = { ...settings, connection };
        await saveProoflineSettings(next);
        dispatch({ type: 'loaded', settings: next });
        // Credentials stay in extension storage. The website never receives an
        // extension URL, token, or a new external-message permission.
        try {
          const settingsUrl = `${chrome.runtime.getURL('options.html')}#proofline`;
          if (settingsTab?.id !== undefined) {
            await chrome.tabs.update(settingsTab.id, {
              active: true,
              url: settingsUrl,
            });
          } else {
            await chrome.tabs.create({ url: settingsUrl });
          }
          if (approvalTab.id !== undefined) {
            const tab = await chrome.tabs.get(approvalTab.id);
            const current = tab.url ? new URL(tab.url) : undefined;
            if (
              current?.origin === PROOFLINE_ORIGIN &&
              current.pathname === '/auth/device' &&
              current.searchParams.get('user_code') === code.user_code
            )
              await chrome.tabs.remove(approvalTab.id);
          }
        } catch {
          dispatch({
            type: 'error',
            error:
              'Proofline is connected. Return to Session Recorder settings to continue.',
          });
        }
      } finally {
        controller.current = undefined;
      }
    }, 'connecting');
  }
  async function refresh() {
    return perform(async () => {
      const settings = await loadProoflineSettings();
      if (!settings.connection) return;
      const account = await prooflineRequest<ProoflineAccount>(
        settings,
        '/account',
      );
      const next = {
        ...settings,
        connection: { ...settings.connection, account },
      };
      await saveProoflineSettings(next);
      dispatch({ type: 'loaded', settings: next });
    });
  }
  return {
    state,
    patch,
    connect,
    refresh,
    disconnect: () => patch({ connection: undefined }),
    cancel: () =>
      controller.current?.abort(
        new DOMException('Sign-in cancelled.', 'AbortError'),
      ),
  };
}
