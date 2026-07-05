/**
 * Zip packaging for export bundles.
 *
 * Wraps fflate's callback-style `zip` in a Promise, prefixes every entry path
 * with the bundle root directory, and encodes text entries via `TextEncoder`.
 * Returns the finished archive as a `Uint8Array`.
 */

import { zip } from 'fflate';
import type { ExportFile } from './bundle';

export async function zipFiles(
  files: ExportFile[],
  rootDir: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const entries: Record<string, Uint8Array> = {};

  for (const file of files) {
    const path = `${rootDir}/${file.path}`;
    const data = file.bytes ?? enc.encode(file.text ?? '');
    entries[path] = data;
  }

  return await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}
