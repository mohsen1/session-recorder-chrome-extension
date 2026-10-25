import {
  PROOFLINE_ORIGIN,
  requireConnection,
  type ProoflineSettings,
} from './settings';

export class ProoflineError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}
export async function prooflineRequest<T>(
  settings: ProoflineSettings,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const connection = requireConnection(settings);
  const response = await fetch(
    `${PROOFLINE_ORIGIN}/api/v1/organizations/${encodeURIComponent(connection.organizationId)}/recorder${path}`,
    {
      ...init,
      headers: {
        ...(typeof init.body === 'string'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...init.headers,
        Authorization: `Bearer ${connection.accessToken}`,
      },
      credentials: 'omit',
      redirect: 'error',
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(120_000)])
        : AbortSignal.timeout(120_000),
    },
  );
  if (!response.ok) {
    const code = response.status === 402 ? 'recorder_credits_exhausted' : undefined;
    const message =
      response.status === 402
        ? 'Your Proofline workspace has no credits available. Top up in Proofline or switch to personal API keys in Settings → Proofline.'
        : response.status === 401
          ? 'Reconnect to Proofline in Settings → Proofline.'
          : response.status === 403
            ? 'Your Proofline account does not have access to this workspace, repository or report.'
            : response.status === 413
              ? 'This upload exceeds the report or workspace storage limit. Free up storage or use Cloudflare.'
              : `Proofline could not complete the request (${response.status}). Try again or check your Proofline settings.`;
    throw new ProoflineError(message, response.status, code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const finish = () => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    const cancel = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException('Cancelled', 'AbortError'));
    };
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
