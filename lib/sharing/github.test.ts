import { describe, expect, it } from 'vitest';
import { githubIssueLink, issueBody, repositoryPath } from './github';
import { cloudflareTokenUrl } from './settings';

describe('issue handoff', () => {
  it('includes a protected report link and encodes Markdown exactly', () => {
    const body = issueBody(
      { title: 'Failure & retry', body: '## Evidence\n500 on checkout' },
      'https://abc.reports.pages.dev',
    );
    const link = githubIssueLink(
      'https://github.com/owner/repo',
      'Failure & retry',
      body,
    );
    expect(new URL(link.url).searchParams.get('body')).toBe(body);
    expect(body).toContain('Cloudflare Access sign-in required');
    expect(link.needsPaste).toBe(false);
  });
  it('uses the clipboard fallback for long and multibyte summaries', () => {
    const link = githubIssueLink('owner/repo', 'Bug', '錯'.repeat(1500));
    expect(link.needsPaste).toBe(true);
    expect(new URL(link.url).searchParams.has('body')).toBe(false);
  });
  it.each([
    'https://evil.example/o/r',
    'owner/repo/issues',
    'owner/..',
    'owner/repo?x=y',
  ])('rejects an invalid destination %s', (value) => {
    expect(() => repositoryPath(value)).toThrow();
  });
  it('preconfigures only Pages Edit and Access Read for the requested account', () => {
    const account = 'a'.repeat(32);
    const url = new URL(cloudflareTokenUrl(account));
    expect(url.searchParams.get('accountId')).toBe(account);
    expect(JSON.parse(url.searchParams.get('permissionGroupKeys')!)).toEqual([
      { key: 'page', type: 'edit' },
      { key: 'access', type: 'read' },
    ]);
  });
});
