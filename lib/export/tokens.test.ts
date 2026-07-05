/**
 * Tests for the pure token estimator.
 */

import { describe, expect, it } from 'vitest';
import { estimateTokens } from './tokens';

describe('estimateTokens', () => {
  it('returns 0 for an empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('divides length by 4 and rounds up', () => {
    expect(estimateTokens('a')).toBe(1); // ceil(1/4)
    expect(estimateTokens('abc')).toBe(1); // ceil(3/4)
    expect(estimateTokens('abcd')).toBe(1); // ceil(4/4)
    expect(estimateTokens('abcde')).toBe(2); // ceil(5/4)
    expect(estimateTokens('abcdefgh')).toBe(2); // ceil(8/4)
  });

  it('handles longer strings', () => {
    expect(estimateTokens('x'.repeat(400))).toBe(100);
    expect(estimateTokens('x'.repeat(401))).toBe(101);
  });
});
