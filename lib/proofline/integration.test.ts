import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultProoflineSettings,
  loadProoflineSettings,
  saveProoflineSettings,
  type ProoflineSettings,
} from './settings';
import { runProoflineAi } from './ai';
import { publishProoflineReport } from './reports';
import { configuredRepositories, loadSharingSettings } from '@/lib/sharing/settings';
import type { ProoflinePublication } from '@/lib/sharing/draft';
import { beginProoflineSignIn } from './auth';
const org = '10000000-0000-4000-8000-000000000001';
const managed = (): ProoflineSettings => ({
  ...defaultProoflineSettings(),
  aiMode: 'proofline',
  publishing: 'proofline',
  github: 'proofline',
  connection: {
    accessToken: 'private-test-token',
    organizationId: org,
    expiresAt: Date.now() + 60000,
    account: {
      user: { id: 'u1', login: 'alice' },
      organization: { id: org, login: 'alice', name: null, is_personal: true },
      organizations: [],
      default_organization_id: org,
      credits: { balance_microcredits: 1000000, microcredits_per_credit: 1000000 },
      repositories: [{ id: 'r1', full_name: 'alice/app', github_repository_id: 1 }],
    },
  },
});
let stored: Record<string, unknown>;
beforeEach(() => {
  stored = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async () => stored),
        set: vi.fn(async (value) => Object.assign(stored, value)),
        setAccessLevel: vi.fn(async () => {}),
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('Proofline integration boundaries', () => {
  it('preserves personal keys and keeps existing installs on personal mode', async () => {
    stored.sharingSettings = {
      repository: 'alice/legacy',
      githubToken: 'keep-pat',
      models: { openai: { apiKey: 'keep-key' } },
    };
    expect((await loadProoflineSettings()).aiMode).toBe('personal');
    const settings = await loadSharingSettings();
    expect(settings.models.openai.apiKey).toBe('keep-key');
    expect(configuredRepositories(settings)[0]?.token).toBe('keep-pat');
    await saveProoflineSettings({ ...managed(), connection: undefined });
    expect((stored.sharingSettings as typeof settings).models.openai.apiKey).toBe(
      'keep-key',
    );
    expect((await loadProoflineSettings()).aiMode).toBe('proofline'); // Disconnect must not silently spend personal keys.
  });
  it('uses only the authorized workspace repositories in managed mode', () => {
    expect(
      configuredRepositories({
        proofline: managed(),
        repositories: [{ id: 'legacy', repository: 'elsewhere/private', token: 'pat' }],
      }),
    ).toEqual([{ id: 'r1', repository: 'alice/app', token: '' }]);
  });
  it('stops credit-denied AI without another provider request', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 402 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      runProoflineAi(managed(), 'summary', { annotations: ['Make help clearer'] }),
    ).rejects.toThrow('no credits');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/organizations/${org}/recorder/ai`);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer private-test-token' });
  });
  it('refuses an expired connection before uploading evidence', async () => {
    const settings = managed();
    settings.connection!.expiresAt = 0;
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      runProoflineAi(settings, 'vocabulary', {
        annotations: [],
        page_text: 'Customer labels',
      }),
    ).rejects.toThrow('expired');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('resumes attachment upload with saved request IDs and never uploads HTML', async () => {
    let saved: ProoflinePublication | undefined;
    const bodies: { request_id: string; name?: string }[] = [];
    let failed = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        bodies.push(body);
        if (url.endsWith('/reports'))
          return Response.json({
            id: 'report-1',
            url: `https://proofline.sh/recorder/reports/${org}/report-1`,
          });
        if (!failed) {
          failed = true;
          return new Response('{}', { status: 503 });
        }
        return Response.json({ id: 'asset-1' });
      }),
    );
    const files = [
      { path: 'report.md', text: '# Report' },
      { path: 'index.html', text: '<script>unsafe()</script>' },
      { path: 'screenshots/1.png', bytes: new Uint8Array([1, 2]) },
    ];
    const save = async (publication: ProoflinePublication) => {
      saved = publication;
    };
    await expect(
      publishProoflineReport(
        managed(),
        files,
        'Feedback',
        'L1',
        undefined,
        save,
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toThrow('(503)');
    const retryId = saved!.attachments[0]!.requestId;
    await publishProoflineReport(
      managed(),
      files,
      'Feedback',
      'L1',
      saved,
      save,
      () => {},
      new AbortController().signal,
    );
    expect(bodies.filter((body) => !body.name)).toHaveLength(1);
    expect(bodies.filter((body) => body.name).map((body) => body.request_id)).toEqual([
      retryId,
      retryId,
    ]);
    expect(saved!.attachments.every((asset) => asset.uploaded)).toBe(true);
    expect(saved!.attachments.map((asset) => asset.path)).toEqual([
      'screenshots/1.png',
    ]);
  });
  it('never opens an off-origin verification URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ verification_uri_complete: 'https://other.example/login' }),
      ),
    );
    await expect(beginProoflineSignIn(new AbortController().signal)).rejects.toThrow(
      'invalid sign-in address',
    );
  });
});

it('sends decoded PCM through Proofline without leaking personal keys or a text-model override', async () => {
  const settings = managed();
  settings.model = 'text-model-override';
  stored.prooflineSettings = settings;
  const decode = vi.fn(async () => ({ pcmBase64: 'AAAAAA==' }));
  (chrome as unknown as { runtime: unknown }).runtime = { sendMessage: decode };
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    const request = JSON.parse(init.body as string);
    expect(request.operation).toBe('transcription');
    expect(request.model).toBeUndefined();
    expect(request.input.audio).toEqual({
      pcm_base64: 'AAAAAA==',
      sample_rate: 16000,
      provider: 'elevenlabs',
      keyterms: ['Proofline'],
    });
    expect(JSON.stringify(request)).not.toContain('never-send-this-key');
    return Response.json({
      id: request.request_id,
      status: 'completed',
      result: {
        text: 'Proofline recipes',
        words: [{ word: 'Proofline', start: 0, end: 0.6 }],
      },
    });
  });
  vi.stubGlobal('fetch', fetcher);
  const { transcribe } = await import('@/lib/transcription');
  const result = await transcribe(
    new Blob([new Uint8Array([1, 2])], { type: 'audio/webm' }),
    {
      provider: 'elevenlabs',
      apiKey: 'never-send-this-key',
      managed: true,
      keyterms: ['Proofline'],
      requestId: '10000000-0000-4000-8000-000000000010',
    },
  );
  expect(result).toEqual({
    text: 'Proofline recipes',
    words: [{ word: 'Proofline', t: 0 }],
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('clears a confirmed cancelled issue attempt so the user can submit again', async () => {
  const settings = await loadSharingSettings();
  settings.proofline = managed();
  const fetcher = vi.fn(async () =>
    Response.json({ request_id: 'attempt-1', status: 'cancelled' }),
  );
  vi.stubGlobal('fetch', fetcher);
  const { fileIssue } = await import('@/lib/sharing/file-issue');
  const save = vi.fn(async () => {});
  await expect(
    fileIssue({
      saved: {
        draft: { title: 'Improve recipes', body: 'Show help.' },
        repository: 'alice/app',
        attempt: {
          id: 'attempt-1',
          repository: 'alice/app',
          startedAt: new Date().toISOString(),
          proofline: { organizationId: org, reportId: 'report-1', repositoryId: 'r1' },
        },
      },
      settings,
      files: [],
      evidence: '',
      level: 'L1',
      save,
      progress: () => {},
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow('cancelled');
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ attempt: undefined }));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
