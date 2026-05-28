'use client';

import { useState, useEffect, useRef } from 'react';
import { useTourney } from '@/lib/context';
import { parseStageMaps } from '@/lib/utils';
import type { BracketMatch, GrandFinal, Bracket } from '@/lib/types';

// ─── Layout constants ─────────────────────────────────────────────────────────
const CARD_W = 210;
const CARD_H = 100;   // fixed height — never changes, so SVG lines stay aligned
const COL_GAP = 72;
const COL_W = CARD_W + COL_GAP;
const ROW_GAP = 28;   // vertical gap between cards in round 0

// ─── Geometry helpers ─────────────────────────────────────────────────────────
/**
 * Vertical spacing between card tops for a given bracket column.
 * Column 0 has base spacing; each subsequent column doubles it.
 */
function colSpacing(colIdx: number): number {
  return (CARD_H + ROW_GAP) * Math.pow(2, colIdx);
}

/**
 * Top-Y of a card in the UPPER bracket grid (both SE and the upper half of DE).
 * All cards share the same coordinate system — callers add an offsetY later.
 */
function ubCardTop(colIdx: number, mi: number): number {
  if (colIdx === 0) return mi * colSpacing(0);
  const aTop = ubCardTop(colIdx - 1, mi * 2);
  const bTop = ubCardTop(colIdx - 1, mi * 2 + 1);
  return (aTop + bTop) / 2;
}

/**
 * Top-Y of a card in the LOWER bracket grid (independent origin).
 * Lower bracket columns alternate: even = consolidation (halves), odd = drop-in (same count).
 */
function lbCardTop(colIdx: number, mi: number): number {
  if (colIdx === 0) return mi * colSpacing(0);
  if (colIdx % 2 === 1) {
    // Drop-in round: same match count as previous LB round — Y is the same
    return lbCardTop(colIdx - 1, mi);
  }
  // Consolidation round: halves count — centre between the two feeders
  const aTop = lbCardTop(colIdx - 1, mi * 2);
  const bTop = lbCardTop(colIdx - 1, mi * 2 + 1);
  return (aTop + bTop) / 2;
}

// ─── Trophy sparkle (injected once) ──────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('trophy-anim-style')) {
  const s = document.createElement('style');
  s.id = 'trophy-anim-style';
  s.textContent = `
    @keyframes trophy-spin { from { transform: rotate(-12deg); } to { transform: rotate(12deg); } }
    @keyframes sparkle { 0%,100% { opacity:0; transform:scale(0.4); } 50% { opacity:1; transform:scale(1); } }
    .trophy-spin { display:inline-block; animation: trophy-spin 0.7s ease-in-out infinite alternate; }
    .sparkle { position:absolute; font-size:10px; animation: sparkle 1.2s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────
function PlayerRow({
  player, score, isWinner, isLoser, showScore, canEdit, isBo3, onCommit,
}: {
  player: string | null; score: number; isWinner: boolean; isLoser: boolean;
  showScore: boolean; canEdit?: boolean; isBo3?: boolean;
  onCommit?: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => { if (!canEdit) return; setDraft(String(score)); setEditing(true); };
  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 0) onCommit?.(n);
  };

  return (
    <div
      className="flex items-center justify-between px-3 border-b t-border last:border-b-0"
      style={{ height: 36, background: isWinner ? 'rgba(34,184,98,0.07)' : undefined }}
    >
      <span
        className="text-xs font-['DM_Mono'] flex-1 truncate"
        style={{
          color: !player ? 'var(--text-dim)' : isWinner ? 'var(--accent-green)' : isLoser ? 'var(--text-dim)' : 'var(--text)',
          fontStyle: !player ? 'italic' : undefined,
          opacity: isLoser ? 0.5 : 1,
        }}
      >
        {isWinner && '✓ '}{player ?? (isLoser ? 'BYE' : 'TBD')}
      </span>
      {showScore && (
        editing ? (
          <input
            autoFocus type="number" min={0} max={isBo3 ? 2 : 1}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className="w-8 text-center font-['Bebas_Neue'] text-base rounded border bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          />
        ) : (
          <span
            className="font-['Bebas_Neue'] text-base ml-2 shrink-0 rounded px-1"
            style={{ color: isWinner ? 'var(--accent-green)' : 'var(--text-dim)', cursor: canEdit ? 'text' : 'default', outline: canEdit ? '1px dashed var(--border-mid)' : 'none', minWidth: 20, textAlign: 'center' }}
            onClick={startEdit}
          >{score}</span>
        )
      )}
    </div>
  );
}

// ─── RoundHeader (with map drop zones) ───────────────────────────────────────
function RoundHeader({ section, ri, label, matchCount, isBo3, isAdmin }: {
  section: string; ri: number; label: string; matchCount: number; isBo3: boolean; isAdmin: boolean;
}) {
  const { assignStage } = useTourney();
  const slotCount = isBo3 ? 3 : 1;
  return (
    <div className="flex items-end justify-between w-full">
      <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase t-dim">{label}</div>
      {isAdmin && (
        <div className="flex gap-1">
          {Array.from({ length: slotCount }).map((_, slotIdx) => (
            <div
              key={slotIdx}
              className="w-[18px] h-[18px] border border-dashed t-border-mid rounded bg-[var(--bg-surface)] text-[9px] flex items-center justify-center t-dim hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[rgba(58,107,255,0.05)] transition-colors cursor-crosshair"
              onDragOver={e => e.preventDefault()}
              onDrop={async e => {
                e.preventDefault();
                const m = e.dataTransfer.getData('text/plain');
                if (m) for (let mi2 = 0; mi2 < matchCount; mi2++) await assignStage(`m_${section}_${ri}_${mi2}`, m, slotIdx);
              }}
              title={`Drop to set Map ${slotIdx + 1} for ALL matches in this round`}
            >{slotIdx + 1}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MapSlots ─────────────────────────────────────────────────────────────────
function MapSlots({ matchKey, isBo3, isAdmin }: { matchKey: string; isBo3: boolean; isAdmin: boolean }) {
  const { stageMaps, assignStage, clearStage } = useTourney();
  const maps = parseStageMaps(stageMaps[matchKey] || '');
  const slotCount = isBo3 ? 3 : 1;
  return (
    <div className="flex h-7 border-t t-border bg-[var(--bg-surface)] shrink-0">
      {Array.from({ length: slotCount }).map((_, slotIdx) => {
        const map = maps[slotIdx];
        return (
          <div
            key={slotIdx}
            className="flex-1 flex items-center justify-center font-['DM_Mono'] text-[9px] border-r t-border last:border-r-0 relative group transition-colors"
            style={{ background: map ? 'rgba(58,107,255,0.04)' : undefined, color: map ? 'var(--accent)' : 'var(--text-dim)' }}
            onDragOver={isAdmin ? (e) => e.preventDefault() : undefined}
            onDrop={isAdmin ? async (e) => { e.preventDefault(); const m = e.dataTransfer.getData('text/plain'); if (m) await assignStage(matchKey, m, slotIdx); } : undefined}
          >
            {map ? (
              <>
                <span className="truncate px-1 max-w-[85%]">{map}</span>
                {isAdmin && (
                  <button onClick={() => clearStage(matchKey, slotIdx)} className="absolute right-1 hidden group-hover:flex w-4 h-4 items-center justify-center bg-black/60 rounded-full text-[var(--accent-red)] transition-opacity" title="Clear map">✕</button>
                )}
              </>
            ) : (
              <span className="opacity-40">{isBo3 ? `Map ${slotIdx + 1}` : 'Drop Map'}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────
function MatchCard({
  match, matchKey, onScore, onUndo, isAdmin, highlightBorder,
}: {
  match: BracketMatch; matchKey: string;
  onScore: (p1wins: number, p2wins: number) => void;
  onUndo: () => void;
  isAdmin: boolean;
  highlightBorder?: string; // CSS color override for special cards (GF2)
}) {
  const [s1, setS1] = useState(match.score1);
  const [s2, setS2] = useState(match.score2);
  useEffect(() => { setS1(match.score1); setS2(match.score2); }, [match.score1, match.score2]);

  const isBo3 = match.format === 'bo3';
  const isDone = !!match.winner;
  const canEdit = isAdmin && !!match.p1 && !!match.p2 && !isDone;
  const canUndo = isAdmin && isDone;
  const isModified = s1 !== match.score1 || s2 !== match.score2;

  const borderStyle = highlightBorder ? { borderColor: highlightBorder, borderWidth: 2 } : {};

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="t-elevated border t-border rounded-xl overflow-hidden flex flex-col"
        style={{ width: CARD_W, height: CARD_H, ...borderStyle }}
      >
        <PlayerRow player={match.p1} score={isDone ? match.score1 : s1} isWinner={isDone && match.winner === match.p1} isLoser={isDone && match.winner !== match.p1} showScore={isDone || !!(match.p1 && match.p2)} canEdit={canEdit} isBo3={isBo3} onCommit={n => setS1(n)} />
        <PlayerRow player={match.p2} score={isDone ? match.score2 : s2} isWinner={isDone && match.winner === match.p2} isLoser={isDone && match.winner !== match.p2} showScore={isDone || !!(match.p1 && match.p2)} canEdit={canEdit} isBo3={isBo3} onCommit={n => setS2(n)} />
        <MapSlots matchKey={matchKey} isBo3={isBo3} isAdmin={isAdmin} />
      </div>
      {isModified && (
        <div className="flex flex-col gap-1.5" style={{ position: 'absolute', top: '50%', left: CARD_W + 6, transform: 'translateY(-50%)', zIndex: 10 }}>
          <button className="font-['DM_Mono'] text-[10px] font-bold text-[var(--accent-green)] hover:brightness-125 cursor-pointer whitespace-nowrap" onClick={() => onScore(s1, s2)}>✓ SAVE</button>
          <button className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] cursor-pointer whitespace-nowrap" onClick={() => { setS1(match.score1); setS2(match.score2); }}>✕ CANCEL</button>
        </div>
      )}
      {canUndo && !isModified && (
        <button className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] cursor-pointer whitespace-nowrap" style={{ position: 'absolute', top: '50%', left: CARD_W + 6, transform: 'translateY(-50%)', zIndex: 10 }} onClick={onUndo}>↩ UNDO</button>
      )}
    </div>
  );
}

// ─── BracketTab ────────────────────────────────────────────────────────────────
export function BracketTab({ spinResults }: { spinResults: string[] }) {
  const { bracket, elimMode, teams, isAdmin, loading, setElimMode, generateBracket, seedBracket, updateScore, undoMatch, updateThirdPlace, resetBracket, shuffleState } = useTourney();
  const [err, setErr] = useState('');
  const [generating, setGenerating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [matchFormat, setMatchFormat] = useState<'bo1' | 'bo3'>('bo1');
  const [pendingElim, setPendingElim] = useState<'single' | 'double' | null>(null);
  const displayElim = pendingElim ?? elimMode;

  // ── Shuffle animation ─────────────────────────────────────────────────────────────────────
  // Track which slotKeys are currently visible based on elapsed time
  const [revealedSlots, setRevealedSlots] = useState<Set<string>>(new Set());
  const shuffleRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shuffleState) {
      // Animation done or not active — show everything
      setRevealedSlots(new Set('__all__'));
      if (shuffleRafRef.current) cancelAnimationFrame(shuffleRafRef.current);
      return;
    }
    setRevealedSlots(new Set()); // reset
    const { startTime, delayMs, reveals } = shuffleState;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const revealedCount = Math.floor(elapsed / delayMs);
      const newSet = new Set<string>();
      for (let i = 0; i < Math.min(revealedCount, reveals.length); i++) {
        newSet.add(reveals[i].slotKey);
      }
      setRevealedSlots(newSet);
      if (revealedCount < reveals.length) {
        shuffleRafRef.current = requestAnimationFrame(tick);
      }
    };
    shuffleRafRef.current = requestAnimationFrame(tick);
    return () => { if (shuffleRafRef.current) cancelAnimationFrame(shuffleRafRef.current); };
  }, [shuffleState]);

  // Helper for child components: is this slot revealed?
  const isSlotRevealed = (slotKey: string) =>
    revealedSlots.has('__all__') || revealedSlots.has(slotKey);

  const isShuffling = !!shuffleState;

  const handleElimChange = async (id: 'single' | 'double') => {
    if (hasBracket || id === displayElim) return;
    setPendingElim(id);
    await setElimMode(id);
    setPendingElim(null);
  };

  if (loading) return (
    <div className="flex-1 flex flex-col w-full py-6 gap-5 animate-pulse">
      <div className="h-10 w-36 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-40 rounded-2xl" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-64 rounded-2xl" style={{ background: 'var(--bg-elevated)', opacity: 0.6 }} />
    </div>
  );

  const hasTeams = teams.length >= 2;
  const hasBracket = !!bracket;
  const isSeeded = hasBracket && !!bracket?.upper[0]?.some(m => m.p1 || m.p2);

  return (
    <div className="flex-1 flex flex-col w-full py-4 gap-4 min-h-0 relative">
      <div>
        <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Bracket</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">{isAdmin ? 'Pick a format · Generate structure · Shuffle teams in · Click score numbers to edit' : 'View only — admin required to edit'}</p>
      </div>

      {isAdmin && (
        <div className="t-surface border t-border rounded-2xl p-4 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-['Bebas_Neue'] text-base tracking-widest t-text shrink-0">Format</span>
            <div className="flex gap-2">
              {[{ id: 'single', icon: '⚔️', label: 'Single Elim', desc: 'One loss = out' }, { id: 'double', icon: '🛡️', label: 'Double Elim', desc: 'Two losses = out' }].map(opt => (
                <div key={opt.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all select-none" style={{ borderColor: displayElim === opt.id ? 'var(--accent-red)' : 'var(--border)', background: displayElim === opt.id ? 'rgba(232,41,74,0.06)' : 'var(--bg-elevated)', cursor: hasBracket ? 'not-allowed' : 'pointer', opacity: hasBracket && displayElim !== opt.id ? 0.45 : 1 }} onClick={() => handleElimChange(opt.id as 'single' | 'double')}>
                  <span className="text-base shrink-0">{opt.icon}</span>
                  <div>
                    <div className="font-['DM_Mono'] text-xs font-bold t-text">{opt.label}{hasBracket && displayElim === opt.id && <span className="ml-1.5 font-normal" style={{ color: 'var(--accent-red)' }}>●</span>}</div>
                    <div className="font-['DM_Mono'] text-[10px] t-muted">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-8 w-px" style={{ background: 'var(--border-mid)' }} />
            <div className="flex gap-2">
              {[{ id: 'bo1', label: 'BO1', desc: 'Best of 1' }, { id: 'bo3', label: 'BO3', desc: 'Best of 3' }].map(opt => (
                <div key={opt.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all select-none" style={{ borderColor: matchFormat === opt.id ? 'var(--accent-gold)' : 'var(--border)', background: matchFormat === opt.id ? 'rgba(224,144,16,0.07)' : 'var(--bg-elevated)', cursor: hasBracket ? 'not-allowed' : 'pointer', opacity: hasBracket && matchFormat !== opt.id ? 0.45 : 1 }} onClick={() => !hasBracket && setMatchFormat(opt.id as 'bo1' | 'bo3')}>
                  <div>
                    <div className="font-['DM_Mono'] text-xs font-bold" style={{ color: matchFormat === opt.id ? 'var(--accent-gold)' : 'var(--text)' }}>{opt.label}{hasBracket && matchFormat === opt.id && <span className="ml-1.5 font-normal t-dim">●</span>}</div>
                    <div className="font-['DM_Mono'] text-[10px] t-muted">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {!hasBracket ? (
                <button className="px-4 py-2 font-['DM_Mono'] font-bold rounded-xl text-xs text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap" style={{ background: 'var(--accent-red)' }} onClick={async () => { if (!isAdmin || generating) return; setErr(''); setGenerating(true); const r = await generateBracket(matchFormat); setGenerating(false); if (r?.error) setErr(r.error); }} disabled={!hasTeams || generating}>{generating ? '⏳ Generating…' : '⚡ Generate Bracket'}</button>
              ) : !isSeeded ? (
                <>
                  <button className="px-4 py-2 font-['DM_Mono'] font-bold rounded-xl text-xs text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap" style={{ background: 'var(--accent-green)' }} onClick={async () => { if (!isAdmin || seeding || isShuffling) return; setErr(''); setSeeding(true); const r = await seedBracket(matchFormat); setSeeding(false); if (r?.error) setErr(r.error); }} disabled={seeding || isShuffling}>{seeding || isShuffling ? '🎲 Shuffling…' : '🎲 Shuffle Teams'}</button>
                  <button className="px-4 py-2 font-['DM_Mono'] text-xs border t-border-mid t-muted t-elevated rounded-xl transition-colors cursor-pointer hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] whitespace-nowrap" onClick={resetBracket}>Reset</button>
                </>
              ) : (
                <button className="px-4 py-2 font-['DM_Mono'] text-xs border t-border-mid t-muted t-elevated rounded-xl transition-colors cursor-pointer hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] whitespace-nowrap" onClick={resetBracket}>Reset Bracket</button>
              )}
            </div>
          </div>
          {!hasTeams && <p className="font-['DM_Mono'] text-[11px] mt-2" style={{ color: 'var(--accent-red)' }}>⚠ Form teams first.</p>}
          {hasBracket && !isSeeded && <p className="font-['DM_Mono'] text-[10px] t-dim mt-2">⚠ Format locked — click Shuffle to place teams, or Reset to start over.</p>}
          {isSeeded && <p className="font-['DM_Mono'] text-[10px] t-dim mt-2">⚠ Format locked — reset to change.</p>}
          {err && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-red)' }}>{err}</p>}
        </div>
      )}

      {bracket ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <BracketDisplay bracket={bracket} isAdmin={isAdmin} onScore={updateScore} onThirdPlace={updateThirdPlace} onUndo={undoMatch} isSlotRevealed={isSlotRevealed} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-['DM_Mono'] text-sm t-dim">{isAdmin ? 'Pick a format and click Generate.' : 'Waiting for admin to generate the bracket.'}</p>
        </div>
      )}

      {hasBracket && spinResults.length > 0 && (
        <div className="absolute bottom-6 right-6 t-surface border t-border rounded-xl shadow-2xl w-56 z-50 flex flex-col max-h-[50vh]">
          <div className="p-3 border-b t-border font-['Bebas_Neue'] text-lg tracking-widest bg-[var(--bg-elevated)] rounded-t-xl text-[var(--accent-gold)]">🎯 Spin Queue</div>
          {isAdmin && <div className="p-2 border-b t-border font-['DM_Mono'] text-[9px] t-muted bg-black/10">Drag maps into bracket slots</div>}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {spinResults.map((m, i) => (
              <div key={i} draggable={isAdmin} onDragStart={isAdmin ? (e) => e.dataTransfer.setData('text/plain', m) : undefined} className={`p-2 flex items-center gap-2 text-sm font-['DM_Mono'] border t-border-mid rounded bg-[var(--bg-surface)] transition-colors truncate ${isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-[var(--accent)]' : 'cursor-default'}`}>
                <span className="font-['DM_Mono'] text-[10px] t-dim w-4 text-right">#{i + 1}</span>
                <span>🗺 {m}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BracketDisplay — top-level router ───────────────────────────────────────
function BracketDisplay({ bracket, isAdmin, onScore, onThirdPlace, onUndo, isSlotRevealed }: {
  bracket: Bracket; isAdmin: boolean;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onThirdPlace: (p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isSlotRevealed: (slotKey: string) => boolean;
}) {
  const isBo3 = bracket.upper[0]?.[0]?.format === 'bo3';
  const globalFormat = isBo3 ? 'Best of 3' : 'Best of 1';
  const typeLabel = bracket.type === 'single' ? 'Single Elim' : 'Double Elim';

  return (
    <>
      <div className="t-surface border t-border rounded-xl p-5 shrink-0">
        <div className="flex items-center gap-3 font-['Bebas_Neue'] text-xl tracking-widest t-text mb-6">
          {bracket.type === 'single' ? 'Bracket' : 'Tournament Bracket'}
          <div className="flex gap-2">
            <span className={`text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase ${bracket.type === 'single' ? 'bg-[rgba(232,41,74,0.12)] text-[var(--accent-red)] border-[rgba(232,41,74,0.3)]' : 'bg-[rgba(58,107,255,0.12)] text-[var(--accent)] border-[rgba(58,107,255,0.3)]'}`}>{typeLabel}</span>
            <span className="text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase bg-[rgba(224,144,16,0.1)] text-[var(--accent-gold)] border-[rgba(224,144,16,0.3)]">{globalFormat}</span>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-visible pb-4">
          {bracket.type === 'single'
            ? <SingleElimCanvas bracket={bracket} isAdmin={isAdmin} onScore={onScore} onUndo={onUndo} isSlotRevealed={isSlotRevealed} />
            : <DoubleElimCanvas bracket={bracket} isAdmin={isAdmin} onScore={onScore} onUndo={onUndo} isSlotRevealed={isSlotRevealed} />
          }
        </div>
      </div>

      {/* 3rd place — single elim only */}
      {bracket.type === 'single' && bracket.thirdPlace && (bracket.thirdPlace.p1 || bracket.thirdPlace.p2) && (
        <div className="t-surface border t-border rounded-xl p-5 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-['Bebas_Neue'] text-xl tracking-widest" style={{ color: 'var(--accent-gold)' }}>🥉 3rd Place Match</h3>
            {bracket.thirdPlace.winner && (
              <span className="font-['DM_Mono'] text-[10px] px-2 py-0.5 rounded border" style={{ color: 'var(--accent-gold)', borderColor: 'rgba(224,144,16,0.3)', background: 'rgba(224,144,16,0.08)' }}>🥉 {bracket.thirdPlace.winner}</span>
            )}
          </div>
          <MatchCard
            match={bracket.thirdPlace}
            matchKey="m_thirdPlace_0_0"
            onScore={(p1w, p2w) => onThirdPlace(p1w, p2w)}
            onUndo={() => onUndo('thirdPlace', 0, 0)}
            isAdmin={isAdmin}
            p1SlotKey="m_thirdPlace_0_0_p1"
            p2SlotKey="m_thirdPlace_0_0_p2"
            isSlotRevealed={isSlotRevealed}
          />
        </div>
      )}


    </>
  );
}

// ─── SingleElimCanvas ─────────────────────────────────────────────────────────
function SingleElimCanvas({ bracket, isAdmin, onScore, onUndo, isSlotRevealed }: {
  bracket: Bracket; isAdmin: boolean;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isSlotRevealed: (slotKey: string) => boolean;
}) {
  const rounds = bracket.upper.filter(r => r.length > 0);
  if (rounds.length === 0) return null;

  const OFFSET_Y = 40; // room for round header above first card
  const totalH = rounds[0].length * colSpacing(0) + CARD_H + OFFSET_Y + 20;
  const totalW = rounds.length * COL_W - COL_GAP + 40;
  const stroke = 'var(--border-mid)';
  const cy = (colIdx: number, mi: number) => ubCardTop(colIdx, mi) + CARD_H / 2 + OFFSET_Y;

  return (
    <div style={{ position: 'relative', width: totalW, height: totalH, minWidth: totalW }}>
      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
        {rounds.map((round, colIdx) => {
          if (colIdx === rounds.length - 1) return null;
          return round.map((_, mi) => {
            if (mi % 2 !== 0) return null;
            const x1 = colIdx * COL_W + CARD_W;
            const x2 = (colIdx + 1) * COL_W;
            const midX = x1 + COL_GAP / 2;
            const y1 = cy(colIdx, mi);
            const y2 = cy(colIdx, mi + 1);
            const yt = cy(colIdx + 1, mi / 2);
            return (
              <g key={`se-${colIdx}-${mi}`}>
                <line x1={x1} y1={y1} x2={midX} y2={y1} stroke={stroke} strokeWidth={1.5} />
                <line x1={x1} y1={y2} x2={midX} y2={y2} stroke={stroke} strokeWidth={1.5} />
                <line x1={midX} y1={y1} x2={midX} y2={y2} stroke={stroke} strokeWidth={1.5} />
                <line x1={midX} y1={yt} x2={x2} y2={yt} stroke={stroke} strokeWidth={1.5} />
              </g>
            );
          });
        })}
      </svg>
      {rounds.map((round, colIdx) => {
        const isBo3 = round[0]?.format === 'bo3';
        const isFinal = colIdx === rounds.length - 1 && round.length === 1;
        const isSemi = colIdx === rounds.length - 2 && round.length === 2 && rounds.length >= 3;
        const isQuarter = colIdx === rounds.length - 3 && round.length === 4 && rounds.length >= 4;
        const label = isFinal ? 'Final' : isSemi ? 'Semi Final' : isQuarter ? 'Quarter Final' : `Round ${colIdx + 1}`;
        return round.map((match, mi) => (
          <div key={`se-card-${colIdx}-${mi}`} style={{ position: 'absolute', top: ubCardTop(colIdx, mi) + OFFSET_Y, left: colIdx * COL_W, width: CARD_W }}>
            {mi === 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, width: CARD_W, paddingBottom: 6 }}>
                <RoundHeader section="upper" ri={colIdx} label={label} matchCount={round.length} isBo3={isBo3} isAdmin={isAdmin} />
              </div>
            )}
            <MatchCard
              match={match}
              matchKey={`m_upper_${colIdx}_${mi}`}
              onScore={(p1w, p2w) => onScore('upper', colIdx, mi, p1w, p2w)}
              onUndo={() => onUndo('upper', colIdx, mi)}
              isAdmin={isAdmin}
              p1SlotKey={`m_upper_${colIdx}_${mi}_p1`}
              p2SlotKey={`m_upper_${colIdx}_${mi}_p2`}
              isSlotRevealed={isSlotRevealed}
            />
          </div>
        ));
      })}
    </div>
  );
}

// ─── DoubleElimCanvas — UB + LB + GF on ONE canvas with connecting lines ─────
function DoubleElimCanvas({ bracket, isAdmin, onScore, onUndo, isSlotRevealed }: {
  bracket: Bracket; isAdmin: boolean;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isSlotRevealed: (slotKey: string) => boolean;
}) {
  const ubRounds = bracket.upper.filter(r => r.length > 0);
  const lbRounds = (bracket.lower || []).filter(r => r.length > 0);
  const gf = bracket.grandFinal ?? null;
  if (ubRounds.length === 0) return null;

  // ── Layout: UB sits at top, LB below, GF column at the far right ──────────
  const HEADER_H = 40;     // vertical room for round headers
  const SECTION_GAP = 48; // gap between UB bottom and LB top
  const GF_EXTRA_H = gf?.isReset ? 220 : 120; // extra height reserved for GF (GF2 needs more)

  // UB height
  const ubH = ubRounds[0].length * colSpacing(0) + CARD_H;

  // LB height
  const lbH = lbRounds.length > 0 ? lbRounds[0].length * colSpacing(0) + CARD_H : 0;

  // Total canvas height
  const canvasH = HEADER_H + ubH + (lbH > 0 ? SECTION_GAP + HEADER_H + lbH : 0) + 40;

  // UB columns width (all UB rounds + GF column)
  const ubCols = ubRounds.length;
  const lbCols = lbRounds.length;
  const gfColX = ubCols * COL_W; // X start of GF card
  const canvasW = Math.max(
    ubCols * COL_W - COL_GAP + (gf ? COL_GAP + CARD_W + 60 : 40),
    lbCols * COL_W - COL_GAP + 40,
  );

  // Vertical origins
  const ubOriginY = HEADER_H;
  const lbOriginY = ubOriginY + ubH + SECTION_GAP + HEADER_H;

  // Card centre Y helpers
  const ubCY = (colIdx: number, mi: number) => ubOriginY + ubCardTop(colIdx, mi) + CARD_H / 2;
  const lbCY = (colIdx: number, mi: number) => lbOriginY + lbCardTop(colIdx, mi) + CARD_H / 2;

  // GF card vertical centre — aligned to UB final card centre
  const gfCenterY = ubCY(ubCols - 1, 0);
  const gfTopGF1 = gfCenterY - CARD_H / 2;

  const stroke = 'var(--border-mid)';

  return (
    <div style={{ position: 'relative', width: canvasW, height: canvasH, minWidth: canvasW }}>
      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>

        {/* ── UB connectors ──────────────────────────────────────────── */}
        {ubRounds.map((round, colIdx) => {
          if (colIdx === ubRounds.length - 1) return null; // last UB col connects to GF below
          return round.map((_, mi) => {
            if (mi % 2 !== 0) return null;
            const x1 = colIdx * COL_W + CARD_W;
            const x2 = (colIdx + 1) * COL_W;
            const midX = x1 + COL_GAP / 2;
            const y1 = ubCY(colIdx, mi);
            const y2 = ubCY(colIdx, mi + 1);
            const yt = ubCY(colIdx + 1, mi / 2);
            return (
              <g key={`ub-${colIdx}-${mi}`}>
                <line x1={x1} y1={y1} x2={midX} y2={y1} stroke={stroke} strokeWidth={1.5} />
                <line x1={x1} y1={y2} x2={midX} y2={y2} stroke={stroke} strokeWidth={1.5} />
                <line x1={midX} y1={y1} x2={midX} y2={y2} stroke={stroke} strokeWidth={1.5} />
                <line x1={midX} y1={yt} x2={x2} y2={yt} stroke={stroke} strokeWidth={1.5} />
              </g>
            );
          });
        })}

        {/* ── UB Final → GF connector ────────────────────────────────── */}
        {gf && (() => {
          const x1 = (ubCols - 1) * COL_W + CARD_W;
          const y = ubCY(ubCols - 1, 0);
          return <line x1={x1} y1={y} x2={gfColX} y2={y} stroke={stroke} strokeWidth={1.5} />;
        })()}

        {/* ── LB connectors ──────────────────────────────────────────── */}
        {lbRounds.map((round, colIdx) => {
          if (colIdx === lbRounds.length - 1) return null; // LB Final connects to GF below
          const nextColIdx = colIdx + 1;

          if (colIdx % 2 === 0) {
            // Consolidation → Drop-in: same-Y straight line (same count)
            return round.map((_, mi) => {
              const x1 = colIdx * COL_W + CARD_W;
              const x2 = nextColIdx * COL_W;
              const y = lbCY(colIdx, mi);
              return <line key={`lb-${colIdx}-${mi}`} x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={1.5} />;
            });
          } else {
            // Drop-in → Consolidation: bracket merge (pair of same-Y cards → one)
            return round.map((_, mi) => {
              if (mi % 2 !== 0) return null;
              const x1 = colIdx * COL_W + CARD_W;
              const x2 = nextColIdx * COL_W;
              const midX = x1 + COL_GAP / 2;
              const y1 = lbCY(colIdx, mi);
              const y2 = lbCY(colIdx, mi + 1);
              const yt = lbCY(nextColIdx, mi / 2);
              return (
                <g key={`lb-${colIdx}-${mi}`}>
                  <line x1={x1} y1={y1} x2={midX} y2={y1} stroke={stroke} strokeWidth={1.5} />
                  <line x1={x1} y1={y2} x2={midX} y2={y2} stroke={stroke} strokeWidth={1.5} />
                  <line x1={midX} y1={y1} x2={midX} y2={y2} stroke={stroke} strokeWidth={1.5} />
                  <line x1={midX} y1={yt} x2={x2} y2={yt} stroke={stroke} strokeWidth={1.5} />
                </g>
              );
            });
          }
        })}

        {/* ── LB Final → GF connector ────────────────────────────────── */}
        {gf && lbRounds.length > 0 && (() => {
          const lbFinalColIdx = lbRounds.length - 1;
          const lbFinalX = lbFinalColIdx * COL_W + CARD_W;
          const lbFinalCY = lbCY(lbFinalColIdx, 0);
          const gfP2Y = gfTopGF1 + CARD_H / 2 + 18; // centre of GF p2 row
          // Same solid grey style as all other connectors: right → up/down → into GF p2 slot
          const midX = lbFinalX + COL_GAP / 2;
          return (
            <path
              d={`M ${lbFinalX} ${lbFinalCY} H ${midX} V ${gfP2Y} H ${gfColX}`}
              stroke={stroke}
              strokeWidth={1.5}
              fill="none"
            />
          );
        })()}



      </svg>

      {/* ── UB Section Label ──────────────────────────────────────────── */}
      <div
        className="font-['DM_Mono'] text-[10px] tracking-widest uppercase font-bold absolute"
        style={{ top: 0, left: 0, color: 'var(--accent)', opacity: 0.7 }}
      >
        Upper Bracket
      </div>

      {/* ── UB Cards ──────────────────────────────────────────────────── */}
      {ubRounds.map((round, colIdx) => {
        const isBo3 = round[0]?.format === 'bo3';
        const isFinal = colIdx === ubRounds.length - 1 && round.length === 1;
        const label = isFinal ? 'Upper Final' : `Upper Round ${colIdx + 1}`;
        return round.map((match, mi) => (
          <div key={`ub-card-${colIdx}-${mi}`} style={{ position: 'absolute', top: ubOriginY + ubCardTop(colIdx, mi), left: colIdx * COL_W, width: CARD_W }}>
            {mi === 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, width: CARD_W, paddingBottom: 6 }}>
                <RoundHeader section="upper" ri={colIdx} label={label} matchCount={round.length} isBo3={isBo3} isAdmin={isAdmin} />
              </div>
            )}
            <MatchCard
              match={match}
              matchKey={`m_upper_${colIdx}_${mi}`}
              onScore={(p1w, p2w) => onScore('upper', colIdx, mi, p1w, p2w)}
              onUndo={() => onUndo('upper', colIdx, mi)}
              isAdmin={isAdmin}
              p1SlotKey={`m_upper_${colIdx}_${mi}_p1`}
              p2SlotKey={`m_upper_${colIdx}_${mi}_p2`}
              isSlotRevealed={isSlotRevealed}
            /> ─────────────────────────────────────────────────── */}
      {gf && (
        <div style={{ position: 'absolute', top: gfTopGF1 - HEADER_H, left: gfColX }}>
          <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase font-bold mb-1.5" style={{ color: 'var(--accent)' }}>
            Grand Final
          </div>
          <GrandFinalCards gf={gf} isAdmin={isAdmin} onScore={onScore} onUndo={onUndo} isSlotRevealed={isSlotRevealed} />
        </div>
      )}

      {/* ── LB Section Label ──────────────────────────────────────────── */}
      {lbRounds.length > 0 && (
        <div
          className="font-['DM_Mono'] text-[10px] tracking-widest uppercase font-bold absolute"
          style={{ top: lbOriginY - HEADER_H, left: 0, color: 'var(--accent)', opacity: 0.7 }}
        >
          Lower Bracket
        </div>
      )}

      {/* ── LB Cards ──────────────────────────────────────────────────── */}
      {lbRounds.map((round, colIdx) => {
        const isBo3 = round[0]?.format === 'bo3';
        const isFinal = colIdx === lbRounds.length - 1 && round.length === 1;
        const label = isFinal ? 'Lower Final' : `Lower R${colIdx + 1}`;
        return round.map((match, mi) => (
          <div key={`lb-card-${colIdx}-${mi}`} style={{ position: 'absolute', top: lbOriginY + lbCardTop(colIdx, mi), left: colIdx * COL_W, width: CARD_W }}>
            {mi === 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, width: CARD_W, paddingBottom: 6 }}>
                <RoundHeader section="lower" ri={colIdx} label={label} matchCount={round.length} isBo3={isBo3} isAdmin={isAdmin} />
              </div>
            )}
            <MatchCard
              match={match}
              matchKey={`m_lower_${colIdx}_${mi}`}
              onScore={(p1w, p2w) => onScore('lower', colIdx, mi, p1w, p2w)}
              onUndo={() => onUndo('lower', colIdx, mi)}
              isAdmin={isAdmin}
              p1SlotKey={`m_lower_${colIdx}_${mi}_p1`}
              p2SlotKey={`m_lower_${colIdx}_${mi}_p2`}
              isSlotRevealed={isSlotRevealed}
            />
          </div>
        ));
      })}
    </div>
  );
}

// ─── GrandFinalCards ─────────────────────────────────────────────────────────
// Renders GF1 (and optionally GF2) as stacked cards; called from DoubleElimCanvas.
function GrandFinalCards({ gf, isAdmin, onScore, onUndo }: {
  gf: GrandFinal; isAdmin: boolean;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
}) {
  // Build pseudo BracketMatch objects so we can reuse MatchCard
  const gf1: BracketMatch = {
    p1: gf.p1, p2: gf.p2, format: gf.format,
    score1: gf.score1, score2: gf.score2,
    winner: (!gf.isReset && gf.winner) ? gf.winner : null,
  };
  const gf2: BracketMatch = {
    p1: gf.p1, p2: gf.p2, format: gf.format,
    score1: gf.resetScore1 ?? 0, score2: gf.resetScore2 ?? 0,
    winner: (gf.isReset && gf.winner) ? gf.winner : null,
  };

  const gf1Done = !!(gf.winner || gf.isReset);
  const canUndo = isAdmin && gf1Done;
  // The winning team — either from GF1 (UB winner) or GF2 (reset winner)
  const champion = gf.winner ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* GF1 */}
      <div>
        <div className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-widest mb-1">GF1</div>
        <MatchCard
          match={gf1}
          matchKey="m_gf_0_0"
          onScore={(p1w, p2w) => onScore('gf', 0, 0, p1w, p2w)}
          onUndo={() => onUndo('gf', 0, 0)}
          isAdmin={isAdmin}
        />
        {gf.isReset && (
          <div className="mt-1 px-3 py-1 rounded-lg text-center" style={{ background: 'rgba(58,107,255,0.06)', border: '1px solid rgba(58,107,255,0.2)' }}>
            <span className="font-['DM_Mono'] text-[9px] font-bold" style={{ color: 'var(--accent)' }}>🔄 BRACKET RESET — play GF2</span>
          </div>
        )}
      </div>

      {/* GF2 — only after reset triggered */}
      {gf.isReset && (
        <div>
          <div className="font-['DM_Mono'] text-[9px] uppercase tracking-widest mb-1 font-bold" style={{ color: 'var(--accent)' }}>GF2 — Reset</div>
          <MatchCard
            match={gf2}
            matchKey="m_gf_0_1"
            onScore={(p1w, p2w) => onScore('gf', 0, 0, p1w, p2w)}
            onUndo={() => onUndo('gf', 0, 0)}
            isAdmin={isAdmin}
            highlightBorder="var(--accent)"
          />
        </div>
      )}

      {canUndo && (
        <button
          className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] cursor-pointer text-left transition-colors"
          onClick={() => onUndo('gf', 0, 0)}
        >↩ undo last GF result</button>
      )}

      {/* Champion inline — spinning trophy with sparkles, right below the GF card */}
      {champion && (
        <div
          className="rounded-xl px-4 py-3 text-center border"
          style={{ background: 'rgba(224,144,16,0.06)', borderColor: 'rgba(224,144,16,0.35)', width: CARD_W }}
        >
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginBottom: 4 }}>
            <span className="trophy-spin" style={{ fontSize: 22 }}>🏆</span>
            <span className="sparkle" style={{ top: -8, left: 14, animationDelay: '0s' }}>✦</span>
            <span className="sparkle" style={{ top: 2, left: 24, animationDelay: '0.4s' }}>✦</span>
            <span className="sparkle" style={{ top: -6, left: 28, animationDelay: '0.8s' }}>✦</span>
          </div>
          <div className="font-['Bebas_Neue'] text-lg tracking-widest" style={{ color: 'var(--accent-gold)' }}>{champion}</div>
          <div className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-widest">Champion</div>
        </div>
      )}
    </div>
  );
}
