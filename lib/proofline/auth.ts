import { delay, prooflineRequest } from './client';
import {
  PROOFLINE_ORIGIN,
  type ProoflineAccount,
  type ProoflineConnection,
  type ProoflineSettings,
} from './settings';
const SCOPES = ['recorder:read', 'recorder:ai', 'recorder:reports', 'recorder:issues'];
export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}
export async function beginProoflineSignIn(
  signal: AbortSignal,
  organizationId?: string,
): Promise<DeviceCode> {
  const response = await fetch(`${PROOFLINE_ORIGIN}/auth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scopes: SCOPES,
      ...(organizationId ? { organization_id: organizationId } : {}),
    }),
    credentials: 'omit',
    redirect: 'error',
    signal,
  });
  if (!response.ok)
    throw new Error(`Proofline sign-in could not start (${response.status}).`);
  const code = (await response.json()) as DeviceCode;
  if (new URL(code.verification_uri_complete).origin !== PROOFLINE_ORIGIN)
    throw new Error('Proofline returned an invalid sign-in address.');
  return code;
}
export async function finishProoflineSignIn(
  code: DeviceCode,
  settings: ProoflineSettings,
  signal: AbortSignal,
): Promise<ProoflineConnection> {
  const expires = Date.now() + code.expires_in * 1000;
  let interval = Math.max(5, code.interval);
  while (Date.now() < expires) {
    await delay(interval * 1000, signal);
    const response = await fetch(`${PROOFLINE_ORIGIN}/auth/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: code.device_code,
      }),
      credentials: 'omit',
      redirect: 'error',
      signal,
    });
    const result = await response.json();
    if (response.ok) {
      if (
        !result.access_token ||
        !result.organization_id ||
        !Number.isFinite(result.expires_in)
      )
        throw new Error('Proofline returned an incomplete connection.');
      const connection = {
        accessToken: result.access_token,
        organizationId: result.organization_id,
        expiresAt: Date.now() + result.expires_in * 1000,
      } as ProoflineConnection;
      connection.account = await prooflineRequest<ProoflineAccount>(
        { ...settings, connection },
        '/account',
        { signal },
      );
      return connection;
    }
    if (result.error === 'slow_down') interval += 5;
    else if (result.error !== 'authorization_pending')
      throw new Error(
        result.error === 'access_denied'
          ? 'Proofline sign-in was declined.'
          : 'Proofline sign-in expired. Connect again.',
      );
  }
  throw new Error('Proofline sign-in expired. Connect again.');
}
