/**
 * Annotation overlay content script (ISOLATED world).
 *
 * Dormant until the background sends `{kind:'content/annotate', on:true}`. On
 * enable it mounts a full-viewport drawing surface inside a shadow root: a
 * devicePixelRatio-aware <canvas> plus a floating, draggable toolbar (pen,
 * arrow, rect, ellipse, text, highlighter, redact + color / stroke / undo /
 * redo / clear / done / cancel). Shapes are a plain vector list
 * (`AnnotationShape[]`) redrawn from scratch on every change; undo/redo is an
 * index into a snapshot history. On Done each shape is hit-tested against the
 * page element beneath its anchor (via `buildDescriptor`), then
 * `annotation/exit` is sent to the background (which screenshots the annotated
 * page) and only afterwards is the overlay removed. On Cancel the overlay is
 * removed with no message. Everything is guarded — this script never throws
 * into the host page.
 */

import { defineContentScript } from 'wxt/sandbox';
import { buildDescriptor } from '@/lib/dom/descriptor';
import { onContentMessage, sendMessage } from '@/lib/messaging';
import type {
  AnnotationShape,
  AnnotationTool,
  ElementDescriptor,
  Point,
  Rect,
} from '@/lib/session/types';

const MAX_Z = 2147483647;
const DEFAULT_COLOR = '#ff3b30';
const DEFAULT_STROKE = 4;
const HOST_ID = '__session_recorder_annotation_host__';

interface ToolSpec {
  tool: AnnotationTool;
  label: string;
  title: string;
}

const TOOLS: ToolSpec[] = [
  { tool: 'pen', label: '✎', title: 'Pen' },
  { tool: 'arrow', label: '↗', title: 'Arrow' },
  { tool: 'rect', label: '▭', title: 'Rectangle' },
  { tool: 'ellipse', label: '◯', title: 'Ellipse' },
  { tool: 'text', label: 'T', title: 'Text' },
  { tool: 'highlighter', label: '▨', title: 'Highlighter' },
  { tool: 'redact', label: '█', title: 'Redact' },
];

// ---------------------------------------------------------------------------
// Geometry helpers (pure)
// ---------------------------------------------------------------------------

function normRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

/** The page point a shape "points at", used to hit-test the element beneath. */
function anchorOf(shape: AnnotationShape): Point {
  if (shape.rect) {
    return { x: shape.rect.x + shape.rect.w / 2, y: shape.rect.y + shape.rect.h / 2 };
  }
  if (shape.to) return shape.to;
  if (shape.points && shape.points.length > 0) {
    const p0 = shape.points[0];
    if (p0) return p0;
  }
  if (shape.from) return shape.from;
  return { x: 0, y: 0 };
}

function cloneShape(s: AnnotationShape): AnnotationShape {
  return {
    tool: s.tool,
    color: s.color,
    strokeWidth: s.strokeWidth,
    ...(s.points ? { points: s.points.map((p) => ({ x: p.x, y: p.y })) } : {}),
    ...(s.rect ? { rect: { ...s.rect } } : {}),
    ...(s.from ? { from: { ...s.from } } : {}),
    ...(s.to ? { to: { ...s.to } } : {}),
    ...(s.text !== undefined ? { text: s.text } : {}),
  };
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

class AnnotationEditor {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly toolbar: HTMLDivElement;
  private textInput: HTMLInputElement | null = null;

  private tool: AnnotationTool = 'pen';
  private color = DEFAULT_COLOR;
  private strokeWidth = DEFAULT_STROKE;

  /** Snapshot history; each entry is the full shape list at that point. */
  private undoStack: AnnotationShape[][] = [[]];
  private index = 0;

  private draft: AnnotationShape | null = null;
  private draftStart: Point = { x: 0, y: 0 };
  private disposed = false;

  private readonly prevHtmlOverflow: string;
  private readonly prevBodyOverflow: string;

  constructor(private readonly onClose: () => void) {
    // --- host + shadow root ---
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    const hs = this.host.style;
    hs.position = 'fixed';
    hs.top = '0';
    hs.left = '0';
    hs.right = '0';
    hs.bottom = '0';
    hs.margin = '0';
    hs.padding = '0';
    hs.border = '0';
    hs.zIndex = String(MAX_Z);
    hs.pointerEvents = 'auto';
    this.root = this.host.attachShadow({ mode: 'open' });

    // --- scroll lock ---
    const html = document.documentElement;
    const body = document.body;
    this.prevHtmlOverflow = html.style.overflow;
    this.prevBodyOverflow = body ? body.style.overflow : '';
    html.style.overflow = 'hidden';
    if (body) body.style.overflow = 'hidden';

    // --- styles ---
    const style = document.createElement('style');
    style.textContent = STYLE;
    this.root.appendChild(style);

    // --- canvas ---
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sr-canvas';
    this.root.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;

    // --- toolbar ---
    this.toolbar = this.buildToolbar();
    this.root.appendChild(this.toolbar);

    document.documentElement.appendChild(this.host);

    this.resize();
    this.bind();
    this.redraw();
  }

  // -- history --------------------------------------------------------------

  private current(): AnnotationShape[] {
    return this.undoStack[this.index] ?? [];
  }

  private commit(shape: AnnotationShape): void {
    const next = [...this.current(), cloneShape(shape)];
    this.pushState(next);
  }

  private pushState(shapes: AnnotationShape[]): void {
    this.undoStack = this.undoStack.slice(0, this.index + 1);
    this.undoStack.push(shapes);
    this.index = this.undoStack.length - 1;
    this.redraw();
    this.syncButtons();
  }

  private undo(): void {
    if (this.index > 0) {
      this.index -= 1;
      this.redraw();
      this.syncButtons();
    }
  }

  private redo(): void {
    if (this.index < this.undoStack.length - 1) {
      this.index += 1;
      this.redraw();
      this.syncButtons();
    }
  }

  private clearAll(): void {
    if (this.current().length > 0) this.pushState([]);
  }

  // -- rendering ------------------------------------------------------------

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.canvas.style.width = `${vw}px`;
    this.canvas.style.height = `${vh}px`;
    this.canvas.width = Math.max(1, Math.round(vw * dpr));
    this.canvas.height = Math.max(1, Math.round(vh * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private redraw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const s of this.current()) this.drawShape(s);
    if (this.draft) this.drawShape(this.draft);
  }

  private drawShape(s: AnnotationShape): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.strokeWidth;

    switch (s.tool) {
      case 'pen': {
        this.drawPolyline(s.points);
        break;
      }
      case 'highlighter': {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(s.strokeWidth * 4, 12);
        this.drawPolyline(s.points);
        break;
      }
      case 'arrow': {
        if (s.from && s.to) this.drawArrow(s.from, s.to, s.strokeWidth);
        break;
      }
      case 'rect': {
        if (s.rect) ctx.strokeRect(s.rect.x, s.rect.y, s.rect.w, s.rect.h);
        break;
      }
      case 'ellipse': {
        if (s.rect) {
          const r = s.rect;
          ctx.beginPath();
          ctx.ellipse(
            r.x + r.w / 2,
            r.y + r.h / 2,
            Math.max(r.w / 2, 0.5),
            Math.max(r.h / 2, 0.5),
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
        break;
      }
      case 'redact': {
        if (s.rect) {
          ctx.globalAlpha = 1;
          ctx.fillRect(s.rect.x, s.rect.y, s.rect.w, s.rect.h);
        }
        break;
      }
      case 'text': {
        if (s.from && s.text) {
          const size = Math.max(14, s.strokeWidth * 5);
          ctx.textBaseline = 'top';
          ctx.font = `600 ${size}px system-ui, sans-serif`;
          ctx.fillText(s.text, s.from.x, s.from.y);
        }
        break;
      }
    }
    ctx.restore();
  }

  private drawPolyline(points?: Point[]): void {
    if (!points || points.length === 0) return;
    const ctx = this.ctx;
    const first = points[0];
    if (!first) return;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    if (points.length === 1) {
      // a single tap -> a dot
      ctx.lineTo(first.x + 0.1, first.y + 0.1);
    } else {
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        if (p) ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  private drawArrow(from: Point, to: Point, width: number): void {
    const ctx = this.ctx;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = Math.max(12, width * 3);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - head * Math.cos(angle - Math.PI / 6),
      to.y - head * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - head * Math.cos(angle + Math.PI / 6),
      to.y - head * Math.sin(angle + Math.PI / 6),
    );
    ctx.stroke();
  }

  // -- input ----------------------------------------------------------------

  private eventPoint(e: PointerEvent): Point {
    return { x: e.clientX, y: e.clientY };
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    try {
      if (this.textInput) {
        this.commitText();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const p = this.eventPoint(e);
      if (this.tool === 'text') {
        this.openTextInput(p);
        return;
      }
      this.draftStart = p;
      this.draft = this.makeDraft(p);
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.redraw();
    } catch {
      /* never throw into page */
    }
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.draft) return;
    try {
      e.preventDefault();
      const p = this.eventPoint(e);
      const d = this.draft;
      if (d.tool === 'pen' || d.tool === 'highlighter') {
        if (d.points) d.points.push(p);
      } else if (d.tool === 'arrow') {
        d.to = p;
      } else {
        d.rect = normRect(this.draftStart, p);
      }
      this.redraw();
    } catch {
      /* ignore */
    }
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (!this.draft) return;
    try {
      e.preventDefault();
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const d = this.draft;
      this.draft = null;
      if (this.isDegenerate(d)) {
        this.redraw();
        return;
      }
      this.commit(d);
    } catch {
      this.draft = null;
    }
  };

  private makeDraft(p: Point): AnnotationShape {
    const base = { tool: this.tool, color: this.color, strokeWidth: this.strokeWidth };
    switch (this.tool) {
      case 'pen':
      case 'highlighter':
        return { ...base, points: [p] };
      case 'arrow':
        return { ...base, from: p, to: p };
      default:
        return { ...base, rect: { x: p.x, y: p.y, w: 0, h: 0 } };
    }
  }

  private isDegenerate(s: AnnotationShape): boolean {
    if (s.rect) return s.rect.w < 2 && s.rect.h < 2;
    if (s.from && s.to) {
      return Math.abs(s.from.x - s.to.x) < 2 && Math.abs(s.from.y - s.to.y) < 2;
    }
    return false;
  }

  // -- text tool ------------------------------------------------------------

  private openTextInput(p: Point): void {
    this.closeTextInput();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sr-text-input';
    input.style.left = `${p.x}px`;
    input.style.top = `${p.y}px`;
    input.style.color = this.color;
    input.style.fontSize = `${Math.max(14, this.strokeWidth * 5)}px`;
    input.dataset['x'] = String(p.x);
    input.dataset['y'] = String(p.y);
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this.commitText();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this.closeTextInput();
      }
    });
    input.addEventListener('blur', () => this.commitText());
    this.root.appendChild(input);
    this.textInput = input;
    // focus after it is in the DOM
    window.setTimeout(() => input.focus(), 0);
  }

  private commitText(): void {
    const input = this.textInput;
    if (!input) return;
    const value = input.value.trim();
    const x = Number(input.dataset['x'] ?? '0');
    const y = Number(input.dataset['y'] ?? '0');
    this.closeTextInput();
    if (value) {
      this.commit({
        tool: 'text',
        color: this.color,
        strokeWidth: this.strokeWidth,
        from: { x, y },
        text: value,
      });
    }
  }

  private closeTextInput(): void {
    if (this.textInput) {
      const el = this.textInput;
      this.textInput = null;
      el.remove();
    }
  }

  // -- global event swallowing ---------------------------------------------

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
  };

  private readonly onKey = (e: KeyboardEvent) => {
    // Let the user type into our own inline text field.
    const real = e.composedPath()[0];
    if (real && real === this.textInput) return;

    if (e.type === 'keydown') {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.textInput) this.closeTextInput();
        else this.cancel();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.redo();
        return;
      }
    }
    // Swallow every other page hotkey while annotating.
    e.stopImmediatePropagation();
    e.preventDefault();
  };

  private readonly onResize = () => {
    try {
      this.resize();
      this.redraw();
    } catch {
      /* ignore */
    }
  };

  private bind(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.host.addEventListener('wheel', this.onWheel, { passive: false });
    this.host.addEventListener('touchmove', this.onWheel as EventListener, {
      passive: false,
    });
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKey, true);
    window.addEventListener('keypress', this.onKey, true);
    window.addEventListener('resize', this.onResize);
  }

  private unbind(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.host.removeEventListener('wheel', this.onWheel);
    this.host.removeEventListener('touchmove', this.onWheel as EventListener);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKey, true);
    window.removeEventListener('keypress', this.onKey, true);
    window.removeEventListener('resize', this.onResize);
  }

  // -- toolbar --------------------------------------------------------------

  private buildToolbar(): HTMLDivElement {
    const bar = document.createElement('div');
    bar.className = 'sr-toolbar';

    const handle = document.createElement('div');
    handle.className = 'sr-handle';
    handle.title = 'Drag to move';
    handle.textContent = '⠿';
    this.makeDraggable(handle, bar);
    bar.appendChild(handle);

    for (const spec of TOOLS) {
      const btn = document.createElement('button');
      btn.className = 'sr-btn sr-tool';
      btn.textContent = spec.label;
      btn.title = spec.title;
      btn.dataset['tool'] = spec.tool;
      btn.addEventListener('click', () => this.selectTool(spec.tool));
      bar.appendChild(btn);
    }

    bar.appendChild(this.sep());

    const color = document.createElement('input');
    color.type = 'color';
    color.className = 'sr-color';
    color.value = this.color;
    color.title = 'Color';
    color.addEventListener('input', () => {
      this.color = color.value;
      if (this.textInput) this.textInput.style.color = this.color;
    });
    bar.appendChild(color);

    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'sr-range';
    range.min = '1';
    range.max = '24';
    range.value = String(this.strokeWidth);
    range.title = 'Stroke width';
    range.addEventListener('input', () => {
      const v = Number(range.value);
      if (Number.isFinite(v) && v > 0) this.strokeWidth = v;
    });
    bar.appendChild(range);

    bar.appendChild(this.sep());

    this.undoBtn = this.actionBtn('↶', 'Undo', () => this.undo());
    this.redoBtn = this.actionBtn('↷', 'Redo', () => this.redo());
    bar.appendChild(this.undoBtn);
    bar.appendChild(this.redoBtn);
    bar.appendChild(this.actionBtn('⌫', 'Clear all', () => this.clearAll()));

    bar.appendChild(this.sep());

    const done = this.actionBtn('✓', 'Done', () => void this.done());
    done.classList.add('sr-done');
    const cancel = this.actionBtn('✗', 'Cancel', () => this.cancel());
    cancel.classList.add('sr-cancel');
    bar.appendChild(done);
    bar.appendChild(cancel);

    // reflect initial tool selection once buttons exist
    window.setTimeout(() => this.syncButtons(), 0);
    return bar;
  }

  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;

  private actionBtn(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'sr-btn';
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
    return btn;
  }

  private sep(): HTMLSpanElement {
    const s = document.createElement('span');
    s.className = 'sr-sep';
    return s;
  }

  private selectTool(tool: AnnotationTool): void {
    this.commitText();
    this.tool = tool;
    this.syncButtons();
  }

  private syncButtons(): void {
    const toolBtns = this.toolbar.querySelectorAll<HTMLButtonElement>('.sr-tool');
    toolBtns.forEach((b) => {
      b.classList.toggle('sr-active', b.dataset['tool'] === this.tool);
    });
    if (this.undoBtn) this.undoBtn.disabled = this.index <= 0;
    if (this.redoBtn) this.redoBtn.disabled = this.index >= this.undoStack.length - 1;
  }

  private makeDraggable(handle: HTMLElement, target: HTMLElement): void {
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    const onMove = (e: PointerEvent) => {
      const left = originLeft + (e.clientX - startX);
      const top = originTop + (e.clientY - startY);
      target.style.left = `${Math.max(0, left)}px`;
      target.style.top = `${Math.max(0, top)}px`;
      target.style.right = 'auto';
      target.style.transform = 'none';
    };
    const onUp = (e: PointerEvent) => {
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = target.getBoundingClientRect();
      originLeft = rect.left;
      originTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
    });
  }

  // -- finish ---------------------------------------------------------------

  /** Cancel: tear down with no message. */
  cancel(): void {
    this.teardown();
  }

  /** Done: attach targets, send annotation/exit, THEN tear down. */
  private async done(): Promise<void> {
    if (this.disposed) return;
    this.commitText();
    const shapes = this.current().map(cloneShape);
    const viewport = { w: window.innerWidth, h: window.innerHeight };

    // Hit-test each shape against the page element beneath its anchor. The
    // overlay must be transparent to pointer probing while we do this.
    const prevPointer = this.host.style.pointerEvents;
    this.host.style.pointerEvents = 'none';
    for (const shape of shapes) {
      try {
        const a = anchorOf(shape);
        const el = document.elementFromPoint(a.x, a.y);
        if (el && el !== this.host) {
          const desc = this.safeDescriptor(el);
          if (desc) shape.targetDescriptor = desc;
        }
      } catch {
        /* skip this shape's target */
      }
    }
    this.host.style.pointerEvents = prevPointer;

    // Send and await so the background can screenshot the still-visible
    // drawings before we remove the overlay.
    try {
      await sendMessage({ kind: 'annotation/exit', shapes, viewport });
    } catch {
      /* background unavailable — still clean up */
    }
    this.teardown();
  }

  private safeDescriptor(el: Element): ElementDescriptor | undefined {
    try {
      return buildDescriptor(el);
    } catch {
      return undefined;
    }
  }

  private teardown(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.closeTextInput();
      this.unbind();
      // restore scroll
      document.documentElement.style.overflow = this.prevHtmlOverflow;
      if (document.body) document.body.style.overflow = this.prevBodyOverflow;
      this.host.remove();
    } catch {
      /* ignore */
    }
    try {
      this.onClose();
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Shadow-root styles (fully self-contained)
// ---------------------------------------------------------------------------

const STYLE = `
:host { all: initial; }
.sr-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  cursor: crosshair;
  background: rgba(0, 0, 0, 0.001);
  touch-action: none;
}
.sr-toolbar {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: #1f2430;
  color: #f5f7fa;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 15px;
  user-select: none;
  z-index: 2;
}
.sr-handle {
  cursor: grab;
  padding: 0 6px;
  color: #8b93a7;
  font-size: 16px;
  line-height: 1;
}
.sr-handle:active { cursor: grabbing; }
.sr-btn {
  all: unset;
  box-sizing: border-box;
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: #f5f7fa;
  font-size: 15px;
  line-height: 1;
}
.sr-btn:hover { background: #313848; }
.sr-btn:disabled { opacity: 0.35; cursor: default; }
.sr-btn.sr-active { background: #3b82f6; color: #fff; }
.sr-done { color: #4ade80; font-weight: 700; }
.sr-cancel { color: #f87171; font-weight: 700; }
.sr-sep {
  width: 1px;
  height: 22px;
  margin: 0 4px;
  background: #3a4152;
}
.sr-color {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}
.sr-range { width: 84px; cursor: pointer; }
.sr-text-input {
  position: fixed;
  z-index: 3;
  min-width: 60px;
  padding: 2px 4px;
  border: 1px dashed rgba(0, 0, 0, 0.5);
  background: rgba(255, 255, 255, 0.9);
  font-family: system-ui, sans-serif;
  font-weight: 600;
  outline: none;
}
`;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  main() {
    let editor: AnnotationEditor | null = null;

    onContentMessage((msg) => {
      if (msg.kind !== 'content/annotate') return;
      try {
        if (msg.on) {
          if (!editor) {
            editor = new AnnotationEditor(() => {
              editor = null;
            });
          }
        } else if (editor) {
          editor.cancel();
          editor = null;
        }
      } catch {
        // Never surface an overlay failure to the page.
        editor = null;
      }
    });
  },
});
