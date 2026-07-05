/**
 * Hashing helpers. `sha256Hex` for content addressing of assets, and a perceptual
 * average-hash (aHash) used to dedup near-identical screenshots. All functions
 * work in a service-worker context (no `document`): image decoding goes through
 * `OffscreenCanvas` + `createImageBitmap`.
 */

/** SHA-256 of the given data, as a lowercase hex string. */
export async function sha256Hex(
  data: ArrayBuffer | Uint8Array | Blob,
): Promise<string> {
  let buffer: ArrayBuffer | Uint8Array;
  if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else {
    buffer = data;
  }
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Average-hash (aHash) of an image as a 16-char hex string (64 bits).
 * Downscales to 8x8 grayscale via `OffscreenCanvas`, then sets each bit where the
 * pixel is >= the mean luminance.
 */
export async function averageHashFromBitmap(
  bitmap: ImageBitmap,
): Promise<string> {
  const size = 8;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('averageHashFromBitmap: 2D context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const count = size * size;
  const gray = new Float64Array(count);
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const r = data[o] ?? 0;
    const g = data[o + 1] ?? 0;
    const b = data[o + 2] ?? 0;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    sum += lum;
  }
  const mean = sum / count;

  // Build 64 bits, MSB-first, packed into 16 hex nibbles.
  let hex = '';
  for (let nibble = 0; nibble < count / 4; nibble++) {
    let value = 0;
    for (let bit = 0; bit < 4; bit++) {
      value <<= 1;
      if ((gray[nibble * 4 + bit] ?? 0) >= mean) {
        value |= 1;
      }
    }
    hex += value.toString(16);
  }
  return hex;
}

/** Average-hash of an image blob (decodes it first, then delegates). */
export async function averageHashFromBlob(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    return await averageHashFromBitmap(bitmap);
  } finally {
    bitmap.close();
  }
}

/**
 * Bit distance (Hamming distance) between two hex strings of equal length.
 * Any length mismatch is measured over the shorter overlap plus the full bit
 * count of the trailing remainder.
 */
export function hammingHex(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let distance = 0;
  for (let i = 0; i < len; i++) {
    const na = hexNibble(a[i]);
    const nb = hexNibble(b[i]);
    distance += popcount4(na ^ nb);
  }
  // Count any un-paired trailing nibbles as fully-set bits.
  const longer = a.length > b.length ? a : b;
  for (let i = len; i < longer.length; i++) {
    distance += popcount4(hexNibble(longer[i]));
  }
  return distance;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return hex;
}

function hexNibble(char: string | undefined): number {
  if (char === undefined) return 0;
  const n = parseInt(char, 16);
  return Number.isNaN(n) ? 0 : n;
}

function popcount4(n: number): number {
  let count = 0;
  let v = n & 0xf;
  while (v) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}
