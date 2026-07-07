/**
 * PCM tap AudioWorkletProcessor for live transcription streaming.
 *
 * Accumulates mono input frames (128 samples each) into ~4096-sample batches
 * and posts them to the main thread as transferable Float32Arrays, replacing
 * the deprecated ScriptProcessorNode. Downsampling/encoding stays on the main
 * thread. Loaded by entrypoints/offscreen/main.ts via audioWorklet.addModule.
 */
const BATCH_SAMPLES = 4096;

class PcmTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunks = [];
    this.total = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length > 0) {
      this.chunks.push(ch.slice());
      this.total += ch.length;
      if (this.total >= BATCH_SAMPLES) {
        const out = new Float32Array(this.total);
        let offset = 0;
        for (const c of this.chunks) {
          out.set(c, offset);
          offset += c.length;
        }
        this.chunks = [];
        this.total = 0;
        this.port.postMessage(out, [out.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('pcm-tap', PcmTap);
