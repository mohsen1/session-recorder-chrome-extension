import { runProoflineAi, recordedEvidence } from '@/lib/proofline/ai';
import type { Session } from '@/lib/session/types';
import { getAssetsMeta, getEvents, renameSessionIfUnchanged } from '@/lib/storage';
import { loadSharingSettings } from './settings';
import { generateSessionTitle, isSummaryConfigured, summaryEvidence } from './summary';

export async function nameRecordedSession(session: Session): Promise<Session | undefined> {
  const settings = await loadSharingSettings();
  const model = settings.models[settings.provider];
  if (!isSummaryConfigured(settings)) return undefined;
  const [events, assets] = await Promise.all([getEvents(session.id), getAssetsMeta(session.id)]);
  if (!events.length) return undefined;
  const evidence = summaryEvidence(session, events, assets);
  const title = settings.proofline?.aiMode === 'proofline'
    ? (await runProoflineAi(settings.proofline, 'session_title', recordedEvidence(evidence), AbortSignal.timeout(120_000))).title
    : await generateSessionTitle(settings.provider, model, evidence);
  if (!title?.trim()) return undefined;
  return renameSessionIfUnchanged(session.id, session.name, title);
}
