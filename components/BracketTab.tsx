'use client';

import { useState, useRef } from 'react';
import { useTourney } from '@/lib/context';
import { parseStageMaps } from '@/lib/utils';
import type { BracketMatch, GrandFinal } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD_W = 192;   // px — match card width
const CARD_H = 72;    // px — match card height (2 rows × 36px)
const COL_GAP = 56;   // px — horizontal space between columns (where connectors live)
const COL_W   = CARD_W + COL_GAP; // total column stride

// ─── PlayerRow ────────────────────────────────────────────────────────────────
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
        <span
          className="font-['Bebas_Neue'] text-base ml-2 shrink-0"
          style={{ color: isWinner ? 'var(--accent-green)' : 'var(--text-dim)' }}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// ─── ScoreControls ────────────────────────────────────────────────────────────
function ScoreControls({ isBo3, p1, p2, onScore }: {
  isBo3: boolean;
  p1: string | null;
  p2: string | null;
  onScore: (s1: number, s2: number) => void;
}) {
  return (
    <div className="px-3 py-2 border-t t-border" style={{ background: 'var(--bg-hover)' }}>
      {isBo3 ? (
        <div className="flex flex-col gap-1.5">
          <p className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-wider">Score (BO3)</p>
          <div className="flex gap-1 flex-wrap">
            {(['2-0', '2-1', '0-2', '1-2'] as const).map(label => {
              const [s1, s2] = label.split('-').map(Number);
              return (
                <button
                  key={label}
                  className="px-2 py-1 rounded font-['DM_Mono'] text-[10px] font-bold border transition-all cursor-pointer"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  onClick={() => onScore(s1, s2)}
                >{label}</button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5 items-center">
          <p className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-wider shrink-0">Winner</p>
          <button
            className="flex-1 px-2 py-1 rounded font-['DM_Mono'] text-[10px] border transition-all truncate cursor-pointer"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--accent-green)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-green)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
            onClick={() => onScore(1, 0)}
          >{p1}</button>
          <button
            className="flex-1 px-2 py-1 rounded font-['DM_Mono'] text-[10px] border transition-all truncate cursor-pointer"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--accent-green)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-green)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
            onClick={() => onScore(0, 1)}
          >{p2}</button>
        </div>
      )}
    </div>
  );
}

// ─── BracketTab ───────────────────────────────────────────────────────────────
export function BracketTab() {
  const { bracket, elimMode, teams, isAdmin, loading, setElimMode, generateBracket, updateScore, undoMatch, updateThirdPlace, resetBracket } = useTourney();
  const [err, setErr] = useState('');
  const [generating, setGenerating] = useState(false);

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
    const result = await generateBracket();
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
          {isAdmin ? 'Pick a format · Generate once · Update scores to advance teams' : 'View only — admin required to edit'}
        </p>
      </div>

      {!isAdmin && (
        <div className="t-surface border t-border rounded-2xl px-5 py-3 font-['DM_Mono'] text-sm t-muted flex items-center gap-2 shrink-0">
          🔒 <span>Admin access required to generate or update the bracket.</span>
        </div>
      )}

      {isAdmin && (
        <div className="t-surface border t-border rounded-2xl p-5 shrink-0">
          <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">Format</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { id: 'single', icon: '⚔️', label: 'Single Elimination', desc: 'One loss = out. Losers of semis play for 3rd place.' },
              { id: 'double', icon: '🛡️', label: 'Double Elimination', desc: 'Two losses = out. Losers drop to a second bracket.' },
            ].map(opt => (
              <div
                key={opt.id}
                className="p-5 rounded-xl border-2 transition-all select-none"
                style={{
                  borderColor: elimMode === opt.id ? 'var(--accent-red)' : 'var(--border)',
                  background: elimMode === opt.id ? 'rgba(232,41,74,0.06)' : 'var(--bg-elevated)',
                  cursor: hasBracket ? 'not-allowed' : 'pointer',
                  opacity: hasBracket ? 0.5 : 1,
                }}
                onClick={() => !hasBracket && setElimMode(opt.id as 'single' | 'double')}
              >
                <div className="text-3xl mb-2">{opt.icon}</div>
                <div className="font-bold text-sm mb-1 t-text">{opt.label}</div>
                <div className="font-['DM_Mono'] text-[11px] t-muted">{opt.desc}</div>
                {hasBracket && elimMode === opt.id && (
                  <div className="mt-2 font-['DM_Mono'] text-[10px]" style={{ color: 'var(--accent-red)' }}>● Active</div>
                )}
              </div>
            ))}
          </div>

          {hasBracket && (
            <p className="font-['DM_Mono'] text-[11px] t-dim mb-3">
              ⚠ Format is locked once generated. Reset the bracket to change it.
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {!hasBracket && (
              <button
                className="px-5 py-2 font-['DM_Mono'] font-bold rounded-xl text-sm text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: 'var(--accent-red)' }}
                onClick={handleGenerate}
                disabled={!hasTeams || generating}
              >
                {generating ? '⏳ Generating…' : '⚡ Generate Bracket'}
              </button>
            )}
            {!hasTeams && <p className="font-['DM_Mono'] text-xs t-muted">⚠ Form teams first.</p>}
            {err && <p className="font-['DM_Mono'] text-xs" style={{ color: 'var(--accent-red)' }}>{err}</p>}
            {hasBracket && (
              <button
                className="ml-auto px-4 py-2 font-['DM_Mono'] text-xs border t-border-mid t-muted t-elevated rounded-xl transition-colors cursor-pointer hover:border-[var(--accent-red)] hover:text-[var(--accent-red)]"
                onClick={resetBracket}
              >
                Reset Bracket
              </button>
            )}
          </div>
        </div>
      )}

      {bracket ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <BracketDisplay onScore={updateScore} onUndo={undoMatch} onThirdPlace={updateThirdPlace} />
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

// ─── BracketDisplay ───────────────────────────────────────────────────────────
function BracketDisplay({
  onScore, onUndo, onThirdPlace,
}: {
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  onThirdPlace: (p1wins: number, p2wins: number) => Promise<void>;
}) {
  const { bracket, stageMaps, isAdmin } = useTourney();
  if (!bracket) return null;

  const isSingle = bracket.type === 'single';
  const hasLower = bracket.lower && bracket.lower.some(r => r.length > 0);

  return (
    <>
      <div className="t-surface border t-border rounded-xl p-5">
        <div className="flex items-center gap-3 font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">
          {isSingle ? 'Bracket' : 'Winners Bracket'}
          <span className={`text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase ${
            isSingle
              ? 'bg-[rgba(232,41,74,0.12)] text-[var(--accent-red)] border-[rgba(232,41,74,0.3)]'
              : 'bg-[rgba(58,107,255,0.12)] text-[var(--accent)] border-[rgba(58,107,255,0.3)]'
          }`}>
            {isSingle ? 'Single Elim' : 'Double Elim'}
          </span>
        </div>
        <div className="overflow-x-auto overflow-y-visible pb-2">
          <BracketGrid rounds={bracket.upper} section="upper" stageMaps={stageMaps} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
        </div>
      </div>

      {isSingle && bracket.thirdPlace && (bracket.thirdPlace.p1 || bracket.thirdPlace.p2) && (
        <div className="t-surface border t-border rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4" style={{ color: 'var(--accent-gold)' }}>🥉 3rd Place Match</h3>
          <ThirdPlaceDisplay match={bracket.thirdPlace} onScore={onThirdPlace} isAdmin={isAdmin} />
        </div>
      )}

      {!isSingle && hasLower && (
        <div className="t-surface border t-border rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4" style={{ color: 'var(--accent)' }}>Losers Bracket</h3>
          <div className="overflow-x-auto overflow-y-visible pb-2">
            <BracketGrid rounds={bracket.lower!} section="lower" stageMaps={stageMaps} onScore={onScore} onUndo={onUndo} isAdmin={isAdmin} />
          </div>
        </div>
      )}

      {!isSingle && bracket.grandFinal && (bracket.grandFinal.p1 || bracket.grandFinal.p2) && (
        <div className="t-surface border t-border rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4" style={{ color: 'var(--accent)' }}>🏆 Grand Final</h3>
          <GrandFinalDisplay gf={bracket.grandFinal} onScore={onScore} isAdmin={isAdmin} />
        </div>
      )}

      {bracket.champion && (
        <div className="rounded-2xl p-7 text-center border-2 border-[var(--accent-gold)] bg-gradient-to-br from-[rgba(224,144,16,0.10)] to-[rgba(232,41,74,0.07)] animate-pulse-glow">
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

// ─── BracketGrid — absolute-positioned cards + SVG connectors ─────────────────
function BracketGrid({ rounds, section, stageMaps, onScore, onUndo, isAdmin }: {
  rounds: BracketMatch[][];
  section: string;
  stageMaps: Record<string, string[]>;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  onUndo: (section: string, ri: number, mi: number) => Promise<void>;
  isAdmin: boolean;
}) {
  // Filter out empty rounds (can occur in losers bracket)
  const validRounds = rounds.map((r, i) => ({ round: r, ri: i })).filter(({ round }) => round.length > 0);
  if (validRounds.length === 0) return null;

  const numRounds = validRounds.length;

  // For each round, compute the vertical spacing between match centres.
  // Round 0: spacing = CARD_H + 16px gap
  // Each subsequent round: spacing doubles (matches fan out)
  const getSpacing = (roundIdx: number) => {
    // roundIdx here is the visual column index (0 = first visible round)
    const base = CARD_H + 16;
    return base * Math.pow(2, roundIdx);
  };

  // Compute the top offset for each match so it aligns with the midpoint of
  // its two "parent" matches in the previous round.
  const getMatchTop = (colIdx: number, matchIdx: number) => {
    const spacing = getSpacing(colIdx);
    if (colIdx === 0) {
      // First column: just stack with base spacing
      return matchIdx * spacing;
    }
    // Centre of this match = midpoint between the two feeder matches' centres
    const prevSpacing = getSpacing(colIdx - 1);
    const feederA = matchIdx * 2;
    const feederB = feederA + 1;
    const topA = getMatchTop(colIdx - 1, feederA) + CARD_H / 2;
    const topB = getMatchTop(colIdx - 1, feederB) + CARD_H / 2;
    return (topA + topB) / 2 - CARD_H / 2;
  };

  // Total canvas height — driven by the first (tallest) column
  const firstRound = validRounds[0];
  const totalHeight = firstRound.round.length * getSpacing(0);

  // Total canvas width
  const totalWidth = numRounds * COL_W - COL_GAP + 8; // +8 for right stub

  // Connector stroke colour (CSS var won't work in SVG attr, use inline style)
  const stroke = 'var(--border-mid)';

  return (
    <div style={{ position: 'relative', width: totalWidth, height: totalHeight, minWidth: totalWidth }}>

      {/* SVG connector layer — drawn behind cards */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: totalHeight, overflow: 'visible', pointerEvents: 'none' }}
      >
        {validRounds.map(({ round, ri }, colIdx) => {
          if (colIdx === validRounds.length - 1) return null; // last column has no outgoing connector
          const nextColIdx = colIdx + 1;

          return round.map((_, mi) => {
            const isEven = mi % 2 === 0;
            const partnerMi = isEven ? mi + 1 : mi - 1;

            // x positions
            const cardLeft = colIdx * COL_W;
            const cardRight = cardLeft + CARD_W;
            const nextCardLeft = nextColIdx * COL_W;
            const midX = cardRight + COL_GAP / 2;

            // y: vertical centre of this card
            const myTop = getMatchTop(colIdx, mi);
            const myCentreY = myTop + CARD_H / 2;

            // y: vertical centre of partner card (to draw the bracket join)
            const partnerTop = getMatchTop(colIdx, partnerMi);
            const partnerCentreY = partnerTop + CARD_H / 2;

            // y: vertical centre of the target match in next round
            const targetMi = Math.floor(mi / 2);
            const targetTop = getMatchTop(nextColIdx, targetMi);
            const targetCentreY = targetTop + CARD_H / 2;

            // Only draw from the "even" match of each pair to avoid duplicate lines
            // The even match draws the stub + vertical join + horizontal to next round
            if (isEven) {
              return (
                <g key={`${colIdx}-${mi}`}>
                  {/* Horizontal stub right of THIS card */}
                  <line x1={cardRight} y1={myCentreY} x2={midX} y2={myCentreY} stroke={stroke} strokeWidth={1.5} />
                  {/* Horizontal stub right of PARTNER card */}
                  <line x1={cardRight} y1={partnerCentreY} x2={midX} y2={partnerCentreY} stroke={stroke} strokeWidth={1.5} />
                  {/* Vertical join between the two stubs */}
                  <line x1={midX} y1={myCentreY} x2={midX} y2={partnerCentreY} stroke={stroke} strokeWidth={1.5} />
                  {/* Horizontal line to next card */}
                  <line x1={midX} y1={targetCentreY} x2={nextCardLeft} y2={targetCentreY} stroke={stroke} strokeWidth={1.5} />
                </g>
              );
            }
            return null;
          });
        })}

        {/* Right stub from last round's card to indicate it feeds into something (GF etc) */}
        {(() => {
          const lastColIdx = validRounds.length - 1;
          const lastRound = validRounds[lastColIdx];
          if (lastRound.round.length !== 1) return null;
          const cardLeft = lastColIdx * COL_W;
          const cardRight = cardLeft + CARD_W;
          const centreY = getMatchTop(lastColIdx, 0) + CARD_H / 2;
          return <line key="final-stub" x1={cardRight} y1={centreY} x2={cardRight + 20} y2={centreY} stroke={stroke} strokeWidth={1.5} />;
        })()}
      </svg>

      {/* Match cards — absolutely positioned */}
      {validRounds.map(({ round, ri }, colIdx) => {
        const sk = `${section}_r${ri}`;
        const maps: string[] = parseStageMaps(stageMaps[sk]);

        return round.map((match, mi) => {
          const top = getMatchTop(colIdx, mi);
          const left = colIdx * COL_W;

          // Round label — only render above first match in each column
          const isFinalRound = colIdx === validRounds.length - 1 && round.length === 1;
          const label = isFinalRound
            ? (section === 'upper' ? 'Final' : 'LB Final')
            : (section === 'upper' ? `Round ${ri + 1}` : `LR ${ri + 1}`);

          return (
            <div key={`${colIdx}-${mi}`} style={{ position: 'absolute', top, left, width: CARD_W }}>
              {/* Column header above first card only */}
              {mi === 0 && (
                <div
                  className="font-['DM_Mono'] text-[10px] tracking-widest uppercase t-dim text-center pb-2"
                  style={{ position: 'absolute', top: -(CARD_H / 2 + 4), left: 0, width: CARD_W, whiteSpace: 'nowrap' }}
                >
                  {label}
                </div>
              )}
              <MatchCard
                match={match}
                section={section}
                ri={ri}
                mi={mi}
                maps={maps}
                onScore={onScore}
                onUndo={onUndo}
                isAdmin={isAdmin}
              />
            </div>
          );
        });
      })}
    </div>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────
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
  const canEdit = isAdmin && match.p1 && match.p2 && !isDone;
  const canUndo = isAdmin && isDone;

  return (
    <div className="t-elevated border t-border rounded-xl overflow-hidden flex-shrink-0" style={{ width: CARD_W }}>
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
            style={{ background: 'rgba(224,144,16,0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(224,144,16,0.25)' }}>
            BO3
          </span>
        </div>
      )}
      {[{ player: match.p1, score: match.score1 }, { player: match.p2, score: match.score2 }].map(({ player, score }, idx) => {
        const isWinner = isDone && match.winner === player;
        const isLoser  = isDone && match.winner !== player;
        return (
          <PlayerRow key={idx} player={player} score={score} isWinner={isWinner} isLoser={isLoser}
            showScore={isDone || !!(player && match.p1 && match.p2)} />
        );
      })}
      {canEdit && (
        <ScoreControls isBo3={isBo3} p1={match.p1} p2={match.p2}
          onScore={(s1, s2) => onScore(section, ri, mi, s1, s2)} />
      )}
      {canUndo && (
        <div className="px-3 py-1.5 border-t t-border flex justify-end" style={{ background: 'var(--bg-hover)' }}>
          <button
            className="font-['DM_Mono'] text-[9px] px-2 py-1 rounded border transition-all cursor-pointer"
            style={{ borderColor: 'var(--border-mid)', color: 'var(--text-dim)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
            onClick={() => onUndo(section, ri, mi)}
          >↩ Undo</button>
        </div>
      )}
    </div>
  );
}

// ─── ThirdPlaceDisplay ────────────────────────────────────────────────────────
function ThirdPlaceDisplay({ match, onScore, isAdmin }: {
  match: BracketMatch;
  onScore: (p1wins: number, p2wins: number) => Promise<void>;
  isAdmin: boolean;
}) {
  const isDone = !!match.winner;
  const canEdit = isAdmin && match.p1 && match.p2 && !isDone;

  return (
    <div className="t-elevated border t-border rounded-xl overflow-hidden" style={{ width: CARD_W }}>
      {[{ player: match.p1, score: match.score1 }, { player: match.p2, score: match.score2 }].map(({ player, score }, idx) => {
        const isWinner = isDone && match.winner === player;
        const isLoser  = isDone && match.winner !== player;
        return (
          <PlayerRow key={idx} player={isWinner ? `🥉 ${player}` : player} score={score}
            isWinner={isWinner} isLoser={isLoser}
            showScore={isDone || !!(player && match.p1 && match.p2)} />
        );
      })}
      {canEdit && (
        <ScoreControls isBo3={match.format === 'bo3'} p1={match.p1} p2={match.p2}
          onScore={(s1, s2) => onScore(s1, s2)} />
      )}
    </div>
  );
}

// ─── GrandFinalDisplay ────────────────────────────────────────────────────────
function GrandFinalDisplay({ gf, onScore, isAdmin }: {
  gf: GrandFinal;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  isAdmin: boolean;
}) {
  const isBo3 = gf.format === 'bo3';
  const isDone = !!gf.winner;
  const canEdit = isAdmin && gf.p1 && gf.p2 && !isDone;

  return (
    <div className="t-elevated border t-border rounded-xl overflow-hidden" style={{ width: CARD_W }}>
      {isBo3 && (
        <div className="px-2 pt-1">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-['DM_Mono'] font-bold"
            style={{ background: 'rgba(224,144,16,0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(224,144,16,0.25)' }}>BO3</span>
        </div>
      )}
      {[{ player: gf.p1, score: gf.score1 }, { player: gf.p2, score: gf.score2 }].map(({ player, score }, idx) => {
        const isWinner = isDone && gf.winner === player;
        const isLoser  = isDone && gf.winner !== player;
        return (
          <PlayerRow key={idx} player={player} score={score} isWinner={isWinner} isLoser={isLoser}
            showScore={isDone || !!(player && gf.p1 && gf.p2)} />
        );
      })}
      {canEdit && (
        <ScoreControls isBo3={isBo3} p1={gf.p1} p2={gf.p2}
          onScore={(s1, s2) => onScore('gf', 0, 0, s1, s2)} />
      )}
    </div>
  );
}
