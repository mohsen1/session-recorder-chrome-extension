import { useEffect, useReducer } from 'react';
import type { SettingsPage } from './SettingsForm';

export function useSettingsNavigation(pages: readonly SettingsPage[]) {
  const read = () => pages.find((p) => location.hash === `#${p}`) ?? 'capture';
  const [page, navigateTo] = useReducer(
    (_: SettingsPage, next: SettingsPage) => next,
    undefined,
    read,
  );
  useEffect(() => {
    const changed = () => navigateTo(read());
    window.addEventListener('hashchange', changed);
    return () => {
      window.removeEventListener('hashchange', changed);
    };
  }, []);
  return {
    page,
    navigate: (next: SettingsPage) => {
      navigateTo(next);
      location.hash = next;
    },
  };
}
