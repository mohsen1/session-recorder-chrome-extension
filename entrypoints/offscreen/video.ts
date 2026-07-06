/**
 * Offscreen tab-video recorder.
 *
 * Companion to the audio recorder in `main.ts`: MV3 service workers cannot call
 * `getUserMedia`/`MediaRecorder`, so tab capture lives here. The background
 * resolves a `chrome.tabCapture.getMediaStreamId` for the session tab and
 * drives this module with `video/start`, `video/pause`, `video/resume`,
 * `video/stop`. Unlike audio there is NO segment rotation: one recorder runs
 * per record-span and is finalized into a single segment on pause or stop.
 * A take is unbounded in size, so the finished Blob is written straight to the
 * shared IndexedDB (this document lives on the extension origin) and only a
 * tiny `video/segment` announcement crosses runtime messaging — a data URL
 * would exceed the message size limit after a few minutes of recording.
 * A tabCapture stream id is single-use and the captured stream dies when its
 * recorder stops, so `video/resume` must arrive with a FRESH stream id from
 * the background.
 */
import { sendMessage } from '@/lib/messaging';
import { putAsset } from '@/lib/storage';
import { newId } from '@/lib/util/ids';
import type { Asset } from '@/lib/session/types';

/** Preferred codecs, best first; `pickMime` takes the first supported one. */
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

/** Bounded bitrate (~2.5 Mbps) so long takes stay storage-friendly. */
const VIDEO_BITS_PER_SECOND = 2_500_000;

type VideoState = 'idle' | 'recording' | 'paused';
type StopReason = 'pause' | 'stop';

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let sessionId = '';
let mimeType = 'video/webm';

/** performance.now() captured at video start, for monotonic elapsed time. */
let perfStart = 0;
/** ms offset from the session's `startedAt` to video start. */
let baseOffset = 0;
/** Start-of-current-segment timestamp (ms relative to `startedAt`). */
let segStart = 0;

let state: VideoState = 'idle';
let stopReason: StopReason | null = null;
/**
 * In-flight segment flush: set the moment a recorder stop is initiated and
 * resolved by `handleStop` once the segment has been stored + announced.
 * `video/stop`/`video/resume`/`video/start` MUST await it — acting mid-flush
 * would tear the document down before delivery (losing the take) or start a
 * second recorder whose chunks interleave with the dying one's.
 */
let flushing: Promise<void> | null = null;
let flushResolve: (() => void) | null = null;
/** Bumped on every recorder start so a stale `handleStop` tail cannot clobber
 *  the state of a capture that (re)started while it was awaiting delivery. */
let generation = 0;

/** ms elapsed relative to the session's `startedAt`. */
function elapsed(): number {
  return Math.max(0, Math.round(baseOffset + (performance.now() - perfStart)));
}

function pickMime(): string {
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Start tracking a flush (idempotent); `handleStop` resolves it when done. */
function beginFlush(): Promise<void> {
  if (!flushing) {
    flushing = new Promise<void>((resolve) => {
      flushResolve = resolve;
    });
  }
  return flushing;
}

function endFlush(): void {
  const resolve = flushResolve;
  flushing = null;
  flushResolve = null;
  if (resolve) resolve();
}

/**
 * `chromeMediaSource: 'tab'` is a Chrome-only mandatory constraint that the
 * standard `MediaStreamConstraints` type does not know about, hence the cast.
 */
function acquireStream(streamId: string): Promise<MediaStream> {
  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
  } as unknown as MediaStreamConstraints;
  return navigator.mediaDevices.getUserMedia(constraints);
}

function releaseStream(): void {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
}

async function emitSegment(blob: Blob, tStart: number, tEnd: number): Promise<void> {
  if (blob.size === 0) return;
  try {
    // Write the blob straight to the shared IndexedDB: a multi-minute take is
    // far too large to cross runtime messaging as a data URL. Only the asset
    // id travels; the background records the event and books the bytes.
    const asset: Asset = {
      id: newId('ast'),
      sessionId,
      kind: 'video',
      mime: mimeType,
      size: blob.size,
      blob,
    };
    await putAsset(asset);
    await sendMessage({
      kind: 'video/segment',
      sessionId,
      tStart,
      tEnd,
      assetId: asset.id,
      size: blob.size,
    });
  } catch {
    /* background not listening (e.g. session torn down) — drop it */
  }
}

function startRecorder(): void {
  if (!stream) return;
  generation += 1;
  chunks = [];
  const rec = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
  });
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  rec.onstop = () => {
    // Stops we did not initiate (dead tab, recorder error) still need an
    // awaitable flush; stops we did initiate already began one.
    beginFlush();
    void handleStop();
  };
  // Best-effort: a recorder error still flushes whatever was captured.
  rec.onerror = () => {
    if (rec.state !== 'inactive') {
      try {
        beginFlush();
        rec.stop();
      } catch {
        /* already stopping */
      }
    }
  };
  recorder = rec;
  segStart = elapsed();
  try {
    rec.start(); // no timeslice: a single dataavailable with the whole segment
  } catch (err) {
    // A failed start never fires onstop — reset here so stop/resume don't
    // wait on a flush that will never come.
    recorder = null;
    releaseStream();
    state = 'idle';
    throw err;
  }
}

/**
 * Fires when the recorder stops: an explicit pause/stop, a recorder error, or
 * the captured tab going away (Chrome ends the track, which stops the
 * recorder). Assembles the chunks into one complete WebM Blob, emits it, and
 * settles the state machine. Any non-`stop` reason leaves us `paused`: the
 * stream is dead either way and only a fresh streamId (via `video/resume`) can
 * restart capture.
 */
async function handleStop(): Promise<void> {
  const gen = generation;
  const blob = new Blob(chunks, { type: mimeType });
  const tStart = segStart;
  const tEnd = elapsed();
  const reason = stopReason;
  stopReason = null;
  chunks = [];
  recorder = null;
  releaseStream();

  // Await delivery so a full stop only completes after the final segment has
  // actually been handed to the background (it tears this document down as
  // soon as the flush resolves).
  await emitSegment(blob, tStart, tEnd);

  if (reason === 'stop') {
    state = 'idle';
  } else if (generation === gen) {
    // Only settle to 'paused' when no new capture started while we were
    // emitting — resume awaits the flush, but stay defensive.
    state = 'paused';
  }
  endFlush();
}

export async function handleVideoStart(
  id: string,
  startedAt: number,
  streamId: string,
): Promise<{ ok: boolean; error?: string }> {
  // A start while already active replaces the prior recording cleanly.
  if (state !== 'idle') await handleVideoStop();

  try {
    stream = await acquireStream(streamId);
  } catch (err) {
    stream = null;
    return { ok: false, error: errText(err) };
  }

  sessionId = id;
  mimeType = pickMime();
  perfStart = performance.now();
  baseOffset = Math.max(0, Date.now() - startedAt);
  state = 'recording';
  try {
    startRecorder();
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
  return { ok: true };
}

export function handleVideoPause(): void {
  if (state !== 'recording') return;
  state = 'paused';
  if (recorder && recorder.state === 'recording') {
    // Track the flush BEFORE stopping: a resume/stop that arrives while the
    // segment is still being stored must wait for it (see `flushing`).
    beginFlush();
    stopReason = 'pause';
    recorder.stop();
  } else {
    releaseStream();
  }
}

export async function handleVideoResume(
  streamId: string,
): Promise<{ ok: boolean; error?: string }> {
  // A pause flush may still be storing the previous segment; starting a new
  // recorder before it finishes would interleave two takes' chunks and let
  // handleStop's tail clobber the fresh 'recording' state.
  while (flushing) await flushing;
  if (state !== 'paused') {
    return { ok: false, error: 'Video recorder is not paused.' };
  }
  try {
    stream = await acquireStream(streamId);
  } catch (err) {
    stream = null;
    return { ok: false, error: errText(err) };
  }
  state = 'recording';
  try {
    startRecorder();
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
  return { ok: true };
}

export async function handleVideoStop(): Promise<void> {
  // Let an in-flight flush (session pause, recorder error, dead tab) deliver
  // its segment first — resolving before delivery lets the background destroy
  // this document and lose the take.
  while (flushing) await flushing;

  const rec = recorder;
  if (rec) {
    // Still recording — or stopped by the browser with its onstop not yet
    // fired. Either way handleStop delivers the final segment; resolve only
    // once that flush completes.
    const flushed = beginFlush();
    stopReason = 'stop';
    if (rec.state === 'recording') rec.stop();
    await flushed;
    return;
  }
  // Idle or paused: the last segment was already flushed; just reset.
  releaseStream();
  chunks = [];
  stopReason = null;
  state = 'idle';
}
