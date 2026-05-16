'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';
import type { BracketMatch, GrandFinal } from '@/lib/types';

export function BracketTab() {
  const { bracket, elimMode, isAdmin, setElimMode, generateBracket, advancePlayer, resetBracket } = useTourney();
  const [err, setErr] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setErr('');
    setGenerating(true);
    const result = await generateBracket();
    setGenerating(false);
    if (result?.error) setErr(result.error);
  };

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest mb-4">Bracket</h1>
        <div className="bg-[#161625] border border-[#252538] rounded-xl px-4 py-3 font-['DM_Mono'] text-sm text-[#7878a0]">
          🔒 Admin access required to generate bracket.
        </div>
        {bracket && <BracketDisplay />}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest mb-1">Bracket</h1>
      <p className="text-[#7878a0] font-['DM_Mono'] text-xs mb-5">Click a team name to advance them</p>

      <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl p-5 mb-5">
        <h2 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4">Format</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { id: 'single', icon: '⚔️', label: 'Single Elimination', desc: 'One loss and you\'re out.' },
            { id: 'double', icon: '🛡️', label: 'Double Elimination', desc: 'Losers bracket — two losses to be eliminated.' },
          ].map(opt => (
            <div
              key={opt.id}
              className={`p-5 rounded-xl border-2 cursor-pointer text-center transition-all
                ${elimMode === opt.id
                  ? 'border-[#ff3d5a] bg-[rgba(255,61,90,0.07)]'
                  : 'border-[#252538] bg-[#161625] hover:border-[#32324a]'
                }`}
              onClick={() => setElimMode(opt.id as 'single' | 'double')}
            >
              <div className="text-3xl mb-2">{opt.icon}</div>
              <div className="font-bold text-sm mb-1">{opt.label}</div>
              <div className="text-[11px] text-[#7878a0] leading-snug">{opt.desc}</div>
            </div>
          ))}
        </div>
        {err && <p className="text-[#ff3d5a] font-['DM_Mono'] text-xs mb-3">{err}</p>}
        <div className="flex gap-3">
          <button
            className="px-5 py-2.5 bg-[#ff3d5a] text-white font-bold rounded-xl hover:bg-[#ff1a3a] transition-all hover:-translate-y-0.5 text-sm disabled:opacity-40"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? '⏳ Generating…' : '🎲 Generate Bracket'}
          </button>
          <button
            className="px-4 py-2.5 bg-[#161625] border border-[#32324a] text-[#dde0f0] font-bold rounded-xl hover:border-[#4d7cff] hover:text-[#4d7cff] transition-colors text-sm"
            onClick={resetBracket}
          >
            Reset
          </button>
        </div>
      </div>

      {bracket && <BracketDisplay />}
    </div>
  );
}

function BracketDisplay() {
  const { bracket, advancePlayer, stageMaps, isAdmin } = useTourney();
  if (!bracket) return null;

  const badgeClass = bracket.type === 'single'
    ? 'bg-[rgba(255,61,90,0.15)] text-[#ff3d5a] border-[rgba(255,61,90,0.3)]'
    : 'bg-[rgba(77,124,255,0.15)] text-[#4d7cff] border-[rgba(77,124,255,0.3)]';
  const badgeText = bracket.type === 'single' ? 'Single Elim' : 'Double Elim';

  const hasLower = bracket.lower && bracket.lower.some(r => r.length > 0);

  return (
    <div>
      {/* Winners bracket */}
      <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl p-5 mb-4">
        <div className="flex items-center gap-3 font-['Bebas_Neue'] text-xl tracking-widest mb-4">
          Winners
          <span className={`text-[10px] font-['DM_Mono'] px-2.5 py-1 rounded-md border font-bold tracking-widest uppercase ${badgeClass}`}>
            {badgeText}
          </span>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-start min-w-max gap-0">
            <RoundSet rounds={bracket.upper} section="upper" stageMaps={stageMaps} onAdvance={advancePlayer} isAdmin={isAdmin} />
          </div>
        </div>
      </div>

      {/* Losers bracket */}
      {bracket.type === 'double' && hasLower && (
        <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl p-5 mb-4">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest text-[#4d7cff] mb-4 border-t border-[#252538] pt-4">Losers Bracket</h3>
          <div className="overflow-x-auto pb-2">
            <div className="flex items-start min-w-max gap-0">
              <RoundSet rounds={bracket.lower!} section="lower" stageMaps={stageMaps} onAdvance={advancePlayer} isAdmin={isAdmin} />
            </div>
          </div>
        </div>
      )}

      {/* Grand Final */}
      {bracket.type === 'double' && bracket.grandFinal && (bracket.grandFinal.p1 || bracket.grandFinal.p2) && (
        <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl p-5 mb-4">
          <h3 className="font-['Bebas_Neue'] text-xl tracking-widest text-[#4d7cff] mb-4">🏆 Grand Final</h3>
          <GrandFinalDisplay gf={bracket.grandFinal} onAdvance={advancePlayer} isAdmin={isAdmin} />
        </div>
      )}

      {/* Champion */}
      {bracket.champion && (
        <div className="rounded-2xl p-7 text-center border-2 border-[#ffb020] bg-gradient-to-br from-[rgba(255,176,32,0.12)] to-[rgba(255,61,90,0.08)] animate-pulse-glow">
          <div className="text-5xl mb-2">🏆</div>
          <h2 className="font-['Bebas_Neue'] text-5xl tracking-widest text-[#ffb020]">{bracket.champion}</h2>
          <p className="text-[#7878a0] font-['DM_Mono'] text-xs mt-2">Tournament Champion</p>
        </div>
      )}
    </div>
  );
}

function RoundSet({
  rounds, section, stageMaps, onAdvance, isAdmin
}: {
  rounds: BracketMatch[][];
  section: string;
  stageMaps: Record<string, string>;
  onAdvance: (section: string, ri: number, mi: number, player: string) => void;
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
        const spacing = Math.pow(2, ri);

        return (
          <div key={ri} className="w-44 flex-shrink-0">
            <div className="font-['DM_Mono'] text-[10px] tracking-widest uppercase text-[#4a4a6a] text-center pb-2.5 border-b border-[#252538] mb-2.5">
              {label}
            </div>
            <div className="flex flex-col">
              {round.map((match, mi) => (
                <div key={mi} className="flex items-center" style={{ margin: `${spacing * 7}px 0` }}>
                  <div className="w-36 bg-[#161625] border border-[#252538] rounded-xl overflow-hidden flex-shrink-0">
                    {stageMaps[sk] && (
                      <div className="text-[10px] px-2 py-1 mx-2 mt-1.5 rounded-md bg-[rgba(176,109,255,0.15)] text-[#b06dff] border border-[rgba(176,109,255,0.3)] font-['DM_Mono'] text-center">
                        🗺 {stageMaps[sk]}
                      </div>
                    )}
                    {[match.p1, match.p2].map((player, pi) => (
                      <MatchRow
                        key={pi}
                        player={player}
                        match={match}
                        section={section}
                        ri={ri}
                        mi={mi}
                        onAdvance={onAdvance}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                  <div className="w-4 h-0.5 bg-[#32324a] flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function MatchRow({ player, match, section, ri, mi, onAdvance, isAdmin }: {
  player: string | null;
  match: BracketMatch;
  section: string;
  ri: number;
  mi: number;
  onAdvance: (section: string, ri: number, mi: number, player: string) => void;
  isAdmin: boolean;
}) {
  const isWinner = match.winner && match.winner === player;
  const isLoser = match.winner && match.winner !== player;
  const canClick = isAdmin && player && !match.winner;

  let cls = 'px-3 py-2 text-xs font-["DM_Mono"] border-b border-[#252538] last:border-b-0 transition-colors ';
  if (!player) cls += 'text-[#4a4a6a] italic cursor-default ';
  else if (isWinner) cls += 'bg-[rgba(45,204,112,0.1)] text-[#2dcc70] cursor-default ';
  else if (isLoser) cls += 'text-[#4a4a6a] opacity-50 cursor-default ';
  else if (canClick) cls += 'cursor-pointer hover:bg-[rgba(255,255,255,0.05)] ';

  const text = !player ? (match.winner ? 'TBD' : 'BYE') : player;

  return (
    <div
      className={cls}
      onClick={() => canClick && player && onAdvance(section, ri, mi, player)}
      title={canClick && player ? `Click to advance ${player}` : undefined}
    >
      {text}
    </div>
  );
}

function GrandFinalDisplay({ gf, onAdvance, isAdmin }: {
  gf: GrandFinal;
  onAdvance: (section: string, ri: number, mi: number, player: string) => void;
  isAdmin: boolean;
}) {
  return (
    <div className="w-44 bg-[#161625] border border-[#252538] rounded-xl overflow-hidden">
      {[gf.p1, gf.p2].map((player, pi) => {
        const canClick = isAdmin && player && !gf.winner;
        let cls = 'px-3 py-2 text-xs font-["DM_Mono"] border-b border-[#252538] last:border-b-0 transition-colors ';
        if (!player) cls += 'text-[#4a4a6a] italic cursor-default ';
        else if (gf.winner === player) cls += 'bg-[rgba(45,204,112,0.1)] text-[#2dcc70] cursor-default ';
        else if (gf.winner) cls += 'text-[#4a4a6a] opacity-50 cursor-default ';
        else if (canClick) cls += 'cursor-pointer hover:bg-[rgba(255,255,255,0.05)] ';

        return (
          <div
            key={pi}
            className={cls}
            onClick={() => canClick && player && onAdvance('gf', 0, 0, player)}
          >
            {player ?? 'TBD'}
          </div>
        );
      })}
    </div>
  );
}
