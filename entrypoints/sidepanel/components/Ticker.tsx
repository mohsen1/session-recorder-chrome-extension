/**
 * Live event ticker: the most recent ~30 events rendered as human-readable
 * one-liners with a `[mm:ss]` timestamp, newest first. Reassures the user that
 * capture is actually flowing. The `describeEvent` switch is exhaustive over
 * `EventType` (guarded by `assertNever`) so a new event type is a compile error.
 */

import React from 'react';
import { formatClock } from '@/lib/export/markdown';
import { assertNever } from '@/lib/session/events';
import type { SessionEvent } from '@/lib/session/types';
import { useSidepanel } from '../store';

interface Line {
  tag: string;
  text: string;
  tone: 'default' | 'error' | 'signal';
}

export function Ticker(): React.JSX.Element {
  const events = useSidepanel((s) => s.recentEvents);
  const ordered = [...events].reverse();

  return (
    <div className="ticker">
      <div className="ticker__head">Live events</div>
      {ordered.length === 0 ? (
        <p className="ticker__empty">Waiting for activity…</p>
      ) : (
        <ul className="ticker__list">
          {ordered.map((e) => {
            const line = describeEvent(e);
            return (
              <li key={e.id} className={`ticker__row ticker__row--${line.tone}`}>
                <span className="ticker__time">[{formatClock(e.t)}]</span>
                <span className="ticker__tag">{line.tag}</span>
                <span className="ticker__text">{line.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function truncate(s: string, n = 60): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return truncate(u.host + u.pathname, 48);
  } catch {
    return truncate(url, 48);
  }
}

function describeEvent(e: SessionEvent): Line {
  switch (e.type) {
    case 'click': {
      const d = e.payload.descriptor;
      return {
        tag: 'CLICK',
        text: truncate(d.text || d.selector || d.tag || 'element'),
        tone: 'default',
      };
    }
    case 'input': {
      const d = e.payload.descriptor;
      const field = d.name || d.ariaLabel || d.selector || d.tag || 'field';
      const value = e.payload.redacted ? '«redacted»' : e.payload.value;
      return { tag: 'INPUT', text: truncate(`${field} = ${value}`), tone: 'default' };
    }
    case 'scroll':
      return {
        tag: 'SCROLL',
        text: e.payload.container ?? 'window',
        tone: 'default',
      };
    case 'key':
      return { tag: 'KEY', text: e.payload.key, tone: 'default' };
    case 'nav':
      return {
        tag: 'NAV',
        text: truncate(e.payload.title || e.payload.url),
        tone: 'signal',
      };
    case 'spa-route':
      return {
        tag: 'ROUTE',
        text: truncate(e.payload.title || e.payload.url),
        tone: 'signal',
      };
    case 'tab-switch':
      return {
        tag: 'TAB',
        text: truncate(
          e.payload.toTitle || e.payload.toUrl || `tab ${e.payload.toTabId}`,
        ),
        tone: 'default',
      };
    case 'tab-opened':
      return {
        tag: 'TAB+',
        text: truncate(e.payload.title || e.payload.url || 'new tab'),
        tone: 'default',
      };
    case 'tab-closed':
      return {
        tag: 'TAB−',
        text: truncate(e.payload.title || e.payload.url || 'closed tab'),
        tone: 'default',
      };
    case 'net-request': {
      const p = e.payload;
      const status = p.failed ? 'ERR' : (p.status ?? '');
      const bad = p.failed || (typeof p.status === 'number' && p.status >= 400);
      return {
        tag: 'NET',
        text: truncate(`${p.method} ${status} ${shortUrl(p.url)}`),
        tone: bad ? 'error' : 'default',
      };
    }
    case 'console': {
      const p = e.payload;
      const tag = p.level === 'error' ? 'ERR' : p.level === 'warn' ? 'WARN' : 'LOG';
      const repeat = p.repeat && p.repeat > 1 ? ` ×${p.repeat}` : '';
      return {
        tag,
        text: truncate(p.text + repeat),
        tone: p.level === 'error' ? 'error' : 'default',
      };
    }
    case 'error':
      return { tag: 'ERROR', text: truncate(e.payload.message), tone: 'error' };
    case 'screenshot': {
      const p = e.payload;
      const ctx = p.contextText ? ` · ${p.contextText}` : '';
      return { tag: 'SHOT', text: truncate(`${p.trigger}${ctx}`), tone: 'default' };
    }
    case 'annotation-start':
      return { tag: 'ANNOTATE', text: 'started', tone: 'signal' };
    case 'annotation':
      return {
        tag: 'ANNOTATE',
        text: `${e.payload.shapes.length} shape${
          e.payload.shapes.length === 1 ? '' : 's'
        }`,
        tone: 'signal',
      };
    case 'voice-segment': {
      const p = e.payload;
      if (p.transcriptionError)
        return { tag: 'VOICE', text: truncate(`⚠ ${p.transcriptionError}`), tone: 'error' };
      return {
        tag: 'VOICE',
        text: truncate(p.transcript ?? '(audio segment)'),
        tone: 'signal',
      };
    }
    case 'file-captured':
      return {
        tag: 'FILE',
        text: truncate(e.payload.fileName),
        tone: 'signal',
      };
    case 'file-attached':
      return {
        tag: 'ATTACH',
        text: truncate(e.payload.fileName),
        tone: 'signal',
      };
    case 'marker':
      return { tag: 'MARKER', text: truncate(e.payload.name), tone: 'signal' };
    case 'note':
      return { tag: 'NOTE', text: truncate(e.payload.text), tone: 'signal' };
    case 'session-note':
      return { tag: 'SYS', text: truncate(e.payload.text), tone: 'default' };
    default:
      return assertNever(e);
  }
}
