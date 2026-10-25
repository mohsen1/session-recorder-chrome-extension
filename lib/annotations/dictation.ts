export interface DictationDraft {
  text: string;
  base: string;
  segment?: string;
  ignored?: string;
  final?: string;
}
export type DictationAction =
  | { type: 'edit'; text: string }
  | { type: 'transcript'; segment: string; text: string; final: boolean };
export const emptyDictationDraft: DictationDraft = { text: '', base: '' };
/** Interim words replace themselves; manual corrections and repeated finals are preserved. */
export function dictationReducer(state: DictationDraft, action: DictationAction): DictationDraft {
  if (action.type === 'edit') return { ...state, text: action.text, base: action.text, ignored: state.segment ?? state.ignored, segment: undefined };
  if (action.segment === state.ignored || action.segment === state.final) return state;
  const base = action.segment === state.segment ? state.base : state.text;
  const text = [base.trimEnd(), action.text.trim()].filter(Boolean).join(' ').slice(0, 4000);
  return { text, base: action.final ? text : base, segment: action.final ? undefined : action.segment, final: action.final ? action.segment : state.final, ignored: state.ignored };
}
