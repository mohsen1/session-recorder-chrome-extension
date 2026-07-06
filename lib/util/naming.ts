/**
 * Shared session-derived file/folder naming for downloads.
 */
import type { Session } from '@/lib/session/types';

/**
 * Zip / download folder name for a session: a slug of the session title (the
 * starting page's title) plus the date, e.g.
 * `xkcd-the-general-problem-2026-07-05`. Falls back to `session-<date>` when
 * the name slugs to nothing.
 */
export function sessionFolderName(session: Session): string {
  const d = new Date(session.startedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const slug = session.name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug ? `${slug}-${date}` : `session-${date}`;
}
