import { useEffect, useReducer } from 'react';
import { onBroadcast, sendMessage } from '@/lib/messaging';
import type { Session } from '@/lib/session/types';
import { useSidepanel } from '../store';

interface State { sessions: Session[]; loading: boolean; now: number }
type Action = { type: 'loaded'; sessions: Session[] } | { type: 'removed'; id: string } | { type: 'clock'; now: number };
function reducer(state: State, action: Action): State {
  if (action.type === 'clock') return { ...state, now: action.now };
  if (action.type === 'loaded') return { ...state, sessions: action.sessions, loading: false };
  return { ...state, sessions: state.sessions.filter((session) => session.id !== action.id) };
}

export function useSessionList() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ sessions: [], loading: true, now: Date.now() }));
  const liveSessionId = useSidepanel((s) => s.session?.id);
  const recording = useSidepanel((s) => s.recording);

  // Own the initial read and external naming updates in one subscription lifecycle.
  useEffect(() => {
    let active = true;
    let revision = 0;
    async function load() {
      const request = ++revision;
      try {
        const response = await sendMessage({ kind: 'session/list' });
        if (active && request === revision)
          dispatch({ type: 'loaded', sessions: Array.isArray(response?.sessions) ? response.sessions : [] });
      } catch {
        if (active && request === revision) dispatch({ type: 'loaded', sessions: [] });
      }
    }
    const unsubscribe = onBroadcast((event) => {
      if (event.kind === 'session/updated') void load();
    });
    void load();
    const clock = window.setInterval(() => dispatch({ type: 'clock', now: Date.now() }), 30_000);
    return () => { active = false; unsubscribe(); window.clearInterval(clock); };
  }, [liveSessionId, recording]);

  async function remove(id: string) {
    await sendMessage({ kind: 'session/delete', sessionId: id });
    dispatch({ type: 'removed', id });
  }
  return { ...state, remove };
}
