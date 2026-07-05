/**
 * Offscreen audio recorder.
 *
 * MV3 service workers cannot call `getUserMedia`/`MediaRecorder`, so all mic
 * capture lives here. The background drives this document with `audio/start`,
 * `audio/pause`, `audio/resume`, `audio/stop` control messages; this module
 * cuts the microphone stream into complete 30-second WebM/Opus segments
 * (also on pause and stop) and streams them back as `audio/segment` messages
 * (Blob -> data URL, since Blobs can't cross runtime messaging). A parallel
 * AnalyserNode posts throttled `audio/level` RMS updates for the live meter.
 */
import { sendMessage } from '@/lib/messaging';
import type { RequestMessage } from '@/lib/messaging';

const MIME_PREFERRED = 'audio/webm;codecs=opus';
const SEGMENT_MS = 30_000;
const LEVEL_INTERVAL_MS = 100; // ~10 posts/sec

type RecState = 'idle' | 'recording' | 'paused';
type StopReason = 'segment' | 'pause' | 'stop';

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

let chunks: Blob[] = [];
let sessionId = '';
let mimeType = MIME_PREFERRED;

/** performance.now() captured at audio start, for monotonic elapsed time. */
let perfStart = 0;
/** ms offset from the session's `startedAt` to audio start, so segment
 *  timestamps are expressed relative to `startedAt`. */
let baseOffset = 0;
/** Start-of-current-segment timestamp (ms relative to `startedAt`). */
let segStart = 0;

let state: RecState = 'idle';
let stopReason: StopReason | null = null;
let segmentTimer: ReturnType<typeof setInterval> | null = null;
let levelTimer: ReturnType<typeof setInterval> | null = null;

/** ms elapsed relative to the session's `startedAt`. */
function elapsed(): number {
  return Math.max(0, Math.round(baseOffset + (performance.now() - perfStart)));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function emitSegment(blob: Blob, tStart: number, tEnd: number): Promise<void> {
  if (blob.size === 0) return;
  try {
    const dataUrl = await blobToDataUrl(blob);
    await sendMessage({
      kind: 'audio/segment',
      sessionId,
      tStart,
      tEnd,
      dataUrl,
      mime: mimeType,
    });
  } catch {
    /* background not listening (e.g. session torn down) — drop it */
  }
}

function startRecorder(): void {
  if (!stream) return;
  chunks = [];
  const rec = new MediaRecorder(stream, { mimeType });
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  rec.onstop = handleStop;
  recorder = rec;
  segStart = elapsed();
  rec.start(); // no timeslice: a single dataavailable with the whole segment
}

/**
 * Fires when a MediaRecorder stops (segment rotation, pause, or full stop).
 * Assembles the collected chunks into one complete WebM Blob, emits it, then
 * either restarts for the next segment or tears down.
 */
async function handleStop(): Promise<void> {
  const blob = new Blob(chunks, { type: mimeType });
  const tStart = segStart;
  const tEnd = elapsed();
  const reason = stopReason;
  stopReason = null;
  chunks = [];

  // Await delivery so a full stop only completes after the final segment has
  // actually been handed to the background (it tears this document down as soon
  // as we resolve, which would otherwise kill an in-flight segment).
  await emitSegment(blob, tStart, tEnd);

  if (reason === 'segment') {
    if (state === 'recording') startRecorder();
  } else if (reason === 'stop') {
    teardown();
    const resolve = stopFlushResolve;
    stopFlushResolve = null;
    if (resolve) resolve();
  }
  // 'pause': stay stopped; recorder is left inactive until resume.
}

/** Resolves the pending full-stop once its final segment has been delivered. */
let stopFlushResolve: (() => void) | null = null;

/** Rotate to a fresh segment on the 30s cadence. */
function rotateSegment(): void {
  if (state !== 'recording') return;
  if (!recorder || recorder.state !== 'recording') return;
  stopReason = 'segment';
  recorder.stop();
}

function startLevelLoop(): void {
  if (!analyser || levelTimer !== null) return;
  const buf = new Float32Array(analyser.fftSize);
  levelTimer = setInterval(() => {
    if (state !== 'recording' || !analyser) return;
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i] ?? 0;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    const level = Math.min(1, Math.max(0, rms));
    void sendMessage({ kind: 'audio/level', level }).catch(() => {
      /* no listener — ignore */
    });
  }, LEVEL_INTERVAL_MS);
}

function stopLevelLoop(): void {
  if (levelTimer !== null) {
    clearInterval(levelTimer);
    levelTimer = null;
  }
}

function teardown(): void {
  if (segmentTimer !== null) {
    clearInterval(segmentTimer);
    segmentTimer = null;
  }
  stopLevelLoop();

  if (recorder && recorder.state !== 'inactive') {
    try {
      recorder.stop();
    } catch {
      /* already stopping */
    }
  }
  recorder = null;

  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch {
      /* noop */
    }
    sourceNode = null;
  }
  analyser = null;

  if (audioCtx && audioCtx.state !== 'closed') {
    void audioCtx.close().catch(() => {
      /* noop */
    });
  }
  audioCtx = null;

  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }

  chunks = [];
  stopReason = null;
  state = 'idle';
}

async function handleStart(
  id: string,
  startedAt: number,
): Promise<{ ok: boolean; error?: string }> {
  // A start while already active replaces the prior recording cleanly.
  if (state !== 'idle') teardown();

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    stream = null;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  sessionId = id;
  mimeType = MediaRecorder.isTypeSupported(MIME_PREFERRED)
    ? MIME_PREFERRED
    : 'audio/webm';
  perfStart = performance.now();
  baseOffset = Math.max(0, Date.now() - startedAt);
  state = 'recording';

  // Level metering pipeline.
  try {
    audioCtx = new AudioContext();
    sourceNode = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    sourceNode.connect(analyser);
    startLevelLoop();
  } catch {
    /* metering is best-effort; recording continues without it */
  }

  startRecorder();
  segmentTimer = setInterval(rotateSegment, SEGMENT_MS);
  return { ok: true };
}

function handlePause(): void {
  if (state !== 'recording') return;
  state = 'paused';
  stopLevelLoop();
  if (recorder && recorder.state === 'recording') {
    stopReason = 'pause';
    recorder.stop();
  }
}

function handleResume(): void {
  if (state !== 'paused' || !stream) return;
  state = 'recording';
  startRecorder();
  startLevelLoop();
}

function handleStopControl(): Promise<void> {
  if (state === 'idle') {
    teardown();
    return Promise.resolve();
  }
  // Prevent the cadence timer from racing the shutdown.
  if (segmentTimer !== null) {
    clearInterval(segmentTimer);
    segmentTimer = null;
  }
  stopLevelLoop();

  const rec = recorder;
  if (rec && rec.state === 'recording') {
    // Resolve only once handleStop has emitted + delivered the final segment.
    return new Promise<void>((resolve) => {
      stopFlushResolve = resolve;
      state = 'idle';
      stopReason = 'stop';
      rec.stop();
    });
  }
  // Paused: recorder is already inactive, nothing left to flush.
  teardown();
  return Promise.resolve();
}

chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  const msg = raw as { kind?: unknown };
  if (!msg || typeof msg.kind !== 'string') return false;

  switch (msg.kind) {
    case 'audio/start': {
      const m = raw as Extract<RequestMessage, { kind: 'audio/start' }>;
      void handleStart(m.sessionId, m.startedAt).then((res) =>
        sendResponse(res),
      );
      return true; // async response
    }
    case 'audio/pause':
      handlePause();
      sendResponse({ ok: true });
      return false;
    case 'audio/resume':
      handleResume();
      sendResponse({ ok: true });
      return false;
    case 'audio/stop':
      // Respond only after the final segment has been flushed + delivered, so
      // the background can safely tear down the offscreen document.
      void handleStopControl().then(() => sendResponse({ ok: true }));
      return true; // async response
    default:
      return false; // not ours (broadcasts, other requests)
  }
});
