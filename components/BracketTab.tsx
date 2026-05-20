'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';
import type { BracketMatch, GrandFinal } from '@/lib/types';

export function BracketTab() {
  const { bracket, elimMode, teams, isAdmin, setElimMode, generateBracket, updateScore, resetBracket } = useTourney();
  const [err, setErr] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleFormatSelect = async (mode: 'single' | 'double') => {
    if (!isAdmin) return;
    setErr('');
    await setElimMode(mode);
    if (teams.length >= 2) {
      setGenerating(true);
      const result = await generateBracket();
      setGenerating(false);
      if (result?.error) setErr(result.error);
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full py-6 gap-5">

      <div>
        <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest t-text mb-1">Bracket</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">
          {isAdmin ? 'Select a format to auto-generate · Update scores to advance teams' : 'View only — admin required to edit'}
        </p>
      </div>

      {/* View-only banner */}
      {!isAdmin && (
        <div className="t-surface border t-border rounded-2xl px-5 py-3 font-['DM_Mono'] text-sm t-muted flex items-center gap-2 shrink-0">
          🔒 <span>Admin access required to generate or update the bracket.</span>
        </div>
      )}

      {/* Format selector — admin only */}
      {isAdmin && (
        <div className="t-surface border t-border rounded-2xl p-5 shrink-0">
          <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">Format</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { id: 'single', icon: '⚔️', label: 'Single Elimination', desc: "One loss and you're out." },
              { id: 'double', icon: '🛡️', label: 'Double Elimination', desc: 'Two losses to be eliminated.' },
            ].map(opt => (
              <div
                key={opt.id}
                className="p-5 rounded-xl border-2 text-center transition-all"
                style={{
                  borderColor: elimMode === opt.id ? 'var(--accent-red)' : 'var(--border)',
                  background:  elimMode === opt.id ? 'rgba(232,41,74,0.06)' : 'var(--bg-elevated)',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.6 : 1,
                }}
                onClick={() => !generating && handleFormatSelect(opt.id as 'single' | 'double')}
              >
                <div className="text-3xl mb-2">{opt.icon}</div>
                <div className="font-bold text-sm mb-1 t-text">{opt.label}</div>
                <div className="font-['DM_Mono'] text-[11px] t-muted">{opt.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {generating && <p className="font-['DM_Mono'] text-xs t-muted">⏳ Generating bracket…</p>}
            {err && <p className="font-['DM_Mono'] text-xs" style={{ color: 'var(--accent-red)' }}>{err}</p>}
            {teams.length < 2 && <p className="font-['DM_Mono'] text-xs t-muted">⚠ Form teams first to auto-generate.</p>}
            {bracket && (
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

      {/* Bracket display — always visible if exists */}
      {bracket ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <BracketDisplay />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-['DM_Mono'] text-sm t-dim">No bracket yet. {isAdmin ? 'Select a format above.' : 'Waiting for admin to generate.'}</p>
        </div>
      )}
    </div>
  );
}

function BracketDisplay() {
  const { bracket, updateScore, stageMaps, isAdmin } = useTourney();
  if (!bracket) return null;

  const badgeClass = bracket.type === 'single'
    ? 'bg-[rgba(232,41,74,0.12)] text-[var(--accent-red)] border-[rgba(232,41,74,0.3)]'
    : 'bg-[rgba(58,107,255,0.12)] text-[var(--accent)] border-[rgba(58,107,255,0.3)]';
  const badgeText = bracket.type === 'single' ? 'Single Elim' : 'Double Elim';
  const hasLower = bracket.lower && bracket.lower.some(r => r.length > 0);

  return (
    <>
      {/* Winners bracket */}
      <div className="t-surface border t-border rounded-xl p-5">
        <div className="flex items-center gap-3 font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">
          Winners
          <span className={`text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase ${badgeClass}`}>
            {badgeText}
          </span>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-start min-w-max gap-0">
            <RoundSet rounds={bracket.upper} section="upper" stageMaps={stageMaps} onScore={updateScore} isAdmin={isAdmin} />
          </div>
        </div>
      </div>

      {/* Losers bracket */}
      {bracket.type === 'double' && hasLower && (
        <div className="t-surface border t-border rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4" style={{ color: 'var(--accent)' }}>Losers Bracket</h3>
          <div className="overflow-x-auto pb-2">
            <div className="flex items-start min-w-max gap-0">
              <RoundSet rounds={bracket.lower!} section="lower" stageMaps={stageMaps} onScore={updateScore} isAdmin={isAdmin} />
            </div>
          </div>
        </div>
      )}

      {/* Grand Final */}
      {bracket.type === 'double' && bracket.grandFinal && (bracket.grandFinal.p1 || bracket.grandFinal.p2) && (
        <div className="t-surface border t-border rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4" style={{ color: 'var(--accent)' }}>🏆 Grand Final</h3>
          <GrandFinalDisplay gf={bracket.grandFinal} onScore={updateScore} isAdmin={isAdmin} />
        </div>
      )}

      {/* Champion */}
      {bracket.champion && (
        <div className="rounded-2xl p-7 text-center border-2 border-[var(--accent-gold)] bg-gradient-to-br from-[rgba(224,144,16,0.10)] to-[rgba(232,41,74,0.07)] animate-pulse-glow">
          <div className="text-5xl mb-2">🏆</div>
          <h2 className="font-['Bebas_Neue'] text-5xl tracking-widest" style={{ color: 'var(--accent-gold)' }}>{bracket.champion}</h2>
          <p className="font-['DM_Mono'] text-xs mt-2 t-muted">Tournament Champion</p>
        </div>
      )}
    </>
  );
}

function RoundSet({ rounds, section, stageMaps, onScore, isAdmin }: {
  rounds: BracketMatch[][];
  section: string;
  stageMaps: Record<string, string[]>;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  isAdmin: boolean;
}) {
  return (
    <>
      {rounds.map((round, ri) => {
        if (section === 'lower' && !round.length) return null;
        const isFinalRound = ri === rounds.length - 1 && round.length === 1;
        const label = isFinalRound
          ? (section === 'upper' ? 'UB Final' : 'LB Final')
          : (section === 'upper' ? `Round ${ri + 1}` : `LR ${ri + 1}`);
        const sk = `${section}_r${ri}`;
        const maps: string[] = Array.isArray(stageMaps[sk]) ? stageMaps[sk] as unknown as string[] : stageMaps[sk] ? [stageMaps[sk] as unknown as string] : [];
        const spacing = Math.pow(2, ri);

        return (
          <div key={ri} className="w-52 flex-shrink-0">
            <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase t-dim text-center pb-2.5 border-b t-border mb-2.5">
              {label}
            </div>
            <div className="flex flex-col">
              {round.map((match, mi) => (
                <div key={mi} className="flex items-center" style={{ margin: `${spacing * 7}px 0` }}>
                  <MatchCard match={match} section={section} ri={ri} mi={mi} maps={maps} onScore={onScore} isAdmin={isAdmin} />
                  <div className="w-4 h-0.5 flex-shrink-0" style={{ background: 'var(--border-mid)' }} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function MatchCard({ match, section, ri, mi, maps, onScore, isAdmin }: {
  match: BracketMatch;
  section: string; ri: number; mi: number;
  maps: string[];
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  isAdmin: boolean;
}) {
  const isBo3 = match.format === 'bo3';
  const isDone = !!match.winner;
  const canEdit = isAdmin && match.p1 && match.p2 && !isDone;

  return (
    <div className="w-48 t-elevated border t-border rounded-xl overflow-hidden flex-shrink-0">
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

      {[{ player: match.p1, score: match.score1, isP1: true }, { player: match.p2, score: match.score2, isP1: false }].map(({ player, score, isP1 }) => {
        const isWinner = isDone && match.winner === player;
        const isLoser  = isDone && match.winner !== player;
        return (
          <div key={isP1 ? 'p1' : 'p2'} className="flex items-center justify-between px-3 py-2 border-b t-border last:border-b-0"
            style={{ background: isWinner ? 'rgba(34,184,98,0.07)' : undefined }}>
            <span className="text-xs font-['DM_Mono'] flex-1 truncate"
              style={{ color: !player ? 'var(--text-dim)' : isWinner ? 'var(--accent-green)' : isLoser ? 'var(--text-dim)' : 'var(--text)', fontStyle: !player ? 'italic' : undefined, opacity: isLoser ? 0.5 : 1 }}>
              {isWinner && '✓ '}{player ?? (match.winner ? 'TBD' : 'BYE')}
            </span>
            {(isDone || (player && match.p1 && match.p2)) && (
              <span className="font-['Bebas_Neue'] text-base ml-2 shrink-0" style={{ color: isWinner ? 'var(--accent-green)' : 'var(--text-dim)' }}>{score}</span>
            )}
          </div>
        );
      })}

      {canEdit && (
        <div className="px-3 py-2 border-t t-border" style={{ background: 'var(--bg-hover)' }}>
          {isBo3 ? (
            <div className="flex flex-col gap-1.5">
              <p className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-wider">Score (BO3)</p>
              <div className="flex gap-1 flex-wrap">
                {(['2-0', '2-1', '0-2', '1-2'] as const).map(label => {
                  const [s1, s2] = label.split('-').map(Number);
                  return (
                    <button key={label} className="px-2 py-1 rounded font-['DM_Mono'] text-[10px] font-bold border transition-all cursor-pointer"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      onClick={() => onScore(section, ri, mi, s1, s2)}>{label}</button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5 items-center">
              <p className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-wider shrink-0">Winner</p>
              <button className="flex-1 px-2 py-1 rounded font-['DM_Mono'] text-[10px] border transition-all truncate cursor-pointer"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--accent-green)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-green)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                onClick={() => onScore(section, ri, mi, 1, 0)}>{match.p1}</button>
              <button className="flex-1 px-2 py-1 rounded font-['DM_Mono'] text-[10px] border transition-all truncate cursor-pointer"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--accent-green)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-green)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                onClick={() => onScore(section, ri, mi, 0, 1)}>{match.p2}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GrandFinalDisplay({ gf, onScore, isAdmin }: {
  gf: GrandFinal;
  onScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  isAdmin: boolean;
}) {
  const isBo3 = gf.format === 'bo3';
  const isDone = !!gf.winner;
  const canEdit = isAdmin && gf.p1 && gf.p2 && !isDone;

  return (
    <div className="w-52 t-elevated border t-border rounded-xl overflow-hidden">
      {isBo3 && (
        <div className="px-2 pt-1">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-['DM_Mono'] font-bold"
            style={{ background: 'rgba(224,144,16,0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(224,144,16,0.25)' }}>BO3</span>
        </div>
      )}
      {[{ player: gf.p1, score: gf.score1, isP1: true }, { player: gf.p2, score: gf.score2, isP1: false }].map(({ player, score, isP1 }) => {
        const isWinner = isDone && gf.winner === player;
        const isLoser  = isDone && gf.winner !== player;
        return (
          <div key={isP1 ? 'p1' : 'p2'} className="flex items-center justify-between px-3 py-2 border-b t-border last:border-b-0"
            style={{ background: isWinner ? 'rgba(34,184,98,0.07)' : undefined }}>
            <span className="text-xs font-['DM_Mono'] flex-1 truncate"
              style={{ color: !player ? 'var(--text-dim)' : isWinner ? 'var(--accent-green)' : isLoser ? 'var(--text-dim)' : 'var(--text)', opacity: isLoser ? 0.5 : 1 }}>
              {isWinner && '✓ '}{player ?? 'TBD'}
            </span>
            {(isDone || (player && gf.p1 && gf.p2)) && (
              <span className="font-['Bebas_Neue'] text-base ml-2 shrink-0" style={{ color: isWinner ? 'var(--accent-green)' : 'var(--text-dim)' }}>{score}</span>
            )}
          </div>
        );
      })}
      {canEdit && (
        <div className="px-3 py-2 border-t t-border" style={{ background: 'var(--bg-hover)' }}>
          {isBo3 ? (
            <div className="flex flex-col gap-1.5">
              <p className="font-['DM_Mono'] text-[9px] t-dim uppercase tracking-wider">Score (BO3)</p>
              <div className="flex gap-1 flex-wrap">
                {(['2-0', '2-1', '0-2', '1-2'] as const).map(label => {
                  const [s1, s2] = label.split('-').map(Number);
                  return (
                    <button key={label} className="px-2 py-1 rounded font-['DM_Mono'] text-[10px] font-bold border transition-all cursor-pointer"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      onClick={() => onScore('gf', 0, 0, s1, s2)}>{label}</button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5 items-center">
              <p className="font-['DM_Mono'] text-[9px] t-dim uppercase shrink-0">Winner</p>
              <button className="flex-1 px-2 py-1 rounded font-['DM_Mono'] text-[10px] border transition-all truncate cursor-pointer"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--accent-green)' }}
                onClick={() => onScore('gf', 0, 0, 1, 0)}>{gf.p1}</button>
              <button className="flex-1 px-2 py-1 rounded font-['DM_Mono'] text-[10px] border transition-all truncate cursor-pointer"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--accent-green)' }}
                onClick={() => onScore('gf', 0, 0, 0, 1)}>{gf.p2}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
