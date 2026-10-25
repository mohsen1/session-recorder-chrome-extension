import { describe, it, expect } from 'vitest';
import { dictationReducer, emptyDictationDraft } from './dictation';

describe('annotation dictation', () => {
  it('replaces interim words and appends complete utterances once', () => {
    let state = dictationReducer(emptyDictationDraft, { type: 'edit', text: 'Please fix:' });
    for (const [text, final] of [['the recipe', false], ['the recipe icon', false], ['the recipe icon.', true], ['the recipe icon.', true]] as const)
      state = dictationReducer(state, { type: 'transcript', segment: '1', text, final });
    state = dictationReducer(state, { type: 'transcript', segment: '2', text: 'It is missing.', final: true });
    expect(state.text).toBe('Please fix: the recipe icon. It is missing.');
  });
  it('does not overwrite a manual correction when a delayed final arrives', () => {
    let state = dictationReducer(emptyDictationDraft, { type: 'transcript', segment: '1', text: 'profile', final: false });
    state = dictationReducer(state, { type: 'edit', text: 'Proofline' });
    state = dictationReducer(state, { type: 'transcript', segment: '1', text: 'profile.', final: true });
    expect(state.text).toBe('Proofline');
    state = dictationReducer(state, { type: 'transcript', segment: '2', text: 'needs an icon', final: true });
    expect(state.text).toBe('Proofline needs an icon');
  });
});
