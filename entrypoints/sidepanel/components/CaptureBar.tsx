/**
 * The mid-session capture bar, pinned to the bottom of the recording view.
 *
 * Primary row (matches the design): a mic toggle with a live level waveform,
 * plus Video, Annotate, and Screenshot (a manual shot — never deduped). Above
 * it, a slim row for the two lower-frequency actions: attach a file and add a
 * note. When the mic is on, an interim transcript line shows the recognizer
 * keeping up in real time.
 */
import React, { useRef, useState } from 'react';
import { Mic, PenLine, Camera, Paperclip, Video } from 'lucide-react';
import { useSidepanel } from '../store';
import {
  isTranscriptionConfigured,
  VoiceSetupModal,
} from './VoiceSetupModal';

/** A small waveform whose bars scale with the live mic level. */
function Waveform({ level, on }: { level: number; on: boolean }): React.JSX.Element {
  const bars = [0.3, 0.7, 0.45, 0.9, 0.55, 1, 0.6, 0.8, 0.4, 0.7, 0.5, 0.85, 0.35];
  return (
    <span className="waveform" aria-hidden="true">
      {bars.map((b, i) => (
        <span
          key={i}
          className="waveform__bar"
          style={{ height: `${on ? Math.max(12, b * level * 100) : 12}%` }}
        />
      ))}
    </span>
  );
}

export function CaptureBar(): React.JSX.Element {
  const micOn = useSidepanel((s) => s.micOn);
  const micLevel = useSidepanel((s) => s.micLevel);
  const liveTranscript = useSidepanel((s) => s.liveTranscript);
  const videoOn = useSidepanel((s) => s.videoOn);
  const annotating = useSidepanel((s) => s.annotating);
  const toggleMic = useSidepanel((s) => s.toggleMic);
  const toggleVideo = useSidepanel((s) => s.toggleVideo);
  const toggleAnnotate = useSidepanel((s) => s.toggleAnnotate);
  const captureScreenshot = useSidepanel((s) => s.captureScreenshot);
  const addNote = useSidepanel((s) => s.addNote);
  const attachFile = useSidepanel((s) => s.attachFile);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [voiceSetupOpen, setVoiceSetupOpen] = useState(false);

  // First mic use without a transcription provider: offer setup before
  // turning the mic on (the user can also proceed with raw audio only).
  const onMicClick = async () => {
    if (!micOn && !(await isTranscriptionConfigured())) {
      setVoiceSetupOpen(true);
      return;
    }
    await toggleMic();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await attachFile(file);
  };

  const submitNote = async () => {
    const text = note;
    if (!text.trim()) return;
    setNote('');
    await addNote(text);
  };

  const level = Math.max(0, Math.min(1, micLevel));

  return (
    <div className="capture">
      {voiceSetupOpen && (
        <VoiceSetupModal
          onDone={() => {
            setVoiceSetupOpen(false);
            void toggleMic();
          }}
          onCancel={() => setVoiceSetupOpen(false)}
        />
      )}
      {micOn && (
        <div className="capture__transcript" aria-live="polite">
          <Mic size={12} strokeWidth={2} className="capture__transcript-icon" />
          <span
            className={`capture__transcript-text${
              liveTranscript ? '' : ' capture__transcript-text--idle'
            }`}
          >
            {liveTranscript || 'Listening…'}
          </span>
        </div>
      )}

      <form
        className="capture__note"
        onSubmit={(e) => {
          e.preventDefault();
          void submitNote();
        }}
      >
        <button
          type="button"
          className="icon-btn"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach a file"
          title="Attach a file"
        >
          <Paperclip size={15} />
        </button>
        <input
          type="text"
          className="capture__note-input"
          placeholder="Add a note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {note.trim() && (
          <button type="submit" className="btn btn--sm">
            Add
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(e) => void onFileChange(e)}
        />
      </form>

      <div className="capture__bar">
        <button
          type="button"
          className={`capture__mic ${micOn ? 'capture__mic--on' : ''}`}
          onClick={() => void onMicClick()}
          aria-pressed={micOn}
          title={micOn ? 'Turn the mic off' : 'Turn the mic on'}
        >
          <Mic size={16} strokeWidth={2} />
          <span className="capture__label">{micOn ? 'Mic on' : 'Mic'}</span>
          {micOn && <Waveform level={level} on={micOn} />}
        </button>
        <button
          type="button"
          className={`capture__action ${videoOn ? 'capture__action--on' : ''}`}
          onClick={() => void toggleVideo()}
          aria-pressed={videoOn}
          title={videoOn ? 'Stop video recording' : 'Record the tab as video'}
        >
          <Video size={15} />
          <span className="capture__label">{videoOn ? 'Video on' : 'Video'}</span>
        </button>
        <button
          type="button"
          className={`capture__action ${annotating ? 'capture__action--on' : ''}`}
          onClick={() => void toggleAnnotate()}
          aria-pressed={annotating}
          title="Draw on the page"
        >
          <PenLine size={15} />
          <span className="capture__label">Annotate</span>
        </button>
        <button
          type="button"
          className="capture__action"
          onClick={() => void captureScreenshot()}
          title="Take a screenshot (always kept, never deduped)"
        >
          <Camera size={15} />
          <span className="capture__label">Screenshot</span>
        </button>
      </div>
    </div>
  );
}
