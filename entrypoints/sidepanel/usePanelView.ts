import { useEffect } from 'react';
import { useSidepanel } from './store';

/** The background owns recording; settings and reports open in their own tabs. */
export function usePanelView() {
  const init = useSidepanel((s) => s.init);
  const ready = useSidepanel((s) => s.ready);
  const session = useSidepanel((s) => s.session);
  const error = useSidepanel((s) => s.error);
  const dismissError = useSidepanel((s) => s.dismissError);
  useEffect(() => {
    void init();
  }, [init]);
  return {
    ready,
    session,
    error,
    dismissError,
    openSettings: () => {
      void chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    },
    live: !!session && ['recording', 'paused', 'stopping'].includes(session.status),
    openReport: (id: string) => {
      void chrome.tabs.create({
        url: `${chrome.runtime.getURL('share.html')}?session=${encodeURIComponent(id)}`,
      });
    },
  };
}
