/**
 * Export panel for a single session. Reads the session's events + assets
 * directly from IndexedDB, shows the four verbosity levels (L0..L3) with their
 * estimated token counts and a one-line "omits…" note, and on Download builds
 * the bundle, zips it, and hands the blob to `chrome.downloads`.
 *
 * Everything here runs against the full-fidelity data in IndexedDB, so a session
 * can be re-exported at any level after the fact.
 */

import React, { useEffect, useState } from 'react';
import {
  getAssets,
  getAssetsMeta,
  getEvents,
  getSession,
} from '@/lib/storage';
import { buildBundle, estimateForLevels } from '@/lib/export/bundle';
import { zipFiles } from '@/lib/export/zip';
import type { TokenEstimate } from '@/lib/messaging';
import type { VerbosityLevel } from '@/lib/session/types';
import { sessionFolderName } from '../store';

interface ExportPanelProps {
  sessionId: string;
}

/** Above this token estimate a level is flagged as risky for model context. */
const TOKEN_WARN_LIMIT = 180_000;

const LEVEL_ORDER: VerbosityLevel[] = ['L0', 'L1', 'L2', 'L3'];
const LEVEL_LABELS: Record<VerbosityLevel, string> = {
  L0: 'Full',
  L1: 'Standard',
  L2: 'Compact',
  L3: 'Minimal',
};

export function ExportPanel({ sessionId }: ExportPanelProps): React.JSX.Element {
  const [estimates, setEstimates] = useState<TokenEstimate[] | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [level, setLevel] = useState<VerbosityLevel>('L1');

  const [building, setBuilding] = useState(false);
  const [phase, setPhase] = useState('');
  const [buildError, setBuildError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setEstimates(null);
    setLoadError(undefined);
    (async () => {
      try {
        const session = await getSession(sessionId);
        if (!session) throw new Error('Session not found.');
        const [events, assets] = await Promise.all([
          getEvents(sessionId),
          getAssetsMeta(sessionId),
        ]);
        const result = estimateForLevels(events, assets, session);
        if (!cancelled) setEstimates(result);
      } catch (err) {
        if (!cancelled) setLoadError(describe(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Once estimates land, if the selected level is over the limit, nudge to L1.
  useEffect(() => {
    if (!estimates) return;
    const current = estimates.find((e) => e.level === level);
    if (current && current.tokens > TOKEN_WARN_LIMIT) setLevel('L1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimates]);

  const onDownload = async () => {
    if (building) return;
    setBuilding(true);
    setBuildError(undefined);
    setPhase('Preparing…');
    let url: string | undefined;
    try {
      const session = await getSession(sessionId);
      if (!session) throw new Error('Session not found.');
      const [events, assets] = await Promise.all([
        getEvents(sessionId),
        getAssets(sessionId),
      ]);

      setPhase('Building report…');
      const files = await buildBundle({ session, events, assets, level });

      setPhase('Zipping…');
      const folder = sessionFolderName(session);
      const bytes = await zipFiles(files, folder);

      setPhase('Downloading…');
      const blob = new Blob([bytes], { type: 'application/zip' });
      url = URL.createObjectURL(blob);
      await chrome.downloads.download({ url, filename: `${folder}.zip` });
      setPhase('Downloaded');
    } catch (err) {
      setBuildError(describe(err));
      setPhase('');
    } finally {
      setBuilding(false);
      // Give the download a moment to start reading the blob before revoking.
      if (url) {
        const toRevoke = url;
        setTimeout(() => URL.revokeObjectURL(toRevoke), 60_000);
      }
    }
  };

  const byLevel = new Map((estimates ?? []).map((e) => [e.level, e]));

  return (
    <div className="export">
      <div className="export__head">Export</div>

      {loadError && <p className="export__error">{loadError}</p>}

      {!estimates && !loadError && (
        <p className="export__loading">Estimating…</p>
      )}

      {estimates && (
        <fieldset className="levels">
          {LEVEL_ORDER.map((lvl) => {
            const est = byLevel.get(lvl);
            const selected = level === lvl;
            return (
              <label
                key={lvl}
                className={`level ${selected ? 'level--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="verbosity"
                  value={lvl}
                  checked={selected}
                  onChange={() => setLevel(lvl)}
                />
                <span className="level__body">
                  <span className="level__title">
                    <span className="level__id">{lvl}</span>
                    <span className="level__name">{LEVEL_LABELS[lvl]}</span>
                    <span className="level__tokens">
                      {est ? `~${formatTokens(est.tokens)} tokens` : '—'}
                    </span>
                  </span>
                  <span className="level__omits">{omitNote(est)}</span>
                  {est && est.tokens > TOKEN_WARN_LIMIT && (
                    <span className="level__warn">
                      large — may exceed model limits
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      <button
        type="button"
        className="btn btn--primary export__download"
        onClick={() => void onDownload()}
        disabled={building || !estimates}
      >
        {building ? phase || 'Working…' : 'Download .zip'}
      </button>

      {building && (
        <div className="export__progress" role="status">
          {phase}
        </div>
      )}
      {!building && phase === 'Downloaded' && (
        <div className="export__done" role="status">
          Saved to your downloads.
        </div>
      )}
      {buildError && <p className="export__error">{buildError}</p>}
    </div>
  );
}

function omitNote(est: TokenEstimate | undefined): string {
  if (!est) return '';
  if (est.omitted.length === 0) return 'Full fidelity — nothing omitted.';
  return `Omits: ${est.omitted.join(', ')}`;
}

function formatTokens(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return String(n);
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
