/**
 * ID generation. URL-safe collision-resistant ids for sessions, events, and
 * assets. Optional prefix produces `${prefix}_${id}` for readable, sortable-by-
 * type identifiers.
 */

import { nanoid } from 'nanoid';

/** URL-safe nanoid(21). With a prefix, returns `${prefix}_${id}`. */
export function newId(prefix?: string): string {
  const id = nanoid(21);
  return prefix ? `${prefix}_${id}` : id;
}
