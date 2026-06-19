'use client';

import { useEffect, useRef, useState } from 'react';
import { useTourney } from '@/lib/context';
import { listBracketSlots } from '@/lib/bracket';
import { parseStageMaps } from '@/lib/utils';
import type { BracketMatch, GrandFinal } from '@/lib/types';

// ─── Inject glow keyframe once ────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('match-info-glow-style')) {
  const s = document.createElement('style');
  s.id = 'match-info-glow-style';
  s.textContent = `
    @keyframes info-card-highlight {
      0%   { box-shadow: 0 0 0 0   rgba(77,124,255,0),    border-color: var(--border-mid); }
      15%  { box-shadow: 0 0 0 6px rgba(77,124,255,0.45), 0 0 28px rgba(77,124,255,0.30); border-color: rgba(77,124,255,0.9); }
      60%  { box-shadow: 0 0 0 4px rgba(77,124,255,0.22), 0 0 16px rgba(77,124,255,0.15); border-color: rgba(77,124,255,0.65); }
      100% { box-shadow: 0 0 0 0   rgba(77,124,255,0),    border-color: var(--border-mid); }
    }
    .match-info-glow { animation: info-card-highlight 2.2s cubic-bezier(0.22,1,0.36,1) forwards; }
  `;
  document.head.appendChild(s);
}

// ─── Helper: look up a raw BracketMatch by matchKey ───────────────────────────
function resolveMatch(
  bracket: NonNullable<ReturnType<typeof useTourney>['bracket']>,
  matchKey: string,
): BracketMatch | GrandFinal | null {
  // matchKey format: m_<section>_<ri>_<mi>
  const parts = matchKey.split('_');
  // parts[0] = 'm', parts[1] = section, rest = indices
  const section = parts[1];
  const ri = parseInt(parts[2] ?? '0', 10);
  const mi = parseInt(parts[3] ?? '0', 10);

  if (section === 'upper') return bracket.upper[ri]?.[mi] ?? null;
  if (section === 'lower') return (bracket.lower ?? [])[ri]?.[mi] ?? null;
  if (section === 'thirdPlace') return bracket.thirdPlace ?? null;
  if (section === 'gf') return bracket.grandFinal ?? null;
  return null;
}

// ─── Single match info card ────────────────────────────────────────────────────
function MatchInfoCard({
  slot,
  match,
  maps,
  highlighted,
  cardRef,
  note,
  onNoteChange,
}: {
  slot: ReturnType<typeof listBracketSlots>[number];
  match: BracketMatch | GrandFinal | null;
  maps: string[];
  highlighted: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
  note: string;
  onNoteChange: (val: string) => void;
}) {
  const isDone = slot.isDone;
  const isTbd = slot.p1 === 'TBD' || slot.p2 === 'TBD';

  const score1 = match?.score1 ?? 0;
  const score2 = match?.score2 ?? 0;
  const winner = match?.winner ?? null;

  const format = (match as BracketMatch | null)?.format ?? 'bo1';
  const maxWins = format === 'bo5' ? 3 : format === 'bo3' ? 2 : 1;

  return (
    <div
      ref={cardRef}
      className={`t-elevated border rounded-xl flex flex-col overflow-hidden${highlighted ? ' match-info-glow' : ''}`}
      style={{ borderColor: 'var(--border-mid)', borderWidth: 1.5 }}
    >
      {/* ── Header row: match number + label + format + status ── */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 border-b t-border"
        style={{ background: 'var(--bg-surface)' }}
      >
        <span
          className="font-['Bebas_Neue'] text-xl tracking-widest shrink-0"
          style={{ color: 'var(--accent)', opacity: 0.9 }}
        >
          #{slot.number}
        </span>
        <span className="font-['DM_Mono'] text-[11px] t-muted uppercase tracking-widest flex-1 truncate">
          {slot.label}
        </span>
        <span
          className="font-['DM_Mono'] text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border shrink-0"
          style={{
            color: 'var(--accent-gold)',
            borderColor: 'rgba(224,144,16,0.3)',
            background: 'rgba(224,144,16,0.07)',
          }}
        >
          {format.toUpperCase()}
        </span>
        {/* Status — only shown when there's something to say */}
        {isDone && (
          <span
            className="font-['DM_Mono'] text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border shrink-0"
            style={{ color: 'var(--accent-green)', borderColor: 'rgba(34,184,98,0.25)', background: 'rgba(34,184,98,0.07)' }}
          >
            ✓ Done
          </span>
        )}
        {!isDone && isTbd && (
          <span
            className="font-['DM_Mono'] text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border shrink-0"
            style={{ color: 'var(--text-dim)', borderColor: 'rgba(120,120,180,0.2)', background: 'rgba(120,120,180,0.05)' }}
          >
            ⏳ TBD
          </span>
        )}
      </div>

      {/* ── Teams + Score ── */}
      <div className="flex items-center gap-0 px-4 py-3">
        {/* Team 1 */}
        <div className="flex-1 flex flex-col items-start gap-0.5 min-w-0">
          <span
            className="font-['Bebas_Neue'] text-2xl tracking-wide truncate w-full"
            style={{
              color: winner ? (winner === slot.p1 ? 'var(--accent-green)' : 'var(--text-muted)') : slot.p1 === 'TBD' ? 'var(--text-dim)' : 'var(--text)',
              fontStyle: slot.p1 === 'TBD' ? 'italic' : undefined,
              opacity: winner && winner !== slot.p1 ? 0.5 : 1,
            }}
          >
            {winner === slot.p1 && <span style={{ color: 'var(--accent-green)', marginRight: 4 }}>✓</span>}
            {slot.p1}
          </span>
        </div>

        {/* Score + vs */}
        <div className="flex items-center gap-3 px-4 shrink-0">
          <span
            className="font-['Bebas_Neue'] text-4xl tabular-nums"
            style={{ color: winner === slot.p1 ? 'var(--accent-green)' : isDone ? 'var(--text-muted)' : 'var(--text-dim)', minWidth: 28, textAlign: 'center' }}
          >
            {isDone ? score1 : '–'}
          </span>
          <span className="font-['DM_Mono'] text-sm t-muted">:</span>
          <span
            className="font-['Bebas_Neue'] text-4xl tabular-nums"
            style={{ color: winner === slot.p2 ? 'var(--accent-green)' : isDone ? 'var(--text-muted)' : 'var(--text-dim)', minWidth: 28, textAlign: 'center' }}
          >
            {isDone ? score2 : '–'}
          </span>
        </div>

        {/* Team 2 */}
        <div className="flex-1 flex flex-col items-end gap-0.5 min-w-0">
          <span
            className="font-['Bebas_Neue'] text-2xl tracking-wide truncate w-full text-right"
            style={{
              color: winner ? (winner === slot.p2 ? 'var(--accent-green)' : 'var(--text-muted)') : slot.p2 === 'TBD' ? 'var(--text-dim)' : 'var(--text)',
              fontStyle: slot.p2 === 'TBD' ? 'italic' : undefined,
              opacity: winner && winner !== slot.p2 ? 0.5 : 1,
            }}
          >
            {slot.p2}
            {winner === slot.p2 && <span style={{ color: 'var(--accent-green)', marginLeft: 4 }}>✓</span>}
          </span>
        </div>
      </div>

      {/* Best-of indicator */}
      {isDone && (
        <div className="flex items-center justify-center gap-1.5 pb-2 px-4">
          {Array.from({ length: maxWins * 2 - 1 }).map((_, i) => {
            const isP1Win = i < score1;
            const isP2Win = i >= maxWins * 2 - 1 - score2;
            return (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 8, height: 8,
                  background: isP1Win
                    ? (winner === slot.p1 ? 'var(--accent-green)' : 'rgba(34,184,98,0.35)')
                    : isP2Win
                      ? (winner === slot.p2 ? 'var(--accent-green)' : 'rgba(34,184,98,0.35)')
                      : 'var(--border-mid)',
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── Maps ── */}
      {maps.length > 0 && (
        <div className="border-t t-border px-4 py-2.5 flex flex-wrap gap-1.5">
          <span className="font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest self-center mr-1">Maps</span>
          {maps.map((map, i) => (
            <span
              key={i}
              className="font-['DM_Mono'] text-[11px] px-2.5 py-1 rounded-lg border"
              style={{ color: 'var(--accent)', borderColor: 'rgba(77,124,255,0.25)', background: 'rgba(77,124,255,0.07)' }}
            >
              {i + 1}. {map}
            </span>
          ))}
        </div>
      )}

      {/* ── Notes / description area ── */}
      <div className="border-t t-border px-4 py-3">
        <label className="block font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">
          Notes
        </label>
        <textarea
          className="w-full t-elevated border t-border-mid rounded-lg px-3 py-2 font-['DM_Mono'] text-xs t-text outline-none focus:border-[var(--accent)] transition-colors resize-none"
          rows={2}
          placeholder="Add caster notes, context, callouts…"
          value={note}
          onChange={e => onNoteChange(e.target.value)}
        />
      </div>
    </div>
  );
}

// ─── Match Info tab ────────────────────────────────────────────────────────────
export function CasterSheetTab({ highlightMatchKey, onHighlightHandled }: {
  highlightMatchKey?: string | null;
  onHighlightHandled?: () => void;
} = {}) {
  const { bracket, stageMaps } = useTourney();
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Per-card notes stored locally (keyed by matchKey)
  const [notes, setNotes] = useState<Record<string, string>>({});
  const setNote = (key: string, val: string) =>
    setNotes(prev => ({ ...prev, [key]: val }));

  const slots = bracket ? listBracketSlots(bracket) : [];

  // Scroll highlighted card into view whenever highlightMatchKey changes
  useEffect(() => {
    if (highlightMatchKey && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => onHighlightHandled?.(), 2400);
      return () => clearTimeout(t);
    }
  }, [highlightMatchKey, onHighlightHandled]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text">Match Info</h2>
        {slots.length > 0 && (
          <span className="font-['DM_Mono'] text-[10px] t-muted">
            {slots.length} match{slots.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="t-muted text-sm italic py-10 text-center">
          Generate a bracket to see match info here.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {slots.map(slot => {
            const match = bracket ? resolveMatch(bracket, slot.key) : null;
            const rawMaps = parseStageMaps(stageMaps[slot.key] ?? '');
            const maps = rawMaps.filter(Boolean);

            return (
              <MatchInfoCard
                key={slot.key}
                slot={slot}
                match={match}
                maps={maps}
                highlighted={slot.key === highlightMatchKey}
                cardRef={slot.key === highlightMatchKey ? highlightRef : undefined}
                note={notes[slot.key] ?? ''}
                onNoteChange={val => setNote(slot.key, val)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
CasterSheetTab.displayName = 'CasterSheetTab';
