/**
 * Shared identifier for the annotation overlay's shadow-DOM host element.
 *
 * Lives in its own tiny module so both the annotation content script (which
 * creates the host) and the interaction content script (which must ignore
 * pointer/keyboard events that retarget to it while annotating) agree on the id
 * without importing each other's bundles.
 */
export const ANNOTATION_HOST_ID = '__session_recorder_annotation_host__';

/** True when an event target is (or lives inside) the annotation overlay host. */
export function isAnnotationOverlay(target: unknown): boolean {
  return target instanceof Element && target.id === ANNOTATION_HOST_ID;
}
