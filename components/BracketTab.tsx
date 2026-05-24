'use client';

import { useState, useEffect } from 'react';
import { useTourney } from '@/lib/context';
import { parseStageMaps } from '@/lib/utils';
import type { BracketMatch, GrandFinal } from '@/lib/types';

const CARD_W = 210;
const CARD_H = 100; // Strictly locked height to fit map slots!
const COL_GAP = 72;
const COL_W = CARD_W + COL_GAP;

function getSpacing(colIdx: number): number {
  return (CARD_H + 28) * Math.pow(2, colIdx); 
}

function getMatchTop(section: string, colIdx: number, matchIdx: number): number {
  if (colIdx === 0) return matchIdx * getSpacing(0);
  if (section === 'lower' && colIdx % 2 === 1) {
    return getMatchTop(section, colIdx - 1, matchIdx);
  }
  const feederA = matchIdx * 2;
  const feederB = feederA + 1;
  const topA = getMatchTop(section, colIdx - 1, feederA);
  const topB = getMatchTop(section, colIdx - 1, feederB);
  return (topA + topB) / 2;
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────
function PlayerRow({
  player, score, isWinner, isLoser, showScore, canEdit, isBo3, onCommit,
}: {
  player: string | null; score: number; isWinner: boolean; isLoser: boolean;
  showScore: boolean; canEdit?: boolean; isBo3?: boolean;
  onCommit?: (newScore: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    if (!canEdit) return;
    setDraft(String(score));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (isNaN(n) || n < 0) return;
    onCommit?.(n);
  };

  return (
    <div className="flex items-center justify-between px-3 border-b t-border last:border-b-0" style={{ height: 36, background: isWinner ? 'rgba(34,184,98,0.07)' : undefined }}>
      <span className="text-xs font-['DM_Mono'] flex-1 truncate" style={{ color: !player ? 'var(--text-dim)' : isWinner ? 'var(--accent-green)' : isLoser ? 'var(--text-dim)' : 'var(--text)', fontStyle: !player ? 'italic' : undefined, opacity: isLoser ? 0.5 : 1 }}>
        {isWinner && '✓ '}{player ?? (isLoser ? 'BYE' : 'TBD')}
      </span>
      {showScore && (
        editing ? (
          <input autoFocus type="number" min={0} max={isBo3 ? 2 : 1} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} className="w-8 text-center font-['Bebas_Neue'] text-base rounded border bg-transparent focus:outline-none" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} />
        ) : (
          <span className="font-['Bebas_Neue'] text-base ml-2 shrink-0 rounded px-1" style={{ color: isWinner ? 'var(--accent-green)' : 'var(--text-dim)', cursor: canEdit ? 'text' : 'default', outline: canEdit ? '1px dashed var(--border-mid)' : 'none', minWidth: 20, textAlign: 'center' }} onClick={startEdit}>
            {score}
          </span>
        )
      )}
    </div>
  );
}

// ── RoundHeader Drop Zone ─────────────────────────────────────────────────────
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
                if (m) {
                  // FIX: Process sequentially to avoid database overwrite race conditions
                  for (let mi = 0; mi < matchCount; mi++) {
                    await assignStage(`m_${section}_${ri}_${mi}`, m, slotIdx);
                  }
                }
              }}
              title={`Drop to set Map ${slotIdx + 1} for ALL matches in this round`}
            >
              {slotIdx + 1}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── BracketTab ────────────────────────────────────────────────────────────────
export function BracketTab({ spinResults }: { spinResults: string[] }) {
  const { bracket, elimMode, teams, isAdmin, loading, setElimMode, generateBracket, updateScore, undoMatch, updateThirdPlace, resetBracket } = useTourney();
  const [err, setErr] = useState('');
  const [generating, setGenerating] = useState(false);
  const [matchFormat, setMatchFormat] = useState<'bo1' | 'bo3'>('bo1');

  const [pendingElim, setPendingElim] = useState<'single' | 'double' | null>(null);
  const displayElim = pendingElim ?? elimMode;

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

  const handleGenerate = async () => {
    if (!isAdmin || generating) return;
    setErr('');
    setGenerating(true);
    const result = await generateBracket(matchFormat);
    setGenerating(false);
    if (result?.error) setErr(result.error);
  };

  const hasTeams = teams.length >= 2;
  const hasBracket = !!bracket;

  return (
    <div className="flex-1 flex flex-col w-full py-4 gap-4 min-h-0 relative">
      <div>
        <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Bracket</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">{isAdmin ? 'Pick a format · Generate once · Enter scores directly on each match card' : 'View only — admin required to edit'}</p>
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
                    <div className="font-['DM_Mono'] text-xs font-bold t-text">{opt.label}{hasBracket && displayElim === opt.id && (<span className="ml-1.5 font-normal" style={{ color: 'var(--accent-red)' }}>●</span>)}</div>
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
                    <div className="font-['DM_Mono'] text-xs font-bold" style={{ color: matchFormat === opt.id ? 'var(--accent-gold)' : 'var(--text)' }}>{opt.label}{hasBracket && matchFormat === opt.id && (<span className="ml-1.5 font-normal t-dim">●</span>)}</div>
                    <div className="font-['DM_Mono'] text-[10px] t-muted">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {!hasBracket ? (
                <button className="px-4 py-2 font-['DM_Mono'] font-bold rounded-xl text-xs text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap" style={{ background: 'var(--accent-red)' }} onClick={handleGenerate} disabled={!hasTeams || generating}>{generating ? '⏳ Generating…' : '⚡ Generate Bracket'}</button>
              ) : (
                <button className="px-4 py-2 font-['DM_Mono'] text-xs border t-border-mid t-muted t-elevated rounded-xl transition-colors cursor-pointer hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] whitespace-nowrap" onClick={resetBracket}>Reset Bracket</button>
              )}
            </div>
          </div>
          {!hasTeams && <p className="font-['DM_Mono'] text-[11px] mt-2" style={{ color: 'var(--accent-red)' }}>⚠ Form teams first.</p>}
          {hasBracket && <p className="font-['DM_Mono'] text-[10px] t-dim mt-2">⚠ Format locked — reset to change.</p>}
          {err && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-red)' }}>{err}</p>}
        </div>
      )}

      {bracket ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto relative">
          <BracketDisplay onScore={updateScore} onThirdPlace={updateThirdPlace} onUndo={undoMatch} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-['DM_Mono'] text-sm t-dim">{isAdmin ? 'Pick a format and click Generate.' : 'Waiting for admin to generate the bracket.'}</p>
        </div>
      )}

      {/* Floating Map Assignment Sidebar (Visible to all, draggable by Admin) */}
      {hasBracket && spinResults.length > 0 && (
        <div className="absolute bottom-6 right-6 t-surface border t-border rounded-xl shadow-2xl w-56 z-50 flex flex-col max-h-[50vh] animate-in slide-in-from-bottom-4">
          <div className="p-3 border-b t-border font-['Bebas_Neue'] text-lg tracking-widest bg-[var(--bg-elevated)] rounded-t-xl text-[var(--accent-gold)]">
            🎯 Spin Queue
          </div>
          {isAdmin && (
            <div className="p-2 border-b t-border font-['DM_Mono'] text-[9px] t-muted bg-black/10">
              Drag maps into bracket slots
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {spinResults.map((m, i) => (
              <div
                key={i}
                draggable={isAdmin}
                onDragStart={isAdmin ? (e) => e.dataTransfer.setData('text/plain', m) : undefined}
                className={`p-2 flex items-center gap-2 text-sm font-['DM_Mono'] border t-border-mid rounded bg-[var(--bg-surface)] transition-colors truncate ${isAdmin ? 'cursor-grab active:cursor-grabbing hover:border-[var(--accent)]' : 'cursor-default'}`}
              >
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

// ── BracketDisplay ────────────────────────────────────────────────────────────
function BracketDisplay({ onScore, onThirdPlace, onUndo }: {
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onThirdPlace: (p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
}) {
  const { bracket, isAdmin } = useTourney();
  if (!bracket) return null;

  const isSingle = bracket.type === 'single';
  const hasLower = bracket.lower && bracket.lower.some(r => r.length > 0);
  const isBo3 = bracket.upper[0]?.[0]?.format === 'bo3';
  const globalFormat = isBo3 ? 'Best of 3' : 'Best of 1';

  return (
    <>
      <div className="t-surface border t-border rounded-xl p-5 shrink-0">
        <div className="flex items-center gap-3 font-['Bebas_Neue'] text-xl tracking-widest t-text mb-6">
          {isSingle ? 'Bracket' : 'Upper Bracket'}
          <div className="flex gap-2">
            <span className={`text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase ${isSingle ? 'bg-[rgba(232,41,74,0.12)] text-[var(--accent-red)] border-[rgba(232,41,74,0.3)]' : 'bg-[rgba(58,107,255,0.12)] text-[var(--accent)] border-[rgba(58,107,255,0.3)]'}`}>
              {isSingle ? 'Single Elim' : 'Double Elim'}
            </span>
            <span className="text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase bg-[rgba(224,144,16,0.1)] text-[var(--accent-gold)] border-[rgba(224,144,16,0.3)]">
              {globalFormat}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-visible pb-4">
          <BracketGrid rounds={bracket.upper} section="upper" type={bracket.type} gf={bracket.grandFinal} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
        </div>
      </div>

      {isSingle && bracket.thirdPlace && (bracket.thirdPlace.p1 || bracket.thirdPlace.p2) && (
        <div className="t-surface border t-border rounded-xl p-5 shrink-0">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4" style={{ color: 'var(--accent-gold)' }}>🥉 3rd Place Match</h3>
          <ThirdPlaceDisplay match={bracket.thirdPlace} onScore={onThirdPlace} onUndo={() => onUndo('thirdPlace', 0, 0)} isAdmin={isAdmin} />
        </div>
      )}

      {!isSingle && hasLower && (
        <div className="t-surface border t-border rounded-xl p-5 shrink-0">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-6" style={{ color: 'var(--accent)' }}>Lower Bracket</h3>
          <div className="overflow-x-auto overflow-y-visible pb-4">
            <BracketGrid rounds={bracket.lower!} section="lower" type={bracket.type} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
          </div>
        </div>
      )}

      {bracket.champion && (
        <div className="rounded-2xl p-7 text-center border-2 border-[var(--accent-gold)] bg-gradient-to-br from-[rgba(224,144,16,0.10)] to-[rgba(232,41,74,0.07)] mt-4 shrink-0">
          <div className="text-5xl mb-2">🏆</div>
          <h2 className="font-['Bebas_Neue'] text-5xl tracking-widest" style={{ color: 'var(--accent-gold)' }}>{bracket.champion}</h2>
          <p className="font-['DM_Mono'] text-xs mt-2 t-muted">Tournament Champion</p>
          {bracket.thirdPlace?.winner && (<p className="font-['DM_Mono'] text-xs mt-1 t-dim">🥉 3rd Place: {bracket.thirdPlace.winner}</p>)}
        </div>
      )}
    </>
  );
}

// ── BracketGrid ───────────────────────────────────────────────────────────────
function BracketGrid({ rounds, section, type, gf, onScore, onUndo, isAdmin }: {
  rounds: BracketMatch[][]; section: string; type: 'single' | 'double'; gf?: GrandFinal | null;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>; isAdmin: boolean;
}) {
  const validRounds = rounds.map((r, i) => ({ round: r, ri: i })).filter(({ round }) => round.length > 0);
  if (validRounds.length === 0) return null;

  const firstRound = validRounds[0];
  const hasGF = type === 'double' && section === 'upper' && gf && (gf.p1 || gf.p2);
  
  let offsetY = 40; 
  let extraHeight = 0;
  if (hasGF) {
    const finalY = getMatchTop(section, validRounds.length - 1, 0) + CARD_H / 2;
    const gfHalfHeight = gf.isReset ? 140 : 50; 
    if (finalY < gfHalfHeight) offsetY += (gfHalfHeight - finalY);
    extraHeight = Math.max(0, (gfHalfHeight * 2) - CARD_H);
  }

  const totalHeight = firstRound.round.length * getSpacing(0) + CARD_H + offsetY + extraHeight + 20;
  const gfWidth = CARD_W;
  const totalWidth = validRounds.length * COL_W - COL_GAP + (hasGF ? COL_GAP + gfWidth + 40 : 40);
  const stroke = 'var(--border-mid)';

  const cardCentreY = (colIdx: number, mi: number) => getMatchTop(section, colIdx, mi) + CARD_H / 2 + offsetY;

  return (
    <div style={{ position: 'relative', width: totalWidth, height: totalHeight, minWidth: totalWidth }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: totalHeight, overflow: 'visible', pointerEvents: 'none' }}>
        {validRounds.map(({ round }, colIdx) => {
          if (colIdx === validRounds.length - 1) return null;
          const nextColIdx = colIdx + 1;
          return round.map((_, mi) => {
            const cardRight = colIdx * COL_W + CARD_W;
            const nextCardLeft = nextColIdx * COL_W;

            if (section === 'lower' && colIdx % 2 === 0) {
              const myCentreY = cardCentreY(colIdx, mi);
              return (
                <g key={`conn-${colIdx}-${mi}`}>
                  <line x1={cardRight} y1={myCentreY} x2={nextCardLeft} y2={myCentreY} stroke={stroke} strokeWidth={1.5} />
                </g>
              );
            } else {
              if (mi % 2 !== 0) return null;
              const partnerMi = mi + 1;
              const midX = cardRight + COL_GAP / 2;
              const myCentreY = cardCentreY(colIdx, mi);
              const partnerCentreY = cardCentreY(colIdx, partnerMi);
              const targetCentreY = cardCentreY(nextColIdx, Math.floor(mi / 2));
              return (
                <g key={`conn-${colIdx}-${mi}`}>
                  <line x1={cardRight} y1={myCentreY} x2={midX} y2={myCentreY} stroke={stroke} strokeWidth={1.5} />
                  <line x1={cardRight} y1={partnerCentreY} x2={midX} y2={partnerCentreY} stroke={stroke} strokeWidth={1.5} />
                  <line x1={midX} y1={myCentreY} x2={midX} y2={partnerCentreY} stroke={stroke} strokeWidth={1.5} />
                  <line x1={midX} y1={targetCentreY} x2={nextCardLeft} y2={targetCentreY} stroke={stroke} strokeWidth={1.5} />
                </g>
              );
            }
          });
        })}
        {(() => {
          const lastColIdx = validRounds.length - 1;
          if (validRounds[lastColIdx].round.length !== 1) return null;
          const cardRight = lastColIdx * COL_W + CARD_W;
          const centreY = cardCentreY(lastColIdx, 0);
          const lineLen = hasGF ? COL_GAP : 20;
          return <line x1={cardRight} y1={centreY} x2={cardRight + lineLen} y2={centreY} stroke={stroke} strokeWidth={1.5} />;
        })()}
      </svg>

      {validRounds.map(({ round, ri }, colIdx) => {
        const isFinalCol = colIdx === validRounds.length - 1 && round.length === 1;
        const label = isFinalCol 
          ? (section === 'upper' ? (type === 'double' ? 'Upper Final' : 'Final') : 'Lower Final') 
          : (section === 'upper' ? `Round ${ri + 1}` : `Lower R${ri + 1}`);

        const isRoundBo3 = round[0]?.format === 'bo3';

        return round.map((match, mi) => {
          const top = getMatchTop(section, colIdx, mi) + offsetY;
          const left = colIdx * COL_W;
          return (
            <div key={`card-${colIdx}-${mi}`} style={{ position: 'absolute', top, left, width: CARD_W }}>
              {mi === 0 && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, width: CARD_W, paddingBottom: 6 }}>
                  <RoundHeader section={section} ri={ri} label={label} matchCount={round.length} isBo3={isRoundBo3} isAdmin={isAdmin} />
                </div>
              )}
              <MatchCard match={match} section={section} ri={ri} mi={mi} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
            </div>
          );
        });
      })}

      {hasGF && (
        <div style={{ position: 'absolute', top: cardCentreY(validRounds.length - 1, 0), left: validRounds.length * COL_W, transform: 'translateY(-50%)', width: CARD_W }}>
           <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase text-center mb-1.5" style={{ color: 'var(--accent)' }}>Grand Final</div>
           <GrandFinalDisplay gf={gf} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}

// ── MatchCard ─────────────────────────────────────────────────────────────────
function MatchCard({ match, section, ri, mi, onScore, onUndo, isAdmin }: {
  match: BracketMatch; section: string; ri: number; mi: number; 
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>; isAdmin: boolean;
}) {
  const { stageMaps, assignStage, clearStage } = useTourney();
  const [s1, setS1] = useState(match.score1);
  const [s2, setS2] = useState(match.score2);

  useEffect(() => { setS1(match.score1); setS2(match.score2); }, [match.score1, match.score2]);

  const isBo3 = match.format === 'bo3';
  const isDone = !!match.winner;
  const canEdit = isAdmin && !!match.p1 && !!match.p2 && !isDone;
  const canUndo = isAdmin && isDone;
  const isModified = s1 !== match.score1 || s2 !== match.score2;

  const handleSave = () => onScore(section, ri, mi, s1, s2);
  const handleCancel = () => { setS1(match.score1); setS2(match.score2); };

  const matchKey = `m_${section}_${ri}_${mi}`;
  const matchMaps = parseStageMaps(stageMaps[matchKey] || '');
  const slotCount = isBo3 ? 3 : 1;

  return (
    <div style={{ position: 'relative' }}>
      <div className="t-elevated border t-border rounded-xl overflow-hidden flex flex-col" style={{ width: CARD_W, height: CARD_H }}>
        <PlayerRow player={match.p1} score={isDone ? match.score1 : s1} isWinner={isDone && match.winner === match.p1} isLoser={isDone && match.winner !== match.p1} showScore={isDone || !!(match.p1 && match.p2)} canEdit={canEdit} isBo3={isBo3} onCommit={n => setS1(n)} />
        <PlayerRow player={match.p2} score={isDone ? match.score2 : s2} isWinner={isDone && match.winner === match.p2} isLoser={isDone && match.winner !== match.p2} showScore={isDone || !!(match.p1 && match.p2)} canEdit={canEdit} isBo3={isBo3} onCommit={n => setS2(n)} />
        
        {/* MAP SLOTS */}
        <div className="flex h-7 border-t t-border bg-[var(--bg-surface)] shrink-0 mt-auto">
          {Array.from({ length: slotCount }).map((_, slotIdx) => {
            const map = matchMaps[slotIdx];
            return (
              <div
                key={slotIdx}
                className="flex-1 flex items-center justify-center font-['DM_Mono'] text-[9px] border-r t-border last:border-r-0 relative group transition-colors"
                style={{ 
                  background: map ? 'rgba(58,107,255,0.04)' : undefined, 
                  color: map ? 'var(--accent)' : 'var(--text-dim)'
                }}
                onDragOver={isAdmin ? (e) => e.preventDefault() : undefined}
                onDrop={isAdmin ? async (e) => {
                  e.preventDefault();
                  const m = e.dataTransfer.getData('text/plain');
                  if (m) await assignStage(matchKey, m, slotIdx);
                } : undefined}
              >
                {map ? (
                  <>
                    <span className="truncate px-1 max-w-[85%]">{map}</span>
                    {isAdmin && (
                      <button 
                        onClick={() => clearStage(matchKey, slotIdx)} 
                        className="absolute right-1 hidden group-hover:flex w-4 h-4 items-center justify-center bg-black/60 rounded-full text-[var(--accent-red)] transition-opacity"
                        title="Clear map"
                      >
                        ✕
                      </button>
                    )}
                  </>
                ) : (
                  <span className="opacity-40">{isBo3 ? `Map ${slotIdx + 1}` : 'Drop Map'}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isModified && (
        <div className="flex flex-col gap-1.5" style={{ position: 'absolute', top: '50%', left: CARD_W + 6, transform: 'translateY(-50%)' }}>
          <button title="Save Score" className="font-['DM_Mono'] text-[10px] font-bold text-[var(--accent-green)] hover:brightness-125 transition-all cursor-pointer whitespace-nowrap" onClick={handleSave}>✓ SAVE</button>
          <button title="Cancel Edit" className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] transition-all cursor-pointer whitespace-nowrap" onClick={handleCancel}>✕ CANCEL</button>
        </div>
      )}

      {canUndo && (
        <button title="Undo this result" className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] transition-colors cursor-pointer" style={{ position: 'absolute', top: '50%', left: CARD_W + 6, transform: 'translateY(-50%)', whiteSpace: 'nowrap' }} onClick={() => onUndo(section, ri, mi)}>↩ UNDO</button>
      )}
    </div>
  );
}

// ── ThirdPlaceDisplay ─────────────────────────────────────────────────────────
function ThirdPlaceDisplay({ match, onScore, onUndo, isAdmin }: {
  match: BracketMatch;
  onScore: (p1wins: number, p2wins: number) => Promise<void>;
  onUndo: () => Promise<void>; isAdmin: boolean;
}) {
  const { stageMaps, assignStage, clearStage } = useTourney();
  const [s1, setS1] = useState(match.score1);
  const [s2, setS2] = useState(match.score2);

  useEffect(() => { setS1(match.score1); setS2(match.score2); }, [match.score1, match.score2]);

  const isBo3 = match.format === 'bo3';
  const isDone = !!match.winner;
  const canEdit = isAdmin && !!match.p1 && !!match.p2 && !isDone;
  const canUndo = isAdmin && isDone;
  const isModified = s1 !== match.score1 || s2 !== match.score2;

  const handleSave = () => onScore(s1, s2);
  const handleCancel = () => { setS1(match.score1); setS2(match.score2); };

  const matchKey = `m_thirdPlace_0_0`;
  const matchMaps = parseStageMaps(stageMaps[matchKey] || '');
  const slotCount = isBo3 ? 3 : 1;

  return (
    <div style={{ position: 'relative', width: 'fit-content' }}>
      <div className="t-elevated border t-border rounded-xl overflow-hidden flex flex-col" style={{ width: CARD_W, height: CARD_H }}>
        <PlayerRow player={match.p1} score={isDone ? match.score1 : s1} isWinner={isDone && match.winner === match.p1} isLoser={isDone && match.winner !== match.p1} showScore={isDone || !!(match.p1 && match.p2)} canEdit={canEdit} isBo3={isBo3} onCommit={n => setS1(n)} />
        <PlayerRow player={match.p2} score={isDone ? match.score2 : s2} isWinner={isDone && match.winner === match.p2} isLoser={isDone && match.winner !== match.p2} showScore={isDone || !!(match.p1 && match.p2)} canEdit={canEdit} isBo3={isBo3} onCommit={n => setS2(n)} />
        <div className="flex h-7 border-t t-border bg-[var(--bg-surface)] shrink-0 mt-auto">
          {Array.from({ length: slotCount }).map((_, slotIdx) => {
            const map = matchMaps[slotIdx];
            return (
              <div
                key={slotIdx}
                className="flex-1 flex items-center justify-center font-['DM_Mono'] text-[9px] border-r t-border last:border-r-0 relative group transition-colors"
                style={{ background: map ? 'rgba(58,107,255,0.04)' : undefined, color: map ? 'var(--accent)' : 'var(--text-dim)' }}
                onDragOver={isAdmin ? (e) => e.preventDefault() : undefined}
                onDrop={isAdmin ? async (e) => {
                  e.preventDefault();
                  const m = e.dataTransfer.getData('text/plain');
                  if (m) await assignStage(matchKey, m, slotIdx);
                } : undefined}
              >
                {map ? (
                  <>
                    <span className="truncate px-1 max-w-[85%]">{map}</span>
                    {isAdmin && (
                      <button onClick={() => clearStage(matchKey, slotIdx)} className="absolute right-1 hidden group-hover:flex w-4 h-4 items-center justify-center bg-black/60 rounded-full text-[var(--accent-red)] transition-opacity">✕</button>
                    )}
                  </>
                ) : (
                  <span className="opacity-40">{isBo3 ? `Map ${slotIdx + 1}` : 'Drop Map'}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isModified && (
        <div className="flex flex-col gap-1.5" style={{ position: 'absolute', top: '50%', left: CARD_W + 6, transform: 'translateY(-50%)' }}>
          <button title="Save Score" className="font-['DM_Mono'] text-[10px] font-bold text-[var(--accent-green)] hover:brightness-125 transition-all cursor-pointer whitespace-nowrap" onClick={handleSave}>✓ SAVE</button>
          <button title="Cancel Edit" className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] transition-all cursor-pointer whitespace-nowrap" onClick={handleCancel}>✕ CANCEL</button>
        </div>
      )}

      {canUndo && (
        <button title="Undo this result" className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] transition-colors cursor-pointer" style={{ position: 'absolute', top: '50%', left: CARD_W + 6, transform: 'translateY(-50%)', whiteSpace: 'nowrap' }} onClick={onUndo}>↩ UNDO</button>
      )}
    </div>
  );
}

// ── GrandFinalDisplay ─────────────────────────────────────────────────────────
function GrandFinalDisplay({ gf, onScore, onUndo, isAdmin }: {
  gf: GrandFinal;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>; isAdmin: boolean;
}) {
  const { stageMaps, assignStage, clearStage } = useTourney();
  const isBo3 = gf.format === 'bo3';
  const slotCount = isBo3 ? 3 : 1;
  
  const [gf1s1, setGf1s1] = useState(gf.score1);
  const [gf1s2, setGf1s2] = useState(gf.score2);
  useEffect(() => { setGf1s1(gf.score1); setGf1s2(gf.score2); }, [gf.score1, gf.score2]);

  const [gf2s1, setGf2s1] = useState(gf.resetScore1 ?? 0);
  const [gf2s2, setGf2s2] = useState(gf.resetScore2 ?? 0);
  useEffect(() => { setGf2s1(gf.resetScore1 ?? 0); setGf2s2(gf.resetScore2 ?? 0); }, [gf.resetScore1, gf.resetScore2]);

  const gf1Done = !!(gf.winner || gf.isReset);
  const gf2Done = !!(gf.isReset && gf.winner);
  const canEditGf1 = isAdmin && gf.p1 && gf.p2 && !gf1Done;
  const canEditGf2 = isAdmin && gf.isReset && !gf.winner;
  const canUndo = isAdmin && (gf1Done || gf2Done);

  const gf1Modified = gf1s1 !== gf.score1 || gf1s2 !== gf.score2;
  const gf2Modified = gf2s1 !== (gf.resetScore1 ?? 0) || gf2s2 !== (gf.resetScore2 ?? 0);

  const matchKeyGF1 = `m_gf_0_0`;
  const matchKeyGF2 = `m_gf_0_1`;
  const gf1Maps = parseStageMaps(stageMaps[matchKeyGF1] || '');
  const gf2Maps = parseStageMaps(stageMaps[matchKeyGF2] || '');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-['DM_Mono'] text-[10px] t-dim uppercase tracking-widest">GF1</p>
        <div style={{ position: 'relative' }}>
          <div className="t-elevated border t-border rounded-xl overflow-hidden flex flex-col" style={{ width: CARD_W, minHeight: CARD_H }}>
            <PlayerRow player={gf.p1} score={gf1Done ? gf.score1 : gf1s1} isWinner={!gf.isReset && !!gf.winner && gf.winner === gf.p1} isLoser={!gf.isReset && !!gf.winner && gf.winner !== gf.p1} showScore={gf1Done || !!(gf.p1 && gf.p2)} canEdit={!!canEditGf1} isBo3={isBo3} onCommit={n => setGf1s1(n)} />
            <PlayerRow player={gf.p2} score={gf1Done ? gf.score2 : gf1s2} isWinner={!gf.isReset && !!gf.winner && gf.winner === gf.p2} isLoser={!gf.isReset && !!gf.winner && gf.winner !== gf.p2} showScore={gf1Done || !!(gf.p1 && gf.p2)} canEdit={!!canEditGf1} isBo3={isBo3} onCommit={n => setGf1s2(n)} />
            
            {/* GF1 MAP SLOTS */}
            <div className="flex h-7 border-t t-border bg-[var(--bg-surface)] shrink-0 mt-auto">
              {Array.from({ length: slotCount }).map((_, slotIdx) => {
                const map = gf1Maps[slotIdx];
                return (
                  <div
                    key={slotIdx}
                    className="flex-1 flex items-center justify-center font-['DM_Mono'] text-[9px] border-r t-border last:border-r-0 relative group transition-colors"
                    style={{ background: map ? 'rgba(58,107,255,0.04)' : undefined, color: map ? 'var(--accent)' : 'var(--text-dim)' }}
                    onDragOver={isAdmin ? (e) => e.preventDefault() : undefined}
                    onDrop={isAdmin ? async (e) => {
                      e.preventDefault();
                      const m = e.dataTransfer.getData('text/plain');
                      if (m) await assignStage(matchKeyGF1, m, slotIdx);
                    } : undefined}
                  >
                    {map ? (
                      <>
                        <span className="truncate px-1 max-w-[85%]">{map}</span>
                        {isAdmin && (
                          <button onClick={() => clearStage(matchKeyGF1, slotIdx)} className="absolute right-1 hidden group-hover:flex w-4 h-4 items-center justify-center bg-black/60 rounded-full text-[var(--accent-red)] transition-opacity">✕</button>
                        )}
                      </>
                    ) : (
                      <span className="opacity-40">{isBo3 ? `Map ${slotIdx + 1}` : 'Drop Map'}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {gf.isReset && (
              <div className="px-3 py-1.5 border-t t-border text-center shrink-0" style={{ background: 'rgba(58,107,255,0.06)' }}>
                <span className="font-['DM_Mono'] text-[9px] font-bold" style={{ color: 'var(--accent)' }}>🔄 BRACKET RESET — play GF2</span>
              </div>
            )}
          </div>
          {gf1Modified && (
            <div className="flex flex-col gap-1.5" style={{ position: 'absolute', top: '50%', left: CARD_W + 6, transform: 'translateY(-50%)' }}>
              <button title="Save Score" className="font-['DM_Mono'] text-[10px] font-bold text-[var(--accent-green)] hover:brightness-125 transition-all cursor-pointer whitespace-nowrap" onClick={() => onScore('gf', 0, 0, gf1s1, gf1s2)}>✓ SAVE</button>
              <button title="Cancel Edit" className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] transition-all cursor-pointer whitespace-nowrap" onClick={() => { setGf1s1(gf.score1); setGf1s2(gf.score2); }}>✕ CANCEL</button>
            </div>
          )}
        </div>
      </div>

      {gf.isReset && (
        <div className="flex flex-col gap-1">
          <p className="font-['DM_Mono'] text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>GF2 — Reset Match</p>
          <div style={{ position: 'relative' }}>
            <div className="t-elevated border-2 rounded-xl overflow-hidden flex flex-col" style={{ width: CARD_W, borderColor: 'var(--accent)', height: CARD_H }}>
              <PlayerRow player={gf.p1} score={gf2Done ? (gf.resetScore1 ?? 0) : gf2s1} isWinner={gf2Done && gf.winner === gf.p1} isLoser={gf2Done && gf.winner !== gf.p1} showScore={gf2Done || !!(gf.p1 && gf.p2)} canEdit={!!canEditGf2} isBo3={isBo3} onCommit={n => setGf2s1(n)} />
              <PlayerRow player={gf.p2} score={gf2Done ? (gf.resetScore2 ?? 0) : gf2s2} isWinner={gf2Done && gf.winner === gf.p2} isLoser={gf2Done && gf.winner !== gf.p2} showScore={gf2Done || !!(gf.p1 && gf.p2)} canEdit={!!canEditGf2} isBo3={isBo3} onCommit={n => setGf2s2(n)} />
              
              {/* GF2 MAP SLOTS */}
              <div className="flex h-7 border-t t-border bg-[var(--bg-surface)] shrink-0 mt-auto">
                {Array.from({ length: slotCount }).map((_, slotIdx) => {
                  const map = gf2Maps[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      className="flex-1 flex items-center justify-center font-['DM_Mono'] text-[9px] border-r t-border last:border-r-0 relative group transition-colors"
                      style={{ background: map ? 'rgba(58,107,255,0.04)' : undefined, color: map ? 'var(--accent)' : 'var(--text-dim)' }}
                      onDragOver={isAdmin ? (e) => e.preventDefault() : undefined}
                      onDrop={isAdmin ? async (e) => {
                        e.preventDefault();
                        const m = e.dataTransfer.getData('text/plain');
                        if (m) await assignStage(matchKeyGF2, m, slotIdx);
                      } : undefined}
                    >
                      {map ? (
                        <>
                          <span className="truncate px-1 max-w-[85%]">{map}</span>
                          {isAdmin && (
                            <button onClick={() => clearStage(matchKeyGF2, slotIdx)} className="absolute right-1 hidden group-hover:flex w-4 h-4 items-center justify-center bg-black/60 rounded-full text-[var(--accent-red)] transition-opacity">✕</button>
                          )}
                        </>
                      ) : (
                        <span className="opacity-40">{isBo3 ? `Map ${slotIdx + 1}` : 'Drop Map'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {gf2Modified && (
              <div className="flex flex-col gap-1.5" style={{ position: 'absolute', top: '50%', left: CARD_W + 6, transform: 'translateY(-50%)' }}>
                <button title="Save Score" className="font-['DM_Mono'] text-[10px] font-bold text-[var(--accent-green)] hover:brightness-125 transition-all cursor-pointer whitespace-nowrap" onClick={() => onScore('gf', 0, 0, gf2s1, gf2s2)}>✓ SAVE</button>
                <button title="Cancel Edit" className="font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] transition-all cursor-pointer whitespace-nowrap" onClick={() => { setGf2s1(gf.resetScore1 ?? 0); setGf2s2(gf.resetScore2 ?? 0); }}>✕ CANCEL</button>
              </div>
            )}
          </div>
        </div>
      )}

      {canUndo && (
        <button className="font-['DM_Mono'] text-[10px] t-dim hover:text-[var(--accent-red)] transition-colors cursor-pointer text-left mt-2" onClick={() => onUndo('gf', 0, 0)}>↩ undo last GF result</button>
      )}
    </div>
  );
}