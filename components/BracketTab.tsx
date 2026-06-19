'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import { parseStageMaps } from '@/lib/utils';
import { computeMatchNumbers, feederLabel, type MatchNumbers } from '@/lib/bracket';
import type { BracketMatch, GrandFinal, Bracket } from '@/lib/types';

// ─── Layout constants ─────────────────────────────────────────────────────────
const CARD_W = 210;
const CARD_H = 100;   // fixed height — never changes, so SVG lines stay aligned
const COL_GAP = 72;
const COL_W = CARD_W + COL_GAP;
const ROW_GAP = 28;   // vertical gap between cards in round 0

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function colSpacing(colIdx: number): number {
  return (CARD_H + ROW_GAP) * Math.pow(2, colIdx);
}

// ─── FitCanvas — auto-zoom to fit everything on screen, drag to pan ───────────
function FitCanvas({ children, deps }: { children: React.ReactNode; deps?: unknown[] }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);

  // Clamp so you can't drag content fully off-screen
  const clampX = (val: number, s: number) => {
    const cw = containerRef.current?.clientWidth ?? 0;
    const contentW = (contentRef.current?.scrollWidth ?? contentRef.current?.offsetWidth ?? 0) * s;
    const lo = Math.min(0, cw - contentW);
    return Math.max(lo, Math.min(0, val));
  };
  const clampY = (val: number, s: number) => {
    const ch = containerRef.current?.clientHeight ?? 0;
    const contentH = (contentRef.current?.scrollHeight ?? contentRef.current?.offsetHeight ?? 0) * s;
    const lo = Math.min(0, ch - contentH);
    return Math.max(lo, Math.min(0, val));
  };

  const fitToScreen = useCallback(() => {
    const cw = containerRef.current?.clientWidth ?? 0;
    const ch = containerRef.current?.clientHeight ?? 0;
    // Use scrollHeight to capture absolutely-positioned children
    const contentW = contentRef.current?.scrollWidth ?? contentRef.current?.offsetWidth ?? 0;
    const contentH = contentRef.current?.scrollHeight ?? contentRef.current?.offsetHeight ?? 0;
    if (!cw || !ch || !contentW || !contentH) return;
    const fit = Math.min(cw / contentW, ch / contentH);
    setScale(fit);
    setTx(0);
    setTy(0);
  }, []);

  // Fit on mount and when bracket structure changes (rounds added/removed, type change)
  // NOT on score updates or team assignments — those don't change dimensions
  const fitKey = deps ? JSON.stringify(deps) : '';
  useLayoutEffect(() => {
    // Triple RAF to ensure all nested absolutely-positioned content has rendered
    const id = requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(fitToScreen)));
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => {
    const ro = new ResizeObserver(fitToScreen);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [fitToScreen]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const dir = e.deltaY > 0 ? -1 : 1;
      setScale(prev => {
        const newScale = Math.max(0.1, Math.min(2, prev * (1 + dir * 0.12)));
        const ratio = newScale / prev;
        setTx(t => clampX(cx - (cx - t) * ratio, newScale));
        setTy(t => clampY(cy - (cy - t) * ratio, newScale));
        return newScale;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampX, clampY]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setTx(prev => clampX(d.startTx + (e.clientX - d.startX), scale));
    setTy(prev => clampY(d.startTy + (e.clientY - d.startY), scale));
  }, [scale]);

  // Snap to grid on release — round to nearest card boundary so content
  // always aligns to match-card blocks (no half-visible cards at edges)
  const snapToGrid = useCallback(() => {
    const s = scale;
    const snapX = CARD_W + COL_GAP; // one column width
    const snapY = CARD_H + ROW_GAP; // one row height
    setTx(prev => Math.round(prev / snapX) * snapX);
    setTy(prev => Math.round(prev / snapY) * snapY);
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    setIsPanning(false);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    snapToGrid();
  }, [onMouseMove, snapToGrid]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || target.closest('[draggable="true"], button, input, a, select, textarea')) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTx: tx, startTy: ty };
    setIsPanning(true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [tx, ty, onMouseMove, onMouseUp]);

  useEffect(() => () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove, onMouseUp]);

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      className="relative overflow-hidden rounded-lg select-none"
      style={{ flex: 1, minHeight: 0, cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none', overscrollBehavior: 'contain', background: 'var(--bg)' }}
    >
      <div
        ref={contentRef}
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transformOrigin: '0 0',
          display: 'inline-block',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ubCardTop(colIdx: number, mi: number): number {
  if (colIdx === 0) return mi * colSpacing(0);
  const aTop = ubCardTop(colIdx - 1, mi * 2);
  const bTop = ubCardTop(colIdx - 1, mi * 2 + 1);
  return (aTop + bTop) / 2;
}

function lbCardTop(colIdx: number, mi: number): number {
  if (colIdx === 0) return mi * colSpacing(0);
  if (colIdx % 2 === 1) return lbCardTop(colIdx - 1, mi);
  const aTop = lbCardTop(colIdx - 1, mi * 2);
  const bTop = lbCardTop(colIdx - 1, mi * 2 + 1);
  return (aTop + bTop) / 2;
}


// ─── Trophy + ghost shimmer + drop glow animations (injected once) ────────────
if (typeof document !== 'undefined' && !document.getElementById('trophy-anim-style')) {
  const s = document.createElement('style');
  s.id = 'trophy-anim-style';
  s.textContent = `
    @keyframes trophy-spin { from { transform: rotate(-12deg); } to { transform: rotate(12deg); } }
    @keyframes sparkle { 0%,100% { opacity:0; transform:scale(0.4); } 50% { opacity:1; transform:scale(1); } }
    @keyframes slot-pop { 0% { opacity:0; transform:scale(0.7) translateY(4px); } 60% { transform:scale(1.08) translateY(-1px); } 100% { opacity:1; transform:scale(1) translateY(0); } }
    @keyframes ghost-pulse { 0%,100% { opacity:0.45; } 50% { opacity:0.7; } }
    @keyframes drop-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(58,107,255,0); border-color: rgba(58,107,255,0.4); } 50% { box-shadow: 0 0 0 3px rgba(58,107,255,0.35), inset 0 0 12px rgba(58,107,255,0.12); border-color: rgba(58,107,255,0.9); } }
    @keyframes map-drop-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(58,107,255,0); border-color: rgba(58,107,255,0.35); } 50% { box-shadow: 0 0 0 2px rgba(58,107,255,0.3), inset 0 0 8px rgba(58,107,255,0.1); border-color: rgba(58,107,255,0.8); } }
    @keyframes match-card-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(77,124,255,0), 0 2px 8px rgba(0,0,0,0.12); } 50% { box-shadow: 0 0 0 3px rgba(77,124,255,0.28), 0 0 20px rgba(77,124,255,0.18), 0 2px 8px rgba(0,0,0,0.18); } }
    .trophy-spin { display:inline-block; animation: trophy-spin 0.7s ease-in-out 8 alternate; }
    .sparkle { position:absolute; font-size:10px; animation: sparkle 1.2s ease-in-out 5; }
    .slot-pop { animation: slot-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    .ghost-card { animation: ghost-pulse 2s ease-in-out infinite; }
    .drop-active { animation: drop-glow 0.9s ease-in-out infinite !important; }
    .map-drop-active { animation: map-drop-glow 0.9s ease-in-out infinite !important; }
    .match-card-glow { animation: match-card-glow 2.4s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ─── GhostMatchCard ───────────────────────────────────────────────────────────
function GhostMatchCard({ slotIdx }: { slotIdx: number }) {
  return (
    <div
      className="ghost-card border border-dashed rounded-xl overflow-hidden flex flex-col"
      style={{ width: CARD_W, height: CARD_H, borderColor: 'var(--border-mid)', background: 'var(--bg-elevated)', opacity: 0.55 }}
    >
      {[0, 1].map(row => (
        <div
          key={row}
          className="flex items-center px-3 border-b"
          style={{ height: 36, borderColor: 'var(--border)', borderBottomStyle: row === 0 ? 'solid' : 'none' }}
        >
          <div className="h-2.5 rounded-full" style={{ width: row === 0 ? 80 : 64, background: 'var(--border-mid)' }} />
        </div>
      ))}
      <div
        className="flex items-center justify-center h-7 border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="font-['DM_Mono'] text-[9px]" style={{ color: 'var(--text-dim)' }}>Match {slotIdx + 1}</span>
      </div>
    </div>
  );
}

// ─── TeamPool ─────────────────────────────────────────────────────────────────
function TeamPool({ teams, assignedTeams, isAdmin }: {
  teams: string[];
  assignedTeams: Set<string>;
  isAdmin: boolean;
}) {
  if (teams.length === 0) return null;
  return (
    <div
      className="t-surface border t-border rounded-2xl p-3 shrink-0 sticky top-0 z-20"
      style={{ background: 'var(--bg-elevated)', backdropFilter: 'blur(8px)' }}
    >
      <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase t-dim mb-2">
        Teams{isAdmin ? <span style={{ color: 'var(--accent)', opacity: 0.7 }}> — drag into match slots</span> : ''}
      </div>
      <div className="flex flex-wrap gap-2">
        {teams.map(team => {
          const used = assignedTeams.has(team);
          return (
            <div
              key={team}
              draggable={isAdmin}
              onDragStart={isAdmin
                ? (e) => {
                    e.dataTransfer.setData('text/team', team);
                    e.dataTransfer.effectAllowed = 'move';
                  }
                : undefined
              }
              className="px-3 py-1.5 rounded-lg border font-['DM_Mono'] text-xs select-none transition-all"
              style={{
                borderColor: used ? 'var(--accent-green)' : 'var(--accent)',
                background: used ? 'rgba(34,184,98,0.10)' : 'rgba(77,124,255,0.12)',
                color: used ? 'var(--accent-green)' : 'var(--accent)',
                opacity: 1,
                cursor: isAdmin ? 'grab' : 'default',
                textDecoration: undefined,
                fontWeight: 700,
                boxShadow: !used ? '0 0 0 0px rgba(77,124,255,0)' : undefined,
              }}
              onMouseEnter={isAdmin ? (e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(77,124,255,0.22)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 10px rgba(77,124,255,0.25)';
              } : undefined}
              onMouseLeave={isAdmin ? (e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = used ? 'var(--accent-green)' : 'var(--accent)';
                (e.currentTarget as HTMLDivElement).style.background = used ? 'rgba(34,184,98,0.10)' : 'rgba(77,124,255,0.12)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 0px rgba(77,124,255,0)';
              } : undefined}
              title={isAdmin ? `Drag ${team} into a match slot${used ? ' (already placed)' : ''}` : team}
            >
              {used
                ? <span style={{ marginRight: 4, opacity: 0.8 }}>✓</span>
                : <span style={{ color: 'var(--accent)', marginRight: 4, opacity: 0.6 }}>⬡</span>
              }{team}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────
function PlayerRow({
  player, score, isWinner, isLoser, showScore, canEdit, maxWins, onCommit,
  canManualAssign, allTeams, onManualAssign, placeholder,
}: {
  player: string | null; score: number; isWinner: boolean; isLoser: boolean;
  showScore: boolean; canEdit?: boolean; maxWins?: number;
  onCommit?: (n: number) => void;
  canManualAssign?: boolean;
  allTeams?: string[];
  onManualAssign?: (team: string | null) => void;
  placeholder?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const startEdit = () => { if (!canEdit) return; setDraft(String(score)); setEditing(true); };
  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 0) onCommit?.(n);
  };

  const acceptsDrop = canManualAssign && !isWinner && !isLoser;

  return (
    <div
      className={`flex items-center justify-between px-3 border-b t-border last:border-b-0 ${acceptsDrop && dragOver ? 'drop-active' : ''}`}
      style={{
        height: 36,
        background: isWinner ? 'rgba(34,184,98,0.10)' : isLoser ? 'rgba(120,120,160,0.05)' : dragOver ? 'rgba(58,107,255,0.10)' : undefined,
        position: 'relative',
        outline: dragOver ? '2px solid var(--accent)' : undefined,
        outlineOffset: '-2px',
        borderRadius: dragOver ? 4 : undefined,
        transition: 'background 0.15s, outline 0.15s',
      }}
      onDragOver={acceptsDrop ? (e) => {
        if (e.dataTransfer.types.includes('text/team')) {
          e.preventDefault();
          setDragOver(true);
        }
      } : undefined}
      onDragLeave={acceptsDrop ? () => setDragOver(false) : undefined}
      onDrop={acceptsDrop ? (e) => {
        e.preventDefault();
        setDragOver(false);
        const team = e.dataTransfer.getData('text/team');
        if (team) onManualAssign?.(team);
      } : undefined}
    >
      <span
        className={`text-xs font-['DM_Mono'] flex-1 truncate${player ? ' slot-pop' : ''}`}
        draggable={!!(canManualAssign && player && !isWinner && !isLoser)}
        onDragStart={canManualAssign && player && !isWinner && !isLoser ? (e) => {
          e.dataTransfer.setData('text/team', player);
          e.dataTransfer.effectAllowed = 'move';
          onManualAssign?.(null);
        } : undefined}
        style={{
          color: !player ? (canManualAssign ? 'var(--accent)' : 'var(--text-dim)') : isWinner ? 'var(--accent-green)' : isLoser ? 'var(--text-muted)' : 'var(--text)',
          fontStyle: !player && !canManualAssign ? 'italic' : undefined,
          opacity: isLoser ? 1 : 1,
          cursor: canManualAssign && player && !isWinner && !isLoser ? 'grab' : undefined,
        }}
        title={canManualAssign && player && !isWinner && !isLoser ? 'Drag to remove' : canManualAssign && !player ? 'Drop a team here' : undefined}
      >
        {isWinner && '✓ '}
        {player ?? (isLoser ? 'BYE' : (placeholder ?? 'TBD'))}
      </span>
      {showScore && (
        editing ? (
          <input
            autoFocus type="number" min={0} max={maxWins ?? 1}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            onClick={e => e.stopPropagation()}
            className="w-8 text-center font-['Bebas_Neue'] text-base rounded border bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          />
        ) : (
          <span
            className="font-['Bebas_Neue'] text-base ml-2 shrink-0 rounded px-1"
            style={{ color: isWinner ? 'var(--accent-green)' : 'var(--text-dim)', cursor: canEdit ? 'text' : 'default', outline: canEdit ? '1px dashed var(--border-mid)' : 'none', minWidth: 20, textAlign: 'center' }}
            onClick={e => { e.stopPropagation(); startEdit(); }}
          >{score}</span>
        )
      )}
    </div>
  );
}

// ─── RoundHeader (with map drop zones) ───────────────────────────────────────
function RoundHeader({ section, ri, label, matchCount, slotCount, isAdmin }: {
  section: string; ri: number; label: string; matchCount: number; slotCount: number; isAdmin: boolean;
}) {
  const { assignStage } = useTourney();
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  return (
    <div className="flex items-end justify-between w-full">
      <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase t-dim">{label}</div>
      {isAdmin && (
        <div className="flex gap-1">
          {Array.from({ length: slotCount }).map((_, slotIdx) => (
            <div
              key={slotIdx}
              className={`w-[18px] h-[18px] border border-dashed t-border-mid rounded bg-[var(--bg-surface)] text-[9px] flex items-center justify-center t-dim transition-colors cursor-crosshair ${dropSlot === slotIdx ? 'map-drop-active' : 'hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[rgba(58,107,255,0.05)]'}`}
              onDragOver={e => {
                if (e.dataTransfer.types.includes('text/plain') && !e.dataTransfer.types.includes('text/team')) {
                  e.preventDefault();
                  setDropSlot(slotIdx);
                }
              }}
              onDragLeave={() => setDropSlot(null)}
              onDrop={async e => {
                e.preventDefault();
                setDropSlot(null);
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
function MapSlots({ matchKey, slotCount, isAdmin }: { matchKey: string; slotCount: number; isAdmin: boolean }) {
  const { stageMaps, assignStage, clearStage } = useTourney();
  const maps = parseStageMaps(stageMaps[matchKey] || '');
  const [dropSlot, setDropSlot] = useState<number | null>(null);

  return (
    <div className="flex h-7 border-t t-border bg-[var(--bg-surface)] shrink-0">
      {Array.from({ length: slotCount }).map((_, slotIdx) => {
        const map = maps[slotIdx];
        const isDropTarget = dropSlot === slotIdx;
        return (
          <div
            key={slotIdx}
            className={`flex-1 flex items-center justify-center font-['DM_Mono'] text-[9px] border-r t-border last:border-r-0 relative group transition-colors ${isAdmin && isDropTarget ? 'map-drop-active' : ''}`}
            style={{ background: map ? 'rgba(58,107,255,0.04)' : undefined, color: map ? 'var(--accent)' : 'var(--text-muted)' }}
            onDragOver={isAdmin ? (e) => {
              if (e.dataTransfer.types.includes('text/plain') && !e.dataTransfer.types.includes('text/team')) {
                e.preventDefault();
                setDropSlot(slotIdx);
              }
            } : undefined}
            onDragLeave={isAdmin ? () => setDropSlot(null) : undefined}
            onDrop={isAdmin ? async (e) => {
              e.preventDefault();
              setDropSlot(null);
              const m = e.dataTransfer.getData('text/plain');
              if (m) await assignStage(matchKey, m, slotIdx);
            } : undefined}
          >
            {map ? (
              <>
                <span className="truncate px-1 max-w-[85%]">{map}</span>
                {isAdmin && (
                  <button onClick={() => clearStage(matchKey, slotIdx)} className="absolute right-1 hidden group-hover:flex w-4 h-4 items-center justify-center bg-black/60 rounded-full text-[var(--accent-red)] transition-opacity" title="Clear map">✕</button>
                )}
              </>
            ) : (
              <span>{slotCount > 1 ? `Map ${slotIdx + 1}` : 'Drop Map'}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────
// matchNumber is no longer rendered inside MatchCard.
// It is rendered as a sibling element in the canvas wrapper divs (SingleElimCanvas /
// DoubleElimCanvas), positioned on the output connector line at left=CARD_W, top=CARD_H/2.
function MatchCard({
  match, matchKey, onScore, onUndo, isAdmin, highlightBorder,
  p1SlotKey, p2SlotKey, isSlotRevealed,
  allTeams, onManualAssign, p1Placeholder, p2Placeholder,
  onCardClick,
}: {
  match: BracketMatch; matchKey: string;
  onScore: (p1wins: number, p2wins: number) => void;
  onUndo: () => void;
  isAdmin: boolean;
  highlightBorder?: string;
  p1SlotKey?: string;
  p2SlotKey?: string;
  isSlotRevealed?: (slotKey: string) => boolean;
  allTeams?: string[];
  onManualAssign?: (slot: 1 | 2, team: string | null) => void;
  p1Placeholder?: string | null;
  p2Placeholder?: string | null;
  onCardClick?: () => void;
}) {
  const [s1, setS1] = useState(match.score1);
  const [s2, setS2] = useState(match.score2);
  useEffect(() => { setS1(match.score1); setS2(match.score2); }, [match.score1, match.score2]);

  const isBo3 = match.format === 'bo3';
  const isBo5 = match.format === 'bo5';
  const maxWins = isBo5 ? 3 : isBo3 ? 2 : 1;
  const slotCount = isBo5 ? 5 : isBo3 ? 3 : 1;
  const isDone = !!match.winner;
  const canEdit = isAdmin && !!match.p1 && !!match.p2 && !isDone;
  const canUndo = isAdmin && isDone;
  const isModified = s1 !== match.score1 || s2 !== match.score2;

  const p1Revealed = !p1SlotKey || !isSlotRevealed || isSlotRevealed(p1SlotKey);
  const p2Revealed = !p2SlotKey || !isSlotRevealed || isSlotRevealed(p2SlotKey);

  const canManualAssign = isAdmin && !isDone && !!allTeams && !!onManualAssign;

  return (
    <div style={{ position: 'relative' }}>
      <div
        className={`t-elevated border rounded-xl overflow-hidden flex flex-col shadow-sm match-card-glow${onCardClick ? ' cursor-pointer' : ''}`}
        style={{ width: CARD_W, height: CARD_H, position: 'relative', borderColor: highlightBorder ?? 'var(--border-mid)', borderWidth: highlightBorder ? 2 : 1.5 }}
        onClick={onCardClick}
        title={onCardClick ? 'Click to view match details' : undefined}
      >
        <PlayerRow player={p1Revealed ? match.p1 : null} score={isDone ? match.score1 : s1} isWinner={isDone && match.winner === match.p1} isLoser={isDone && match.winner !== match.p1} showScore={isDone || !!(match.p1 && match.p2)} canEdit={canEdit} maxWins={maxWins} onCommit={n => setS1(n)} canManualAssign={canManualAssign} allTeams={allTeams} onManualAssign={team => onManualAssign?.(1, team)} placeholder={p1Placeholder} />
        <PlayerRow player={p2Revealed ? match.p2 : null} score={isDone ? match.score2 : s2} isWinner={isDone && match.winner === match.p2} isLoser={isDone && match.winner !== match.p2} showScore={isDone || !!(match.p1 && match.p2)} canEdit={canEdit} maxWins={maxWins} onCommit={n => setS2(n)} canManualAssign={canManualAssign} allTeams={allTeams} onManualAssign={team => onManualAssign?.(2, team)} placeholder={p2Placeholder} />
        <MapSlots matchKey={matchKey} slotCount={slotCount} isAdmin={isAdmin} />
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

// ─── MatchNumberBadge ─────────────────────────────────────────────────────────
// Rendered as a sibling of MatchCard in the canvas wrapper div.
// Sits on the output connector line: left of CARD_W, vertically centred at CARD_H/2.
// Floats just above the line so it doesn't cross through it.
function MatchNumberBadge({ matchNumber }: { matchNumber: number }) {
  return (
    <div
      className="font-['DM_Mono'] pointer-events-none"
      style={{
        position: 'absolute',
        // Pin horizontally just past the right card edge — on the output line
        left: CARD_W + 4,
        // Sit just above the horizontal connector (CARD_H/2), leaving 1px gap
        top: CARD_H / 2 - 15,
        height: 14,
        paddingLeft: 4,
        paddingRight: 4,
        borderRadius: 3,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-mid)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 8,
        color: 'var(--text-dim)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        zIndex: 4,
      }}
      title={`Match ${matchNumber}`}
    >
      {matchNumber}
    </div>
  );
}

// ─── StepIndicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Format' },
    { n: 2, label: 'Generate' },
    { n: 3, label: 'Shuffle' },
  ];
  return (
    <div className="flex items-center gap-1 shrink-0">
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="flex items-center gap-1">
            <div className="flex items-center gap-1">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center font-['DM_Mono'] text-[9px] font-bold shrink-0"
                style={{
                  background: done ? 'var(--accent-green)' : active ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: done || active ? '#fff' : 'var(--text-dim)',
                  border: done || active ? 'none' : '1px solid var(--border-mid)',
                }}
              >
                {done ? '✓' : s.n}
              </div>
              <span
                className="font-['DM_Mono'] text-[10px]"
                style={{ color: active ? 'var(--text)' : done ? 'var(--accent-green)' : 'var(--text-dim)' }}
              >{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-5 h-px mx-1" style={{ background: step > s.n ? 'var(--accent-green)' : 'var(--border-mid)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SpinQueuePanel ───────────────────────────────────────────────────────────
function SpinQueuePanel({ spinResults }: { spinResults: string[] }) {
  return (
    <div
      className="absolute bottom-6 right-6 t-surface border t-border rounded-xl shadow-2xl z-50 flex flex-col max-h-[50vh]"
      style={{ width: CARD_W }}
    >
      <div
        className="px-3 py-2 border-b t-border font-['Bebas_Neue'] text-lg tracking-widest rounded-t-xl shrink-0"
        style={{ background: 'var(--bg-elevated)', color: 'var(--accent-gold)' }}
      >
        🎯 Spin Queue
      </div>
      <div className="px-3 py-1.5 border-b t-border font-['DM_Mono'] text-[9px] t-muted shrink-0">
        Drag maps into bracket slots
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {spinResults.map((m, i) => (
          <div
            key={i}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', m);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className="flex items-center gap-2 font-['DM_Mono'] border t-border-mid rounded t-elevated transition-colors cursor-grab active:cursor-grabbing hover:border-[var(--accent)] select-none"
            style={{ height: 28, paddingLeft: 8, paddingRight: 8 }}
            title={`Drag "${m}" into a map slot`}
          >
            <span className="font-['DM_Mono'] text-[9px] t-dim w-4 text-right shrink-0">#{i + 1}</span>
            <span className="text-[11px] t-text truncate flex-1">🗺 {m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BracketTab ──────────────────────────────────────────────────────────────────
export function BracketTab({ spinResults, onMatchCardClick }: { spinResults: string[]; onMatchCardClick?: (matchKey: string) => void }) {
  const { bracket, elimMode, teams, isAdmin, loading, stageFormats, setStageFormats, setElimMode, generateBracket, seedBracket, updateScore, undoMatch, updateThirdPlace, resetBracket, manualSeedSlot } = useTourney();
  const [err, setErr] = useState('');
  const [generating, setGenerating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [localSF, setLocalSF] = useState(stageFormats);
  const [localElim, setLocalElim] = useState<'single' | 'double'>(elimMode);

  useEffect(() => {
    if (!loading) {
      setLocalSF(stageFormats);
      setLocalElim(elimMode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stageFormats.upperBracket, stageFormats.lowerBracket, stageFormats.lowerBracketFinal, stageFormats.grandFinal, elimMode]);

  const handleSFChange = useCallback((key: keyof typeof localSF, fmt: 'bo1' | 'bo3' | 'bo5') => {
    const next = { ...localSF, [key]: fmt };
    setLocalSF(next);
    setStageFormats(next);
  }, [localSF, setStageFormats]);

  const handleElimChange = useCallback(async (id: 'single' | 'double') => {
    if (bracket || id === localElim) return;
    setLocalElim(id);
    setElimMode(id);
  }, [bracket, localElim, setElimMode]);

  const [revealedSlots, setRevealedSlots] = useState<Set<string>>(() => new Set(['__all__']));
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const runRevealAnimation = (reveals: { slotKey: string; team: string }[], delayMs: number) => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
    setRevealedSlots(new Set());
    reveals.forEach((r, i) => {
      const t = setTimeout(() => {
        setRevealedSlots(prev => { const next = new Set(prev); next.add(r.slotKey); return next; });
      }, i * delayMs);
      timerRefs.current.push(t);
    });
    const totalMs = reveals.length * delayMs + 200;
    const finalTimer = setTimeout(() => { setRevealedSlots(new Set(['__all__'])); }, totalMs);
    timerRefs.current.push(finalTimer);
  };

  const isSlotRevealed = (slotKey: string) =>
    revealedSlots.has('__all__') || revealedSlots.has(slotKey);

  const handleShuffle = async () => {
    if (!isAdmin || seeding) return;
    setErr('');
    setSeeding(true);
    const r = await seedBracket(localSF);
    setSeeding(false);
    if (r?.error) setErr(r.error);
    else if (r?.shuffleState) runRevealAnimation(r.shuffleState.reveals, r.shuffleState.delayMs);
  };

  const handleCardClick = (matchKey: string) => {
    onMatchCardClick?.(matchKey);
  };

  if (loading) return (
    <div className="flex flex-col gap-4 py-4">
      <div className="h-10 w-36 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-40 rounded-2xl" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-64 rounded-2xl" style={{ background: 'var(--bg-elevated)', opacity: 0.6 }} />
    </div>
  );

  const hasTeams = teams.length >= 2;
  const hasBracket = !!bracket;
  const isSeeded = hasBracket && !!bracket?.upper[0]?.some(m => m.p1 || m.p2);

  const currentStep: 1 | 2 | 3 = !hasBracket ? 1 : !isSeeded ? 2 : 3;

  return (
    <div className="flex-1 flex flex-col w-full py-4 gap-4 min-h-0 relative">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Bracket</h1>
          <p className="font-['DM_Mono'] text-xs t-muted">
            {isAdmin ? 'Pick a format · Generate structure · Shuffle teams in · Click scores to edit' : 'View only — admin required to edit'}
          </p>
        </div>
        {isAdmin && <StepIndicator step={currentStep} />}
      </div>

      {isAdmin && (
        <div className="t-surface border t-border rounded-2xl p-4 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-['Bebas_Neue'] text-base tracking-widest t-text shrink-0">Format</span>
            <div className="flex gap-2">
              {[{ id: 'single', icon: '⚔️', label: 'Single Elim', desc: 'One loss = out' }, { id: 'double', icon: '🛡️', label: 'Double Elim', desc: 'Two losses = out' }].map(opt => (
                <div key={opt.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all select-none" style={{ borderColor: localElim === opt.id ? 'var(--accent-red)' : 'var(--border)', background: localElim === opt.id ? 'rgba(232,41,74,0.06)' : 'var(--bg-elevated)', cursor: hasBracket ? 'not-allowed' : 'pointer', opacity: hasBracket && localElim !== opt.id ? 0.45 : 1 }} onClick={() => handleElimChange(opt.id as 'single' | 'double')}>
                  <span className="text-base shrink-0">{opt.icon}</span>
                  <div>
                    <div className="font-['DM_Mono'] text-xs font-bold t-text">{opt.label}{hasBracket && localElim === opt.id && <span className="ml-1.5 font-normal" style={{ color: 'var(--accent-red)' }}>●</span>}</div>
                    <div className="font-['DM_Mono'] text-[10px] t-muted">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-8 w-px shrink-0" style={{ background: 'var(--border-mid)' }} />

            <div className="flex flex-col gap-1.5">
              <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase t-dim mb-0.5">Match Format</div>
              {([
                { key: 'upperBracket',      label: 'Upper Bracket' },
                ...(localElim === 'double' ? [
                  { key: 'lowerBracket' as const,      label: 'Lower Bracket' },
                  { key: 'lowerBracketFinal' as const, label: 'Lower Bracket Final' },
                ] : []),
                { key: 'grandFinal', label: 'Grand Final' },
              ] as { key: keyof typeof localSF; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="font-['DM_Mono'] text-[10px] t-muted w-32 shrink-0">{label}</span>
                  <div className="flex gap-1">
                    {(['bo1', 'bo3', 'bo5'] as const).map(fmt => (
                      <button
                        key={fmt}
                        disabled={hasBracket}
                        onClick={() => handleSFChange(key, fmt)}
                        className="px-2 py-0.5 font-['DM_Mono'] text-[10px] font-bold rounded border-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                        style={{
                          borderColor: localSF[key] === fmt ? 'var(--accent-gold)' : 'var(--border)',
                          background:  localSF[key] === fmt ? 'rgba(224,144,16,0.1)' : 'var(--bg-elevated)',
                          color:       localSF[key] === fmt ? 'var(--accent-gold)' : 'var(--text-dim)',
                          opacity:     hasBracket && localSF[key] !== fmt ? 0.4 : 1,
                        }}
                      >{fmt.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0 flex-wrap">
              {!hasBracket ? (
                <button
                  className="px-4 py-2 font-['DM_Mono'] font-bold rounded-xl text-xs text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  style={{ background: 'var(--accent-red)' }}
                  onClick={async () => {
                    if (!isAdmin || generating) return;
                    setErr('');
                    setGenerating(true);
                    const r = await generateBracket(localSF);
                    setGenerating(false);
                    if (r?.error) setErr(r.error);
                  }}
                  disabled={!hasTeams || generating}
                >
                  {generating ? '⏳ Generating…' : '⚡ Generate Bracket'}
                </button>
              ) : (
                <>
                  <button
                    className="px-4 py-2 font-['DM_Mono'] font-bold rounded-xl text-xs text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                    style={{
                      background: isSeeded ? 'var(--bg-elevated)' : 'var(--accent-green)',
                      color: isSeeded ? 'var(--text)' : '#fff',
                      border: isSeeded ? '1px solid var(--border-mid)' : 'none',
                      boxShadow: !isSeeded ? '0 0 16px rgba(34,184,98,0.3)' : 'none',
                    }}
                    onClick={handleShuffle}
                    disabled={seeding}
                  >
                    {seeding ? '🎲 Shuffling…' : isSeeded ? '🔀 Re-Shuffle' : '🎲 Shuffle Teams'}
                  </button>
                  <button
                    className="px-4 py-2 font-['DM_Mono'] text-xs border t-border-mid t-muted t-elevated rounded-xl transition-colors cursor-pointer hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] whitespace-nowrap"
                    onClick={resetBracket}
                  >Reset Bracket</button>
                </>
              )}
            </div>
          </div>

          {!hasTeams && <p className="font-['DM_Mono'] text-[11px] mt-2" style={{ color: 'var(--accent-red)' }}>⚠ Form teams first.</p>}
          {hasBracket && !isSeeded && isAdmin && (
            <p className="font-['DM_Mono'] text-[10px] mt-2" style={{ color: 'var(--accent-green)' }}>
              ✓ Structure generated — click Shuffle Teams to draw matchups.
            </p>
          )}
          {hasBracket && isSeeded && (
            <p className="font-['DM_Mono'] text-[10px] t-dim mt-2">Re-Shuffle to re-randomise teams · Reset to clear the bracket.</p>
          )}
          {err && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-red)' }}>{err}</p>}
        </div>
      )}

      {bracket ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
          <BracketDisplay
            bracket={bracket}
            isAdmin={isAdmin}
            isSeeded={isSeeded}
            onScore={updateScore}
            onThirdPlace={updateThirdPlace}
            onUndo={undoMatch}
            isSlotRevealed={isSlotRevealed}
            allTeams={teams.map(t => t.customName || t.name)}
            onManualAssign={manualSeedSlot}
            onCardClick={handleCardClick}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <div className="flex gap-4 opacity-30 pointer-events-none select-none">
            {[4, 2, 1].map((count, colIdx) => (
              <div key={colIdx} className="flex flex-col" style={{ gap: colSpacing(colIdx) - CARD_H }}>
                {Array.from({ length: count }).map((_, mi) => (
                  <GhostMatchCard key={mi} slotIdx={mi} />
                ))}
              </div>
            ))}
          </div>
          <p className="font-['DM_Mono'] text-sm t-dim">
            {isAdmin ? 'Configure format above and click Generate.' : 'Waiting for admin to generate the bracket.'}
          </p>
        </div>
      )}

      {isAdmin && hasBracket && spinResults.length > 0 && (
        <SpinQueuePanel spinResults={spinResults} />
      )}

    </div>
  );
}

// ─── BracketDisplay ───────────────────────────────────────────────────────────
function BracketDisplay({ bracket, isAdmin, isSeeded, onScore, onThirdPlace, onUndo, isSlotRevealed, allTeams, onManualAssign, onCardClick }: {
  bracket: Bracket; isAdmin: boolean; isSeeded: boolean;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onThirdPlace: (p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isSlotRevealed: (slotKey: string) => boolean;
  allTeams: string[];
  onManualAssign: (section: string, ri: number, mi: number, slot: 1 | 2, team: string | null) => Promise<{ error?: string }>;
  onCardClick?: (matchKey: string) => void;
}) {
  const assignedTeams = new Set<string>();
  const r0 = bracket.upper[0] ?? [];
  r0.forEach(m => { if (m.p1) assignedTeams.add(m.p1); if (m.p2) assignedTeams.add(m.p2); });

  return (
    <>
      <TeamPool teams={allTeams} assignedTeams={assignedTeams} isAdmin={isAdmin} />
      <div className="t-surface border t-border rounded-xl p-5 flex flex-col" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div className="flex items-center gap-3 font-['Bebas_Neue'] text-xl tracking-widest t-text mb-6 shrink-0">
          {bracket.type === 'single' ? 'Bracket' : 'Tournament Bracket'}
          <div className="flex gap-2">
            <span className={`text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase ${bracket.type === 'single' ? 'bg-[rgba(232,41,74,0.12)] text-[var(--accent-red)] border-[rgba(232,41,74,0.3)]' : 'bg-[rgba(58,107,255,0.12)] text-[var(--accent)] border-[rgba(58,107,255,0.3)]'}`}>{bracket.type === 'single' ? 'Single Elim' : 'Double Elim'}</span>
            {!isSeeded && (
              <span className="text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase bg-[rgba(34,184,98,0.1)] text-[var(--accent-green)] border-[rgba(34,184,98,0.3)]">
                PENDING DRAW
              </span>
            )}
          </div>
        </div>

        <FitCanvas deps={[bracket, allTeams.length]}>
          {bracket.type === 'single'
            ? <SingleElimCanvas bracket={bracket} isAdmin={isAdmin} onScore={onScore} onUndo={onUndo} isSlotRevealed={isSlotRevealed} allTeams={allTeams} onManualAssign={onManualAssign} onCardClick={onCardClick} />
            : <DoubleElimCanvas bracket={bracket} isAdmin={isAdmin} onScore={onScore} onUndo={onUndo} isSlotRevealed={isSlotRevealed} allTeams={allTeams} onManualAssign={onManualAssign} onCardClick={onCardClick} />
          }
        </FitCanvas>
      </div>

      {isSeeded && bracket.type === 'single' && bracket.thirdPlace && (bracket.thirdPlace.p1 || bracket.thirdPlace.p2) && (() => {
        const tp = bracket.thirdPlace!;
        const third = tp.winner;
        const fourth = third ? (third === tp.p1 ? tp.p2 : tp.p1) : null;
        return (
          <div className="t-surface border t-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-['Bebas_Neue'] text-xl tracking-widest" style={{ color: 'var(--accent-gold)' }}>🥉 3rd Place Match</h3>
              {third && (
                <span className="font-['DM_Mono'] text-[10px] px-2 py-0.5 rounded border" style={{ color: 'var(--accent-gold)', borderColor: 'rgba(224,144,16,0.3)', background: 'rgba(224,144,16,0.08)' }}>🥉 {third}</span>
              )}
              {fourth && (
                <span className="font-['DM_Mono'] text-[10px] px-2 py-0.5 rounded border" style={{ color: 'var(--text-dim)', borderColor: 'rgba(120,120,120,0.3)', background: 'rgba(120,120,120,0.06)' }}>🏅 4th · {fourth}</span>
              )}
            </div>
            <MatchCard
              match={tp}
              matchKey="m_thirdPlace_0_0"
              onScore={(p1w, p2w) => onThirdPlace(p1w, p2w)}
              onUndo={() => onUndo('thirdPlace', 0, 0)}
              isAdmin={isAdmin}
              p1SlotKey="m_thirdPlace_0_0_p1"
              p2SlotKey="m_thirdPlace_0_0_p2"
              isSlotRevealed={isSlotRevealed}
              allTeams={allTeams}
              onManualAssign={(slot, team) => onManualAssign('thirdPlace', 0, 0, slot, team)}
              onCardClick={onCardClick ? () => onCardClick('m_thirdPlace_0_0') : undefined}
            />
          </div>
        );
      })()}
    </>
  );
}

// ─── SingleElimCanvas ─────────────────────────────────────────────────────────
function SingleElimCanvas({ bracket, isAdmin, onScore, onUndo, isSlotRevealed, allTeams, onManualAssign, onCardClick }: {
  bracket: Bracket; isAdmin: boolean;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isSlotRevealed: (slotKey: string) => boolean;
  allTeams: string[];
  onManualAssign: (section: string, ri: number, mi: number, slot: 1 | 2, team: string | null) => Promise<{ error?: string }>;
  onCardClick?: (matchKey: string) => void;
}) {
  const rounds = bracket.upper.filter(r => r.length > 0);
  if (rounds.length === 0) return null;

  const numbers = computeMatchNumbers(bracket);

  const OFFSET_Y = 40;
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
        const isBo5 = round[0]?.format === 'bo5';
        const slotCount = isBo5 ? 5 : isBo3 ? 3 : 1;
        const isFinal = colIdx === rounds.length - 1 && round.length === 1;
        const isSemi = colIdx === rounds.length - 2 && round.length === 2 && rounds.length >= 3;
        const isQuarter = colIdx === rounds.length - 3 && round.length === 4 && rounds.length >= 4;
        const label = isFinal ? 'Final' : isSemi ? 'Semi Final' : isQuarter ? 'Quarter Final' : `Round ${colIdx + 1}`;
        // Last column has no output connector — don't show badge there
        const isLastCol = colIdx === rounds.length - 1;
        return round.map((match, mi) => (
          <div key={`se-card-${colIdx}-${mi}`} style={{ position: 'absolute', top: ubCardTop(colIdx, mi) + OFFSET_Y, left: colIdx * COL_W, width: CARD_W }}>
            {mi === 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, width: CARD_W, paddingBottom: 6 }}>
                <RoundHeader section="upper" ri={colIdx} label={label} matchCount={round.length} slotCount={slotCount} isAdmin={isAdmin} />
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
              allTeams={allTeams}
              onManualAssign={(slot, team) => onManualAssign('upper', colIdx, mi, slot, team)}
              p1Placeholder={feederLabel(numbers, 'upper', colIdx, mi, 1)}
              p2Placeholder={feederLabel(numbers, 'upper', colIdx, mi, 2)}
              onCardClick={onCardClick ? () => onCardClick(`m_upper_${colIdx}_${mi}`) : undefined}
            />
            {/* Match number badge — on the output connector line, just above the wire */}
            {!isLastCol && numbers.upper[colIdx]?.[mi] != null && (
              <MatchNumberBadge matchNumber={numbers.upper[colIdx][mi]} />
            )}
          </div>
        ));
      })}
    </div>
  );
}

// ─── DoubleElimCanvas ─────────────────────────────────────────────────────────
function DoubleElimCanvas({ bracket, isAdmin, onScore, onUndo, isSlotRevealed, allTeams, onManualAssign, onCardClick }: {
  bracket: Bracket; isAdmin: boolean;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isSlotRevealed: (slotKey: string) => boolean;
  allTeams: string[];
  onManualAssign: (section: string, ri: number, mi: number, slot: 1 | 2, team: string | null) => Promise<{ error?: string }>;
  onCardClick?: (matchKey: string) => void;
}) {
  const ubRounds = bracket.upper.filter(r => r.length > 0);
  const lbRounds = (bracket.lower || []).filter(r => r.length > 0);
  const gf = bracket.grandFinal ?? null;
  if (ubRounds.length === 0) return null;

  const numbers = computeMatchNumbers(bracket);

  const HEADER_H = 40;
  const SECTION_GAP = 48;

  const ubH = ubRounds[0].length * colSpacing(0) + CARD_H;
  const lbH = lbRounds.length > 0 ? lbRounds[0].length * colSpacing(0) + CARD_H : 0;
  const canvasH = HEADER_H + ubH + (lbH > 0 ? SECTION_GAP + HEADER_H + lbH : 0) + 40;

  const ubCols = ubRounds.length;
  const lbCols = lbRounds.length;
  const gfColX = ubCols * COL_W;
  const canvasW = Math.max(
    ubCols * COL_W - COL_GAP + (gf ? COL_GAP + CARD_W + 60 : 40),
    lbCols * COL_W - COL_GAP + 40,
  );

  const ubOriginY = HEADER_H;
  const lbOriginY = ubOriginY + ubH + SECTION_GAP + HEADER_H;

  const ubCY = (colIdx: number, mi: number) => ubOriginY + ubCardTop(colIdx, mi) + CARD_H / 2;
  const lbCY = (colIdx: number, mi: number) => lbOriginY + lbCardTop(colIdx, mi) + CARD_H / 2;

  const gfCenterY = ubCY(ubCols - 1, 0);
  const gfTopGF1 = gfCenterY - CARD_H / 2;

  const stroke = 'var(--border-mid)';

  return (
    <div style={{ position: 'relative', width: canvasW, height: canvasH, minWidth: canvasW }}>
      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
        {/* UB connectors */}
        {ubRounds.map((round, colIdx) => {
          if (colIdx === ubRounds.length - 1) return null;
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

        {/* UB Final → GF */}
        {gf && (() => {
          const x1 = (ubCols - 1) * COL_W + CARD_W;
          const y = ubCY(ubCols - 1, 0);
          return <line x1={x1} y1={y} x2={gfColX} y2={y} stroke={stroke} strokeWidth={1.5} />;
        })()}

        {/* LB connectors */}
        {lbRounds.map((round, colIdx) => {
          if (colIdx === lbRounds.length - 1) return null;
          const nextColIdx = colIdx + 1;
          if (colIdx % 2 === 0) {
            return round.map((_, mi) => {
              const x1 = colIdx * COL_W + CARD_W;
              const x2 = nextColIdx * COL_W;
              const y = lbCY(colIdx, mi);
              return <line key={`lb-${colIdx}-${mi}`} x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={1.5} />;
            });
          } else {
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

        {/* LB Final → GF */}
        {gf && lbRounds.length > 0 && (() => {
          const lbFinalColIdx = lbRounds.length - 1;
          const lbFinalX = lbFinalColIdx * COL_W + CARD_W;
          const lbFinalCY = lbCY(lbFinalColIdx, 0);
          const gfP2Y = gfTopGF1 + CARD_H / 2 + 18;
          const midX = lbFinalX + COL_GAP / 2;
          return (
            <path d={`M ${lbFinalX} ${lbFinalCY} H ${midX} V ${gfP2Y} H ${gfColX}`} stroke={stroke} strokeWidth={1.5} fill="none" />
          );
        })()}
      </svg>

      {/* UB section label */}
      <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase font-bold absolute" style={{ top: 0, left: 0, color: 'var(--accent)', opacity: 0.7 }}>Upper Bracket</div>

      {/* UB cards */}
      {ubRounds.map((round, colIdx) => {
        const isBo3 = round[0]?.format === 'bo3';
        const isBo5ub = round[0]?.format === 'bo5';
        const slotCount = isBo5ub ? 5 : isBo3 ? 3 : 1;
        const isFinal = colIdx === ubRounds.length - 1 && round.length === 1;
        const label = isFinal ? 'Upper Final' : `Upper Round ${colIdx + 1}`;
        // UB final feeds into GF — still show badge (has output line)
        return round.map((match, mi) => (
          <div key={`ub-card-${colIdx}-${mi}`} style={{ position: 'absolute', top: ubOriginY + ubCardTop(colIdx, mi), left: colIdx * COL_W, width: CARD_W }}>
            {mi === 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, width: CARD_W, paddingBottom: 6 }}>
                <RoundHeader section="upper" ri={colIdx} label={label} matchCount={round.length} slotCount={slotCount} isAdmin={isAdmin} />
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
              allTeams={allTeams}
              onManualAssign={(slot, team) => onManualAssign('upper', colIdx, mi, slot, team)}
              p1Placeholder={feederLabel(numbers, 'upper', colIdx, mi, 1)}
              p2Placeholder={feederLabel(numbers, 'upper', colIdx, mi, 2)}
              onCardClick={onCardClick ? () => onCardClick(`m_upper_${colIdx}_${mi}`) : undefined}
            />
            {/* Match number badge on output connector line */}
            {numbers.upper[colIdx]?.[mi] != null && (
              <MatchNumberBadge matchNumber={numbers.upper[colIdx][mi]} />
            )}
          </div>
        ));
      })}

      {/* Grand Final column */}
      {gf && (() => {
        const lbFinal = lbRounds.length > 0 ? lbRounds[lbRounds.length - 1][0] : null;
        const lbFinalLoser = lbFinal?.winner ? (lbFinal.winner === lbFinal.p1 ? lbFinal.p2 : lbFinal.p1) : null;
        return (
          <div style={{ position: 'absolute', top: gfTopGF1 - HEADER_H, left: gfColX }}>
            <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase font-bold mb-1.5" style={{ color: 'var(--accent)' }}>Grand Final</div>
            <GrandFinalCards gf={gf} lbFinalLoser={lbFinalLoser} isAdmin={isAdmin} onScore={onScore} onUndo={onUndo} isSlotRevealed={isSlotRevealed} allTeams={allTeams} onManualAssign={onManualAssign} numbers={numbers} onCardClick={onCardClick} />
          </div>
        );
      })()}

      {/* LB section label */}
      {lbRounds.length > 0 && (
        <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase font-bold absolute" style={{ top: lbOriginY - HEADER_H, left: 0, color: 'var(--accent)', opacity: 0.7 }}>Lower Bracket</div>
      )}

      {/* LB cards */}
      {lbRounds.map((round, colIdx) => {
        const isBo3lb = round[0]?.format === 'bo3';
        const isBo5lb = round[0]?.format === 'bo5';
        const slotCountLb = isBo5lb ? 5 : isBo3lb ? 3 : 1;
        const isFinal = colIdx === lbRounds.length - 1;
        const label = isFinal ? 'Lower Final' : `Lower Round ${colIdx + 1}`;
        return round.map((match, mi) => (
          <div key={`lb-card-${colIdx}-${mi}`} style={{ position: 'absolute', top: lbOriginY + lbCardTop(colIdx, mi), left: colIdx * COL_W, width: CARD_W }}>
            {mi === 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, width: CARD_W, paddingBottom: 6 }}>
                <RoundHeader section="lower" ri={colIdx} label={label} matchCount={round.length} slotCount={slotCountLb} isAdmin={isAdmin} />
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
              allTeams={allTeams}
              onManualAssign={(slot, team) => onManualAssign('lower', colIdx, mi, slot, team)}
              p1Placeholder={feederLabel(numbers, 'lower', colIdx, mi, 1)}
              p2Placeholder={feederLabel(numbers, 'lower', colIdx, mi, 2)}
              onCardClick={onCardClick ? () => onCardClick(`m_lower_${colIdx}_${mi}`) : undefined}
            />
            {/* Match number badge on output connector line */}
            {numbers.lower[colIdx]?.[mi] != null && (
              <MatchNumberBadge matchNumber={numbers.lower[colIdx][mi]} />
            )}
          </div>
        ));
      })}
    </div>
  );
}

// ─── GrandFinalCards ─────────────────────────────────────────────────────────
function GrandFinalCards({ gf, lbFinalLoser, isAdmin, onScore, onUndo, isSlotRevealed, allTeams, onManualAssign, numbers, onCardClick }: {
  gf: GrandFinal; lbFinalLoser: string | null; isAdmin: boolean;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isSlotRevealed: (slotKey: string) => boolean;
  allTeams: string[];
  onManualAssign: (section: string, ri: number, mi: number, slot: 1 | 2, team: string | null) => Promise<{ error?: string }>;
  numbers: MatchNumbers;
  onCardClick?: (matchKey: string) => void;
}) {
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
  const champion = gf.winner ?? null;
  const gfLoser = champion ? (champion === gf.p1 ? gf.p2 : gf.p1) : null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-widest mb-1">GF1</div>
        <MatchCard
          match={gf1}
          matchKey="m_gf_0_0"
          onScore={(p1w, p2w) => onScore('gf', 0, 0, p1w, p2w)}
          onUndo={() => onUndo('gf', 0, 0)}
          isAdmin={isAdmin}
          p1SlotKey="m_gf_0_0_p1"
          p2SlotKey="m_gf_0_0_p2"
          isSlotRevealed={isSlotRevealed}
          allTeams={allTeams}
          onManualAssign={(slot, team) => onManualAssign('gf', 0, 0, slot, team)}
          p1Placeholder={feederLabel(numbers, 'gf', 0, 0, 1)}
          p2Placeholder={feederLabel(numbers, 'gf', 0, 0, 2)}
          onCardClick={onCardClick ? () => onCardClick('m_gf_0_0') : undefined}
        />
        {gf.isReset && (
          <div className="mt-1 px-3 py-1 rounded-lg text-center" style={{ background: 'rgba(58,107,255,0.06)', border: '1px solid rgba(58,107,255,0.2)' }}>
            <span className="font-['DM_Mono'] text-[9px] font-bold" style={{ color: 'var(--accent)' }}>🔄 BRACKET RESET — play GF2</span>
          </div>
        )}
      </div>

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
            p1SlotKey="m_gf_0_1_p1"
            p2SlotKey="m_gf_0_1_p2"
            isSlotRevealed={isSlotRevealed}
            allTeams={allTeams}
            onManualAssign={(slot, team) => onManualAssign('gf', 0, 0, slot, team)}
            onCardClick={onCardClick ? () => onCardClick('m_gf_0_1') : undefined}
            />
        </div>
      )}

      {canUndo && (
        <button
          className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] cursor-pointer text-left transition-colors"
          onClick={() => onUndo('gf', 0, 0)}
        >↩ undo last GF result</button>
      )}

      {champion && (
        <div className="rounded-xl px-4 py-3 text-center border" style={{ background: 'rgba(224,144,16,0.06)', borderColor: 'rgba(224,144,16,0.35)', width: CARD_W }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginBottom: 4 }}>
            <span className="trophy-spin" style={{ fontSize: 22 }}>🏆</span>
            <span className="sparkle" style={{ top: -8, left: 14, animationDelay: '0s' }}>✦</span>
            <span className="sparkle" style={{ top: 2, left: 24, animationDelay: '0.4s' }}>✦</span>
            <span className="sparkle" style={{ top: -6, left: 28, animationDelay: '0.8s' }}>✦</span>
          </div>
          <div className="font-['Bebas_Neue'] text-lg tracking-widest" style={{ color: 'var(--accent-gold)' }}>{champion}</div>
          <div className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-widest">🥇 Champion</div>
        </div>
      )}

      {gfLoser && (
        <div className="rounded-xl px-4 py-2 text-center border" style={{ background: 'rgba(180,180,180,0.04)', borderColor: 'rgba(180,180,180,0.2)', width: CARD_W }}>
          <div className="font-['Bebas_Neue'] text-base tracking-widest" style={{ color: 'var(--text)' }}>{gfLoser}</div>
          <div className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-widest">🥈 2nd Place</div>
        </div>
      )}

      {lbFinalLoser && (
        <div className="rounded-xl px-4 py-2 text-center border" style={{ background: 'rgba(180,130,60,0.04)', borderColor: 'rgba(180,130,60,0.2)', width: CARD_W }}>
          <div className="font-['Bebas_Neue'] text-base tracking-widest" style={{ color: 'var(--accent-gold)', opacity: 0.75 }}>{lbFinalLoser}</div>
          <div className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-widest">🥉 3rd Place</div>
        </div>
      )}
    </div>
  );
}
