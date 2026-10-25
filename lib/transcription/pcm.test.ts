import { expect, it } from 'vitest';
import { floatToPcm16 } from './pcm';
it('encodes mono samples as clipped signed little-endian PCM for server duration metering', () => {
  expect([...floatToPcm16(new Float32Array([-2, -1, 0, 0.5, 1, 2]))]).toEqual([
    0, 128, 0, 128, 0, 0, 0, 64, 255, 127, 255, 127,
  ]);
});
