import type { Session } from '@/lib/session/types';
import { getAssetsMeta, getEvents, renameSessionIfUnchanged } from '@/lib/storage';
import { loadSharingSettings } from './settings';
import { generateSessionTitle, isModelConfigured, summaryEvidence } from './summary';

export async function nameRecordedSession(session: Session): Promise<Session | undefined> {
  const settings = await loadSharingSettings();
  const model = settings.models[settings.provider];
  if (!isModelConfigured(settings.provider, model)) return undefined;
  const [events, assets] = await Promise.all([getEvents(session.id), getAssetsMeta(session.id)]);
  if (!events.length) return undefined;
  const title = await generateSessionTitle(settings.provider, model, summaryEvidence(session, events, assets));
  return renameSessionIfUnchanged(session.id, session.name, title);
}
