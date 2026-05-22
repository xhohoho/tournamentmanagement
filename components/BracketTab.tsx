'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';
import { parseStageMaps } from '@/lib/utils';
import type { BracketMatch, GrandFinal } from '@/lib/types';

const CARD_W = 192;
const CARD_H = 72;
const COL_GAP = 56;
const COL_W = CARD_W + COL_GAP;

function getSpacing(colIdx: number): number {
  return (CARD_H + 16) * Math.pow(2, colIdx);
}

function getMatchTop(colIdx: number, matchIdx: number): number {
  if (colIdx === 0) return matchIdx * getSpacing(0);
  const feederA = matchIdx * 2;
  const feederB = feederA + 1;
  const topA = getMatchTop(colIdx - 1, feederA) + CARD_H / 2;
  const topB = getMatchTop(colIdx - 1, feederB) + CARD_H / 2;
  return (topA + topB) / 2 - CARD_H / 2;
}

// ── ScoreInput — inline score entry row for admin ────────────────────────────
interface ScoreInputProps {
  isBo3: boolean;
  p1: string | null;
  p2: string | null;
  onScore: (s1: number, s2: number) => void;
}
function ScoreInput({ isBo3, p1, p2, onScore }: ScoreInputProps) {
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [err, setErr] = useState('');

  const submit = () => {
    const n1 = parseInt(s1, 10);
    const n2 = parseInt(s2, 10);
    if (isNaN(n1) || isNaN(n2) || n1 < 0 || n2 < 0) {
      setErr('Enter valid scores');
      return;
    }
    if (isBo3) {
      // BO3: winner must reach 2; only valid results are 2-0, 2-1, 0-2, 1-2
      const valid = (n1 === 2 && (n2 === 0 || n2 === 1)) || (n2 === 2 && (n1 === 0 || n1 === 1));
      if (!valid) { setErr('BO3: valid scores are 2-0, 2-1, 0-2, 1-2'); return; }
    } else {
      // BO1: exactly one team wins, other gets 0
      if (!((n1 === 1 && n2 === 0) || (n1 === 0 && n2 === 1))) {
        setErr('BO1: enter 1-0 or 0-1'); return;
      }
    }
    setErr('');
    onScore(n1, n2);
    setS1(''); setS2('');
  };

  return (
    <div className="flex flex-col gap-1 px-3 py-2 border-t t-border" style={{ background: 'var(--bg-hover)' }}>
      <div className="flex items-center gap-1.5">
        <span className="font-['DM_Mono'] text-[9px] t-dim truncate flex-1">{p1 ?? 'P1'}</span>
        <input
          type="number" min={0} max={isBo3 ? 2 : 1}
          value={s1}
          onChange={e => { setS1(e.target.value); setErr(''); }}
          className="w-10 text-center font-['DM_Mono'] text-xs rounded border t-border bg-transparent t-text focus:outline-none"
          placeholder="0"
          onClick={e => e.stopPropagation()}
        />
        <span className="font-['DM_Mono'] text-[10px] t-dim">:</span>
        <input
          type="number" min={0} max={isBo3 ? 2 : 1}
          value={s2}
          onChange={e => { setS2(e.target.value); setErr(''); }}
          className="w-10 text-center font-['DM_Mono'] text-xs rounded border t-border bg-transparent t-text focus:outline-none"
          placeholder="0"
          onClick={e => e.stopPropagation()}
        />
        <span className="font-['DM_Mono'] text-[9px] t-dim truncate flex-1 text-right">{p2 ?? 'P2'}</span>
        <button
          className="px-2 py-0.5 rounded font-['DM_Mono'] text-[9px] font-bold cursor-pointer"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onClick={e => { e.stopPropagation(); submit(); }}
        >OK</button>
      </div>
      {err && <p className="font-['DM_Mono'] text-[9px]" style={{ color: 'var(--accent-red)' }}>{err}</p>}
    </div>
  );
}

// ── PlayerRow ─────────────────────────────────────────────────────────────────
function PlayerRow({ player, score, isWinner, isLoser, showScore }: {
  player: string | null;
  score: number;
  isWinner: boolean;
  isLoser: boolean;
  showScore: boolean;
}) {
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
        {isWinner && '✓ '}{player ?? (isLoser ? 'TBD' : 'BYE')}
      </span>
      {showScore && (
        <span className="font-['Bebas_Neue'] text-base ml-2 shrink-0" style={{ color: isWinner ? 'var(--accent-green)' : 'var(--text-dim)' }}>
          {score}
        </span>
      )}
    </div>
  );
}

// ── BracketTab ────────────────────────────────────────────────────────────────
export function BracketTab() {
  const { bracket, elimMode, teams, isAdmin, loading, setElimMode, generateBracket, updateScore, undoMatch, updateThirdPlace, resetBracket } = useTourney();
  const [err, setErr] = useState('');
  const [generating, setGenerating] = useState(false);
  const [matchFormat, setMatchFormat] = useState<'bo1' | 'bo3'>('bo1');

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
    <div className="flex-1 flex flex-col w-full py-4 gap-4 min-h-0">
      <div>
        <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Bracket</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">
          {isAdmin ? 'Pick a format · Generate once · Click a match to enter the score' : 'View only — admin required to edit'}
        </p>
      </div>

      {isAdmin && (
        <div className="t-surface border t-border rounded-2xl p-4 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-['Bebas_Neue'] text-base tracking-widest t-text shrink-0">Format</span>

            <div className="flex gap-2">
              {[
                { id: 'single', icon: '⚔️', label: 'Single Elim', desc: 'One loss = out' },
                { id: 'double', icon: '🛡️', label: 'Double Elim', desc: 'Two losses = out' },
              ].map(opt => (
                <div
                  key={opt.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all select-none"
                  style={{
                    borderColor: elimMode === opt.id ? 'var(--accent-red)' : 'var(--border)',
                    background: elimMode === opt.id ? 'rgba(232,41,74,0.06)' : 'var(--bg-elevated)',
                    cursor: hasBracket ? 'not-allowed' : 'pointer',
                    opacity: hasBracket && elimMode !== opt.id ? 0.45 : 1,
                  }}
                  onClick={() => !hasBracket && setElimMode(opt.id as 'single' | 'double')}
                >
                  <span className="text-base shrink-0">{opt.icon}</span>
                  <div>
                    <div className="font-['DM_Mono'] text-xs font-bold t-text">
                      {opt.label}
                      {hasBracket && elimMode === opt.id && (
                        <span className="ml-1.5 font-normal" style={{ color: 'var(--accent-red)' }}>●</span>
                      )}
                    </div>
                    <div className="font-['DM_Mono'] text-[10px] t-muted">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-8 w-px" style={{ background: 'var(--border-mid)' }} />

            <div className="flex gap-2">
              {[
                { id: 'bo1', label: 'BO1', desc: 'Best of 1' },
                { id: 'bo3', label: 'BO3', desc: 'Best of 3' },
              ].map(opt => (
                <div
                  key={opt.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all select-none"
                  style={{
                    borderColor: matchFormat === opt.id ? 'var(--accent-gold)' : 'var(--border)',
                    background: matchFormat === opt.id ? 'rgba(224,144,16,0.07)' : 'var(--bg-elevated)',
                    cursor: hasBracket ? 'not-allowed' : 'pointer',
                    opacity: hasBracket && matchFormat !== opt.id ? 0.45 : 1,
                  }}
                  onClick={() => !hasBracket && setMatchFormat(opt.id as 'bo1' | 'bo3')}
                >
                  <div>
                    <div className="font-['DM_Mono'] text-xs font-bold" style={{ color: matchFormat === opt.id ? 'var(--accent-gold)' : 'var(--text)' }}>
                      {opt.label}
                      {hasBracket && matchFormat === opt.id && (
                        <span className="ml-1.5 font-normal t-dim">●</span>
                      )}
                    </div>
                    <div className="font-['DM_Mono'] text-[10px] t-muted">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              {!hasBracket ? (
                <button
                  className="px-4 py-2 font-['DM_Mono'] font-bold rounded-xl text-xs text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  style={{ background: 'var(--accent-red)' }}
                  onClick={handleGenerate}
                  disabled={!hasTeams || generating}
                >
                  {generating ? '⏳ Generating…' : '⚡ Generate Bracket'}
                </button>
              ) : (
                <button
                  className="px-4 py-2 font-['DM_Mono'] text-xs border t-border-mid t-muted t-elevated rounded-xl transition-colors cursor-pointer hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] whitespace-nowrap"
                  onClick={resetBracket}
                >
                  Reset Bracket
                </button>
              )}
            </div>
          </div>
          {!hasTeams && <p className="font-['DM_Mono'] text-[11px] mt-2" style={{ color: 'var(--accent-red)' }}>⚠ Form teams first.</p>}
          {hasBracket && <p className="font-['DM_Mono'] text-[10px] t-dim mt-2">⚠ Format locked — reset to change.</p>}
          {err && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-red)' }}>{err}</p>}
        </div>
      )}

      {bracket ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <BracketDisplay onScore={updateScore} onThirdPlace={updateThirdPlace} onUndo={undoMatch} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-['DM_Mono'] text-sm t-dim">
            {isAdmin ? 'Pick a format and click Generate.' : 'Waiting for admin to generate the bracket.'}
          </p>
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
  const { bracket, stageMaps, isAdmin } = useTourney();
  if (!bracket) return null;

  const isSingle = bracket.type === 'single';
  const hasLower = bracket.lower && bracket.lower.some(r => r.length > 0);

  return (
    <>
      <div className="t-surface border t-border rounded-xl p-5">
        <div className="flex items-center gap-3 font-['Bebas_Neue'] text-xl tracking-widest t-text mb-6">
          {isSingle ? 'Bracket' : 'Winners Bracket'}
          <span className={`text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase ${
            isSingle
              ? 'bg-[rgba(232,41,74,0.12)] text-[var(--accent-red)] border-[rgba(232,41,74,0.3)]'
              : 'bg-[rgba(58,107,255,0.12)] text-[var(--accent)] border-[rgba(58,107,255,0.3)]'
          }`}>
            {isSingle ? 'Single Elim' : 'Double Elim'}
          </span>
        </div>
        <div className="overflow-x-auto overflow-y-visible pb-4">
          <BracketGrid rounds={bracket.upper} section="upper" stageMaps={stageMaps} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
        </div>
      </div>

      {isSingle && bracket.thirdPlace && (bracket.thirdPlace.p1 || bracket.thirdPlace.p2) && (
        <div className="t-surface border t-border rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4" style={{ color: 'var(--accent-gold)' }}>🥉 3rd Place Match</h3>
          <ThirdPlaceDisplay
            match={bracket.thirdPlace}
            onScore={onThirdPlace}
            onUndo={() => onUndo('thirdPlace', 0, 0)}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {!isSingle && hasLower && (
        <div className="t-surface border t-border rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-6" style={{ color: 'var(--accent)' }}>Losers Bracket</h3>
          <div className="overflow-x-auto overflow-y-visible pb-4">
            <BracketGrid rounds={bracket.lower!} section="lower" stageMaps={stageMaps} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
          </div>
        </div>
      )}

      {!isSingle && bracket.grandFinal && (bracket.grandFinal.p1 || bracket.grandFinal.p2) && (
        <div className="t-surface border t-border rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4" style={{ color: 'var(--accent)' }}>🏆 Grand Final</h3>
          <GrandFinalDisplay gf={bracket.grandFinal} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
        </div>
      )}

      {bracket.champion && (
        <div className="rounded-2xl p-7 text-center border-2 border-[var(--accent-gold)] bg-gradient-to-br from-[rgba(224,144,16,0.10)] to-[rgba(232,41,74,0.07)]">
          <div className="text-5xl mb-2">🏆</div>
          <h2 className="font-['Bebas_Neue'] text-5xl tracking-widest" style={{ color: 'var(--accent-gold)' }}>{bracket.champion}</h2>
          <p className="font-['DM_Mono'] text-xs mt-2 t-muted">Tournament Champion</p>
          {bracket.thirdPlace?.winner && (
            <p className="font-['DM_Mono'] text-xs mt-1 t-dim">🥉 3rd Place: {bracket.thirdPlace.winner}</p>
          )}
        </div>
      )}
    </>
  );
}

// ── BracketGrid ───────────────────────────────────────────────────────────────
function BracketGrid({ rounds, section, stageMaps, onScore, onUndo, isAdmin }: {
  rounds: BracketMatch[][];
  section: string;
  stageMaps: Record<string, string[]>;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isAdmin: boolean;
}) {
  const validRounds = rounds.map((r, i) => ({ round: r, ri: i })).filter(({ round }) => round.length > 0);
  if (validRounds.length === 0) return null;

  const firstRound = validRounds[0];
  const totalHeight = firstRound.round.length * getSpacing(0) + CARD_H;
  const totalWidth = validRounds.length * COL_W - COL_GAP + 28;
  const stroke = 'var(--border-mid)';

  return (
    <div style={{ position: 'relative', width: totalWidth, height: totalHeight, minWidth: totalWidth }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: totalHeight, overflow: 'visible', pointerEvents: 'none' }}>
        {validRounds.map(({ round }, colIdx) => {
          if (colIdx === validRounds.length - 1) return null;
          const nextColIdx = colIdx + 1;
          return round.map((_, mi) => {
            if (mi % 2 !== 0) return null;
            const partnerMi = mi + 1;
            const cardRight = colIdx * COL_W + CARD_W;
            const nextCardLeft = nextColIdx * COL_W;
            const midX = cardRight + COL_GAP / 2;
            const myCentreY = getMatchTop(colIdx, mi) + CARD_H / 2;
            const partnerCentreY = getMatchTop(colIdx, partnerMi) + CARD_H / 2;
            const targetCentreY = getMatchTop(nextColIdx, Math.floor(mi / 2)) + CARD_H / 2;
            return (
              <g key={`conn-${colIdx}-${mi}`}>
                <line x1={cardRight} y1={myCentreY} x2={midX} y2={myCentreY} stroke={stroke} strokeWidth={1.5} />
                <line x1={cardRight} y1={partnerCentreY} x2={midX} y2={partnerCentreY} stroke={stroke} strokeWidth={1.5} />
                <line x1={midX} y1={myCentreY} x2={midX} y2={partnerCentreY} stroke={stroke} strokeWidth={1.5} />
                <line x1={midX} y1={targetCentreY} x2={nextCardLeft} y2={targetCentreY} stroke={stroke} strokeWidth={1.5} />
              </g>
            );
          });
        })}
        {(() => {
          const lastColIdx = validRounds.length - 1;
          if (validRounds[lastColIdx].round.length !== 1) return null;
          const cardRight = lastColIdx * COL_W + CARD_W;
          const centreY = getMatchTop(lastColIdx, 0) + CARD_H / 2;
          return <line x1={cardRight} y1={centreY} x2={cardRight + 20} y2={centreY} stroke={stroke} strokeWidth={1.5} />;
        })()}
      </svg>

      {validRounds.map(({ round, ri }, colIdx) => {
        const sk = `${section}_r${ri}`;
        const maps: string[] = parseStageMaps(stageMaps[sk]);
        const isFinalCol = colIdx === validRounds.length - 1 && round.length === 1;
        const label = isFinalCol
          ? (section === 'upper' ? 'Final' : 'LB Final')
          : (section === 'upper' ? `Round ${ri + 1}` : `LR ${ri + 1}`);

        return round.map((match, mi) => {
          const top = getMatchTop(colIdx, mi);
          const left = colIdx * COL_W;
          return (
            <div key={`card-${colIdx}-${mi}`} style={{ position: 'absolute', top, left, width: CARD_W }}>
              {mi === 0 && (
                <div
                  className="font-['DM_Mono'] text-[10px] tracking-widest uppercase t-dim text-center"
                  style={{ position: 'absolute', bottom: '100%', left: 0, width: CARD_W, paddingBottom: 6, whiteSpace: 'nowrap' }}
                >
                  {label}
                </div>
              )}
              <MatchCard match={match} section={section} ri={ri} mi={mi} maps={maps} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
            </div>
          );
        });
      })}
    </div>
  );
}

// ── MatchCard ─────────────────────────────────────────────────────────────────
function MatchCard({ match, section, ri, mi, maps, onScore, onUndo, isAdmin }: {
  match: BracketMatch;
  section: string; ri: number; mi: number;
  maps: string[];
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isAdmin: boolean;
}) {
  const isBo3 = match.format === 'bo3';
  const isDone = !!match.winner;
  const canEdit = isAdmin && !!match.p1 && !!match.p2 && !isDone;
  const canUndo = isAdmin && isDone;

  return (
    <div className="t-elevated border t-border rounded-xl overflow-hidden" style={{ width: CARD_W }}>
      {maps.length > 0 && (
        <div className="px-2 pt-1.5 flex flex-wrap gap-1">
          {maps.map((m, i) => (
            <div key={i} className="text-[9px] px-1.5 py-0.5 rounded font-['DM_Mono']"
              style={{ background: 'rgba(176,109,255,0.12)', color: '#b06dff', border: '1px solid rgba(176,109,255,0.3)' }}>
              🗺 {m}
            </div>
          ))}
        </div>
      )}
      {isBo3 && (
        <div className="px-2 pt-1">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-['DM_Mono'] font-bold"
            style={{ background: 'rgba(224,144,16,0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(224,144,16,0.25)' }}>BO3</span>
        </div>
      )}
      {[{ player: match.p1, score: match.score1 }, { player: match.p2, score: match.score2 }].map(({ player, score }, idx) => {
        const isWinner = isDone && match.winner === player;
        const isLoser = isDone && match.winner !== player;
        return <PlayerRow key={idx} player={player} score={score} isWinner={isWinner} isLoser={isLoser} showScore={isDone || !!(player && match.p1 && match.p2)} />;
      })}
      {canEdit && (
        <ScoreInput
          isBo3={isBo3}
          p1={match.p1}
          p2={match.p2}
          onScore={(s1, s2) => onScore(section, ri, mi, s1, s2)}
        />
      )}
      {canUndo && (
        <div className="px-3 py-1" style={{ background: 'var(--bg-hover)' }}>
          <button
            className="w-full font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] transition-colors cursor-pointer text-center"
            onClick={() => onUndo(section, ri, mi)}
          >↩ undo</button>
        </div>
      )}
    </div>
  );
}

// ── ThirdPlaceDisplay ─────────────────────────────────────────────────────────
function ThirdPlaceDisplay({ match, onScore, onUndo, isAdmin }: {
  match: BracketMatch;
  onScore: (p1wins: number, p2wins: number) => Promise<void>;
  onUndo: () => Promise<void>;
  isAdmin: boolean;
}) {
  const isDone = !!match.winner;
  const canEdit = isAdmin && !!match.p1 && !!match.p2 && !isDone;
  const canUndo = isAdmin && isDone;

  return (
    <div className="t-elevated border t-border rounded-xl overflow-hidden" style={{ width: CARD_W }}>
      {[{ player: match.p1, score: match.score1 }, { player: match.p2, score: match.score2 }].map(({ player, score }, idx) => {
        const isWinner = isDone && match.winner === player;
        const isLoser = isDone && match.winner !== player;
        return <PlayerRow key={idx} player={isWinner ? `🥉 ${player}` : player} score={score} isWinner={isWinner} isLoser={isLoser} showScore={isDone || !!(player && match.p1 && match.p2)} />;
      })}
      {canEdit && (
        <ScoreInput
          isBo3={match.format === 'bo3'}
          p1={match.p1}
          p2={match.p2}
          onScore={(s1, s2) => onScore(s1, s2)}
        />
      )}
      {canUndo && (
        <div className="px-3 py-1" style={{ background: 'var(--bg-hover)' }}>
          <button
            className="w-full font-['DM_Mono'] text-[9px] t-dim hover:text-[var(--accent-red)] transition-colors cursor-pointer text-center"
            onClick={onUndo}
          >↩ undo</button>
        </div>
      )}
    </div>
  );
}

// ── GrandFinalDisplay ─────────────────────────────────────────────────────────
function GrandFinalDisplay({ gf, onScore, onUndo, isAdmin }: {
  gf: GrandFinal;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isAdmin: boolean;
}) {
  const isBo3 = gf.format === 'bo3';
  const gf1Done = !!(gf.winner || gf.isReset);
  const gf2Done = !!(gf.isReset && gf.winner);
  const canEditGf1 = isAdmin && gf.p1 && gf.p2 && !gf1Done;
  const canEditGf2 = isAdmin && gf.isReset && !gf.winner;
  const canUndo = isAdmin && (gf1Done || gf2Done);

  return (
    <div className="flex flex-col gap-4">
      {/* GF1 */}
      <div className="flex flex-col gap-1">
        <p className="font-['DM_Mono'] text-[10px] t-dim uppercase tracking-widest">GF1</p>
        <div className="t-elevated border t-border rounded-xl overflow-hidden" style={{ width: CARD_W }}>
          {isBo3 && (
            <div className="px-2 pt-1">
              <span className="text-[9px] px-1.5 py-0.5 rounded font-['DM_Mono'] font-bold"
                style={{ background: 'rgba(224,144,16,0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(224,144,16,0.25)' }}>BO3</span>
            </div>
          )}
          {[{ player: gf.p1, score: gf.score1 }, { player: gf.p2, score: gf.score2 }].map(({ player, score }, idx) => {
            const isWinner = !gf.isReset && !!gf.winner && gf.winner === player;
            const isLoser = !gf.isReset && !!gf.winner && gf.winner !== player;
            return <PlayerRow key={idx} player={player} score={score} isWinner={isWinner} isLoser={isLoser} showScore={gf1Done || !!(player && gf.p1 && gf.p2)} />;
          })}
          {gf.isReset && (
            <div className="px-3 py-1.5 border-t t-border text-center" style={{ background: 'rgba(58,107,255,0.06)' }}>
              <span className="font-['DM_Mono'] text-[9px] font-bold" style={{ color: 'var(--accent)' }}>🔄 BRACKET RESET — play GF2</span>
            </div>
          )}
          {canEditGf1 && (
            <ScoreInput isBo3={isBo3} p1={gf.p1} p2={gf.p2} onScore={(s1, s2) => onScore('gf', 0, 0, s1, s2)} />
          )}
        </div>
      </div>

      {/* GF2 — only shown after bracket reset is triggered */}
      {gf.isReset && (
        <div className="flex flex-col gap-1">
          <p className="font-['DM_Mono'] text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--accent)' }}>GF2 — Reset Match</p>
          <div className="t-elevated border-2 rounded-xl overflow-hidden" style={{ width: CARD_W, borderColor: 'var(--accent)' }}>
            {isBo3 && (
              <div className="px-2 pt-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded font-['DM_Mono'] font-bold"
                  style={{ background: 'rgba(224,144,16,0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(224,144,16,0.25)' }}>BO3</span>
              </div>
            )}
            {[{ player: gf.p1, score: gf.resetScore1 ?? 0 }, { player: gf.p2, score: gf.resetScore2 ?? 0 }].map(({ player, score }, idx) => {
              const isWinner = gf2Done && gf.winner === player;
              const isLoser = gf2Done && gf.winner !== player;
              return <PlayerRow key={idx} player={player} score={score} isWinner={isWinner} isLoser={isLoser} showScore={gf2Done || !!(player && gf.p1 && gf.p2)} />;
            })}
            {canEditGf2 && (
              <ScoreInput isBo3={isBo3} p1={gf.p1} p2={gf.p2} onScore={(s1, s2) => onScore('gf', 0, 0, s1, s2)} />
            )}
          </div>
        </div>
      )}

      {/* Undo */}
      {canUndo && (
        <button
          className="font-['DM_Mono'] text-[10px] t-dim hover:text-[var(--accent-red)] transition-colors cursor-pointer text-left"
          onClick={() => onUndo('gf', 0, 0)}
        >↩ undo last GF result</button>
      )}
    </div>
  );
}
