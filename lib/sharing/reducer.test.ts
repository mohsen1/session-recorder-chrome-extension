import { describe, expect, it } from 'vitest';
import { initialShareState, shareReducer } from '@/entrypoints/share/reducer';
import { SessionBuilder } from '@/lib/fixtures/session-builder';
import { defaultSharingSettings } from './settings';

describe('share workflow state', () => {
  it('preserves a recoverable deployment and edited draft after an operation fails', () => {
    const publication = {
      level: 'L1' as const,
      destination: {
        accountId: 'a',
        projectName: 'p',
        accessAppId: 'id',
        teamDomain: 'team',
      },
      deployment: {
        id: '1',
        environment: 'preview',
        url: 'https://abc.reports.pages.dev',
      },
    };
    let state = shareReducer(initialShareState('L1'), {
      type: 'loaded',
      session: new SessionBuilder().build().session,
      settings: defaultSharingSettings(),
      saved: {
        draft: { title: 'Edited', body: 'My summary' },
        repository: 'owner/repo',
        publication,
      },
    });
    state = shareReducer(state, { type: 'start', operation: 'check' });
    state = shareReducer(state, { type: 'error', message: 'Timeout' });
    state = shareReducer(state, { type: 'finish' });
    expect(state.publication).toEqual(publication);
    expect(state.draft.title).toBe('Edited');
    expect(state.operation).toBe('idle');
  });
  it('prepares new report detail without a review gate', () => {
    const state = shareReducer(initialShareState('L1'), {type: 'prepare', level: 'L2'});
    expect(state.files).toEqual([]);
    expect(state.preparing).toBe(true);
  });
});
