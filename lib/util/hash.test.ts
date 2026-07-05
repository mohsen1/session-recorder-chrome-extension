/** Unit tests for the node-safe hash helpers (sha256Hex, hammingHex). */
import { describe, it, expect } from 'vitest';
import { sha256Hex, hammingHex } from './hash';
import { newId } from './ids';

describe('sha256Hex', () => {
  it('hashes empty input to the known digest', async () => {
    const out = await sha256Hex(new Uint8Array(0));
    expect(out).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('hashes "abc" correctly and accepts ArrayBuffer + Blob', async () => {
    const known =
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    const bytes = new TextEncoder().encode('abc');
    expect(await sha256Hex(bytes)).toBe(known);
    expect(await sha256Hex(bytes.buffer)).toBe(known);
    expect(await sha256Hex(new Blob([bytes]))).toBe(known);
  });
});

describe('hammingHex', () => {
  it('is zero for identical hashes', () => {
    expect(hammingHex('ffffffffffffffff', 'ffffffffffffffff')).toBe(0);
  });
  it('counts differing bits', () => {
    expect(hammingHex('0', '1')).toBe(1);
    expect(hammingHex('0', 'f')).toBe(4);
    expect(hammingHex('00', 'ff')).toBe(8);
    expect(hammingHex('a', '5')).toBe(4); // 1010 vs 0101
  });
  it('handles length mismatch by counting trailing bits', () => {
    expect(hammingHex('0', '0f')).toBe(4);
  });
});

describe('newId', () => {
  it('produces url-safe ids and applies prefix', () => {
    const bare = newId();
    expect(bare).toHaveLength(21);
    expect(bare).toMatch(/^[A-Za-z0-9_-]{21}$/);
    const pref = newId('evt');
    expect(pref).toMatch(/^evt_[A-Za-z0-9_-]{21}$/);
    expect(newId()).not.toBe(newId());
  });
});
