/**
 * Pure token-count estimation for export sizing.
 *
 * Uses the common heuristic of ~4 characters per token. No chrome/DOM/network
 * access and no input mutation.
 */

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
