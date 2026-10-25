/** Decode captured WebM to deterministic mono PCM in the offscreen document. */
export async function decodePcm16(dataUrl: string): Promise<string> {
  if (
    !/^data:audio\/(webm|ogg|wav|mpeg|mp4)(;[^,]*)?;base64,/.test(dataUrl) ||
    dataUrl.length > 30 * 1024 * 1024
  )
    throw new Error('Invalid or oversized recorded audio.');
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const data = await (await fetch(dataUrl)).arrayBuffer();
    const decoded = await context.decodeAudioData(data);
    if (decoded.duration > 600)
      throw new Error('Audio segments must be shorter than ten minutes.');
    const frames = Math.ceil(decoded.duration * 16000);
    const offline = new OfflineAudioContext(1, frames, 16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    const bytes = floatToPcm16(rendered.getChannelData(0));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  } finally {
    await context.close();
  }
}
export function floatToPcm16(samples: Float32Array): Uint8Array {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return new Uint8Array(buffer);
}
