'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import { listBracketSlots } from '@/lib/bracket';
import { parseStageMaps } from '@/lib/utils';
import type { BracketMatch, GrandFinal, CasterMatch } from '@/lib/types';

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
  const parts = matchKey.split('_');
  const section = parts[1];
  const ri = parseInt(parts[2] ?? '0', 10);
  const mi = parseInt(parts[3] ?? '0', 10);
  if (section === 'upper')     return bracket.upper[ri]?.[mi] ?? null;
  if (section === 'lower')     return (bracket.lower ?? [])[ri]?.[mi] ?? null;
  if (section === 'thirdPlace') return bracket.thirdPlace ?? null;
  if (section === 'gf')        return bracket.grandFinal ?? null;
  return null;
}

// ─── Single match info card ────────────────────────────────────────────────────
function MatchInfoCard({
  slot,
  match,
  maps,
  highlighted,
  cardRef,
  isAdmin,
  savedNote,
  onSaveNote,
  onScore,
  onUndo,
}: {
  slot: ReturnType<typeof listBracketSlots>[number];
  match: BracketMatch | GrandFinal | null;
  maps: string[];
  highlighted: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
  isAdmin: boolean;
  savedNote: string;
  onSaveNote: (val: string) => Promise<void>;
  onScore: (p1wins: number, p2wins: number) => void;
  onUndo: () => void;
}) {
  const isDone = slot.isDone;
  const isTbd = slot.p1 === 'TBD' || slot.p2 === 'TBD';
  const score1 = match?.score1 ?? 0;
  const score2 = match?.score2 ?? 0;
  const winner = match?.winner ?? null;
  const format = (match as BracketMatch | null)?.format ?? 'bo1';
  const maxWins = format === 'bo5' ? 3 : format === 'bo3' ? 2 : 1;

  // Local score drafts — allow editing before saving
  const [s1, setS1] = useState(score1);
  const [s2, setS2] = useState(score2);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setS1(score1); setS2(score2); }, [score1, score2]);
  const isModified = s1 !== score1 || s2 !== score2;
  const canEdit = isAdmin && !!match?.p1 && !!match?.p2 && !isDone && !isTbd;
  const canUndo = isAdmin && isDone;

  const startEdit = () => { if (!canEdit) return; setS1(score1); setS2(score2); setEditing(true); };
  const cancelEdit = () => { setS1(score1); setS2(score2); setEditing(false); };
  const commitEdit = () => { setEditing(false); onScore(s1, s2); };

  // Local draft for the textarea — starts from saved value
  const [draft, setDraft] = useState(savedNote);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  // Sync draft when savedNote changes from SSE (another admin edited)
  useEffect(() => { setDraft(savedNote); }, [savedNote]);

  const handleSave = async () => {
    if (draft === savedNote) return;
    setSaving(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      await onSaveNote(draft);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1800);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Save failed — try again.');
      setTimeout(() => { setSaveStatus('idle'); setSaveError(''); }, 5000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`t-elevated border rounded-xl flex flex-col overflow-hidden${highlighted ? ' match-info-glow' : ''}`}
      style={{ borderColor: 'var(--border-mid)', borderWidth: 1.5 }}
    >
      {/* ── Header: number + label + format + status ── */}
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
          style={{ color: 'var(--accent-gold)', borderColor: 'rgba(224,144,16,0.3)', background: 'rgba(224,144,16,0.07)' }}
        >
          {format.toUpperCase()}
        </span>
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
      <div className="flex items-center px-4 py-3">
        <div className="flex-1 min-w-0">
          <span
            className="font-['Bebas_Neue'] text-2xl tracking-wide truncate block"
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

        <div className="flex items-center gap-3 px-5 shrink-0">
          {editing ? (
            <>
              <input
                autoFocus
                type="number" min={0} max={maxWins}
                value={s1}
                onChange={e => setS1(Math.max(0, Math.min(maxWins, parseInt(e.target.value, 10) || 0)))}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                className="w-10 text-center font-['Bebas_Neue'] text-4xl rounded border bg-transparent focus:outline-none tabular-nums"
                style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
              />
              <span className="font-['DM_Mono'] text-sm t-muted">:</span>
              <input
                type="number" min={0} max={maxWins}
                value={s2}
                onChange={e => setS2(Math.max(0, Math.min(maxWins, parseInt(e.target.value, 10) || 0)))}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                className="w-10 text-center font-['Bebas_Neue'] text-4xl rounded border bg-transparent focus:outline-none tabular-nums"
                style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
              />
            </>
          ) : (
            <>
              <span
                className="font-['Bebas_Neue'] text-4xl tabular-nums"
                style={{ color: winner === slot.p1 ? 'var(--accent-green)' : isDone ? 'var(--text-muted)' : 'var(--text)', minWidth: 28, textAlign: 'center', cursor: canEdit ? 'text' : 'default', outline: canEdit ? '1px dashed var(--border-mid)' : 'none' }}
                onClick={startEdit}
              >
                {score1}
              </span>
              <span className="font-['DM_Mono'] text-sm t-muted">:</span>
              <span
                className="font-['Bebas_Neue'] text-4xl tabular-nums"
                style={{ color: winner === slot.p2 ? 'var(--accent-green)' : isDone ? 'var(--text-muted)' : 'var(--text)', minWidth: 28, textAlign: 'center', cursor: canEdit ? 'text' : 'default', outline: canEdit ? '1px dashed var(--border-mid)' : 'none' }}
                onClick={startEdit}
              >
                {score2}
              </span>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0 text-right">
          <span
            className="font-['Bebas_Neue'] text-2xl tracking-wide truncate block"
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

      {/* Score action buttons (edit mode) */}
      {editing && (
        <div className="flex items-center justify-center gap-2 pb-2 px-4">
          <button
            className="font-['DM_Mono'] text-[11px] font-bold px-3 py-1 rounded-lg border transition-all cursor-pointer"
            style={{ color: 'var(--accent-green)', borderColor: 'rgba(34,184,98,0.3)', background: 'rgba(34,184,98,0.08)' }}
            onClick={commitEdit}
          >✓ SAVE</button>
          <button
            className="font-['DM_Mono'] text-[11px] px-3 py-1 rounded-lg border transition-all cursor-pointer"
            style={{ color: 'var(--text-dim)', borderColor: 'var(--border-mid)' }}
            onClick={cancelEdit}
          >✕ CANCEL</button>
        </div>
      )}

      {/* Undo button */}
      {canUndo && !editing && (
        <div className="flex items-center justify-center pb-2 px-4">
          <button
            className="font-['DM_Mono'] text-[10px] t-dim hover:text-[var(--accent-red)] cursor-pointer transition-colors"
            onClick={onUndo}
          >↩ UNDO</button>
        </div>
      )}

      {/* Best-of pips — show when match has any score or is done */}
      {(isDone || score1 > 0 || score2 > 0) && (
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

      {/* ── Notes — admin edit / public read-only ── */}
      {(isAdmin || savedNote) && (
        <div className="border-t t-border px-4 py-3">
          {isAdmin ? (
            <>
              <label className="block font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">
                🎙 Caster Notes
              </label>
              <textarea
                className="w-full t-elevated border t-border-mid rounded-lg px-3 py-2 font-['DM_Mono'] text-xs t-text outline-none focus:border-[var(--accent)] transition-colors resize-none"
                rows={2}
                placeholder="Add caster notes, context, callouts…"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(); }}
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="font-['DM_Mono'] text-[10px]">
                  {saveStatus === 'saved' && (
                    <span style={{ color: 'var(--accent-green)' }}>✓ Saved to database</span>
                  )}
                  {saveStatus === 'error' && (
                    <span style={{ color: 'var(--accent-red, #e05555)' }}>⚠ {saveError}</span>
                  )}
                  {saveStatus === 'idle' && (
                    <span className="t-dim">Cmd/Ctrl+Enter to save</span>
                  )}
                </span>
                <button
                  onClick={handleSave}
                  disabled={saving || draft === savedNote}
                  className="font-['DM_Mono'] text-[11px] font-bold px-3 py-1 rounded-lg border transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    color: 'var(--accent)',
                    borderColor: 'rgba(77,124,255,0.3)',
                    background: 'rgba(77,124,255,0.07)',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">
                🎙 Caster Notes
              </div>
              <p className="font-['DM_Mono'] text-xs t-text whitespace-pre-wrap leading-relaxed">
                {savedNote}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Match Info tab ────────────────────────────────────────────────────────────
export function CasterSheetTab({ highlightMatchKey, onHighlightHandled }: {
  highlightMatchKey?: string | null;
  onHighlightHandled?: () => void;
} = {}) {
  const { bracket, stageMaps, isAdmin, casterSheet, setCasterSheet, updateScore, undoMatch } = useTourney();
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const slots = bracket ? listBracketSlots(bracket) : [];

  // Build a lookup: matchKey → saved note from casterSheet
  const notesByKey: Record<string, string> = {};
  for (const cm of (casterSheet?.matches ?? [])) {
    if (cm.linkedMatchKey) notesByKey[cm.linkedMatchKey] = cm.notes ?? '';
  }

  // Save a note for a specific matchKey into casterSheet.matches
  const handleSaveNote = useCallback(async (matchKey: string, note: string) => {
    const existing = (casterSheet?.matches ?? []).find(m => m.linkedMatchKey === matchKey);
    let next: CasterMatch[];
    if (existing) {
      next = (casterSheet.matches).map(m =>
        m.linkedMatchKey === matchKey ? { ...m, notes: note } : m
      );
    } else {
      const newEntry: CasterMatch = {
        id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        matchNo: matchKey,
        team1: '',
        team2: '',
        maps: '',
        side: '',
        notes: note,
        result: '',
        createdAt: Date.now(),
        linkedMatchKey: matchKey,
      };
      next = [...(casterSheet?.matches ?? []), newEntry];
    }
    // Propagate throws so MatchInfoCard can show the error
    await setCasterSheet(next);
  }, [casterSheet, setCasterSheet]);

  // Parse matchKey → (section, ri, mi) for updateScore / undoMatch
  const parseMatchKey = (matchKey: string): { section: string; ri: number; mi: number } | null => {
    const parts = matchKey.split('_');
    if (parts.length < 4) return null;
    const section = parts[1];
    const ri = parseInt(parts[2], 10);
    const mi = parseInt(parts[3], 10);
    if (isNaN(ri) || isNaN(mi)) return null;
    return { section, ri, mi };
  };

  // Scroll highlighted card into view
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
            const maps = parseStageMaps(stageMaps[slot.key] ?? '').filter(Boolean);
            const savedNote = notesByKey[slot.key] ?? '';

            const parsed = parseMatchKey(slot.key);
            return (
              <MatchInfoCard
                key={slot.key}
                slot={slot}
                match={match}
                maps={maps}
                highlighted={slot.key === highlightMatchKey}
                cardRef={slot.key === highlightMatchKey ? highlightRef : undefined}
                isAdmin={isAdmin}
                savedNote={savedNote}
                onSaveNote={note => handleSaveNote(slot.key, note)}
                onScore={parsed ? (p1w, p2w) => updateScore(parsed.section, parsed.ri, parsed.mi, p1w, p2w) : () => {}}
                onUndo={parsed ? () => undoMatch(parsed.section, parsed.ri, parsed.mi) : () => {}}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
CasterSheetTab.displayName = 'CasterSheetTab';
