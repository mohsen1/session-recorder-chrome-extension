/**
 * The mid-session capture toolbar: mic toggle with a live level meter, annotate
 * toggle, file attach (hidden <input type=file> -> file/attach with a data URL),
 * an instant marker button, and a note text field.
 */

import React, { useRef, useState } from 'react';
import { useSidepanel } from '../store';

export function CaptureBar(): React.JSX.Element {
  const micOn = useSidepanel((s) => s.micOn);
  const micLevel = useSidepanel((s) => s.micLevel);
  const liveTranscript = useSidepanel((s) => s.liveTranscript);
  const annotating = useSidepanel((s) => s.annotating);
  const toggleMic = useSidepanel((s) => s.toggleMic);
  const toggleAnnotate = useSidepanel((s) => s.toggleAnnotate);
  const addMarker = useSidepanel((s) => s.addMarker);
  const addNote = useSidepanel((s) => s.addNote);
  const attachFile = useSidepanel((s) => s.attachFile);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected later.
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
    <div className="capture-bar">
      <div className="capture-bar__row">
        <button
          type="button"
          className={`chip-btn ${micOn ? 'chip-btn--on' : ''}`}
          onClick={() => void toggleMic()}
          aria-pressed={micOn}
        >
          {micOn && <span className="rec-badge__dot" aria-hidden="true" />}
          Mic
        </button>
        <div className="mic-meter" aria-hidden="true">
          <div
            className="mic-meter__fill"
            style={{ width: `${micOn ? level * 100 : 0}%` }}
          />
        </div>
        <button
          type="button"
          className={`chip-btn ${annotating ? 'chip-btn--on' : ''}`}
          onClick={() => void toggleAnnotate()}
          aria-pressed={annotating}
        >
          Annotate
        </button>
      </div>

      {micOn && (
        <div className="capture-bar__transcript" aria-live="polite">
          <span className="capture-bar__transcript-tag">VOICE</span>
          <span
            className={`capture-bar__transcript-text${
              liveTranscript ? '' : ' capture-bar__transcript-text--idle'
            }`}
          >
            {liveTranscript || 'Listening…'}
          </span>
        </div>
      )}

      <div className="capture-bar__row">
        <button type="button" className="chip-btn" onClick={onPickFile}>
          Attach
        </button>
        <button
          type="button"
          className="chip-btn"
          onClick={() => void addMarker()}
        >
          + Marker
        </button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(e) => void onFileChange(e)}
        />
      </div>

      <form
        className="note-row"
        onSubmit={(e) => {
          e.preventDefault();
          void submitNote();
        }}
      >
        <input
          type="text"
          className="note-input"
          placeholder="Add a note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="submit"
          className="chip-btn"
          disabled={!note.trim()}
        >
          Add
        </button>
      </form>
    </div>
  );
}
