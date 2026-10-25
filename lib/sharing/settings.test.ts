import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configuredRepositories, defaultSharingSettings, loadSharingSettings,
  preferredRepository, rememberRepository, saveSharingSettings, tokenForRepository,
  SHARING_KEY, LAST_REPOSITORY_KEY,
} from './settings';

afterEach(() => vi.unstubAllGlobals());
describe('repository settings', () => {
  it('migrates a legacy repository without losing its token', async () => {
    const stored: Record<string, unknown> = {
      [SHARING_KEY]: { repository: 'owner/first', githubToken: 'old-token' },
      [LAST_REPOSITORY_KEY]: 'owner/first',
    };
    vi.stubGlobal('chrome', { storage: { local: {
      get: vi.fn(async () => stored),
      setAccessLevel: vi.fn(),
      set: vi.fn(async (value) => Object.assign(stored, value)),
    } } });
    const settings = await loadSharingSettings();
    expect(settings.repositories).toEqual([{ id: 'legacy', repository: 'owner/first', token: 'old-token' }]);
    await saveSharingSettings(settings);
    expect((await loadSharingSettings()).repositories[0]?.token).toBe('old-token');
    expect((stored[SHARING_KEY] as { githubToken: string }).githubToken).toBe('');
    await rememberRepository('https://github.com/owner/second');
    expect(stored[LAST_REPOSITORY_KEY]).toBe('owner/second');
    expect(configuredRepositories({ repository: '', githubToken: '' })).toEqual([]);
  });

  it('does not send another repository’s credential or override a chosen repository', () => {
    const settings = defaultSharingSettings();
    settings.repositories = [
      { id: 'a', repository: 'owner/first', token: 'first-token' },
      { id: 'b', repository: 'team/second', token: 'second-token' },
    ];
    settings.lastRepository = 'team/second';
    expect(preferredRepository(settings)).toBe('team/second');
    expect(tokenForRepository(settings, 'TEAM/second')).toBe('second-token');
    expect(() => tokenForRepository(settings, 'team/unknown')).toThrow('Add a GitHub token');
    settings.repositories.pop();
    expect(preferredRepository(settings)).toBe('owner/first');
  });
});
