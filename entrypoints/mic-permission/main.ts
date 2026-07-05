/**
 * Mic-permission page controller.
 *
 * MV3 offscreen documents can't trigger the getUserMedia permission prompt, so
 * this visible extension page does it once: the user gesture + extension origin
 * let Chrome grant mic access to the whole extension. On success we persist the
 * `micGranted` flag, release the stream, tell the user they can close the tab,
 * and attempt to close it automatically. On failure we surface the error.
 */
import { STORAGE_KEYS } from '@/lib/session/settings';

function setStatus(text: string, isError = false): void {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', isError);
}

async function requestPermission(): Promise<void> {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(`Microphone access was blocked: ${message}`, true);
    return;
  }

  // Persist the grant, then immediately release the device.
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.micGranted]: true });
  } catch {
    /* storage failure shouldn't strand the user; permission is still granted */
  }
  for (const track of stream.getTracks()) track.stop();

  setStatus('Microphone enabled — you can close this tab.');
  // Best-effort auto-close; browsers may refuse window.close() on some tabs.
  try {
    window.close();
  } catch {
    /* leave the confirmation message visible */
  }
}

void requestPermission();
