'use client';

import { useState, useEffect } from 'react';
import { useTourney } from '@/lib/context';
import { TEAM_COLORS } from '@/lib/utils';

export function TeamsTab() {
  const { roster, teams, teamMode, isAdmin, formTeams, resetTeams, setTeamMode } = useTourney();
  const [leaders, setLeaders] = useState<string[]>([]);
  const [animating, setAnimating] = useState(false);
  const [animItems, setAnimItems] = useState<{ text: string; gold: boolean }[]>([]);
  const [animVisible, setAnimVisible] = useState<boolean[]>([]);
  const [err, setErr] = useState('');

  const n = Math.floor(roster.length / 5);

  useEffect(() => {
    setLeaders(Array(n).fill(''));
  }, [n, roster]);

  const updateLeader = (i: number, val: string) => {
    const next = [...leaders];
    next[i] = val;
    setLeaders(next);
  };

  const getPool = () => {
    const picked = leaders.filter(Boolean);
    return roster.filter(p => !picked.includes(p));
  };

  const handleForm = async () => {
    if (!isAdmin) return;
    setErr('');
    const result = await formTeams(teamMode === 'leader' ? leaders : undefined);
    if (result.error) { setErr(result.error); return; }
    // trigger animation from newly formed teams
    runAnimation();
  };

  const runAnimation = () => {
    // We animate after context updates teams
    setAnimating(true);
  };

  // Animate when teams land
  useEffect(() => {
    if (!animating || !teams.length) { setAnimating(false); return; }
    const items: { text: string; gold: boolean }[] = [];
    teams.forEach(t => {
      t.members.forEach(m => {
        items.push({ text: (m === t.leader ? '👑 ' : '') + m + ' → ' + t.name, gold: m === t.leader });
      });
    });
    setAnimItems(items);
    setAnimVisible(Array(items.length).fill(false));
    let delay = 0;
    items.forEach((_, i) => {
      setTimeout(() => setAnimVisible(prev => { const n2 = [...prev]; n2[i] = true; return n2; }), delay += 170);
    });
    setTimeout(() => setAnimating(false), delay + 900);
  }, [animating, teams]);

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest mb-4">Team Formation</h1>
        <div className="bg-[#161625] border border-[#252538] rounded-xl px-4 py-3 font-['DM_Mono'] text-sm text-[#7878a0]">
          🔒 Admin access required to form teams.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Animation overlay */}
      {animating && (
        <div className="fixed inset-0 z-50 bg-[rgba(8,8,16,0.93)] backdrop-blur-lg flex flex-col items-center justify-center gap-4">
          <h2 className="font-['Bebas_Neue'] text-4xl tracking-widest text-[#4d7cff]">FORMING TEAMS</h2>
          <p className="font-['DM_Mono'] text-sm text-[#7878a0]">Dealing players…</p>
          <div className="flex flex-wrap gap-2.5 justify-center max-w-xl">
            {animItems.map((item, i) => (
              <div
                key={i}
                className={`px-4 py-2.5 rounded-xl font-['DM_Mono'] text-sm border transition-all duration-500
                  ${item.gold
                    ? 'border-[#ffb020] text-[#ffb020] bg-[rgba(255,176,32,0.08)]'
                    : 'border-[#32324a] bg-[#161625] text-[#dde0f0]'
                  }
                  ${animVisible[i] ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-7 scale-90'}`}
              >
                {item.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest mb-1">Team Formation</h1>
      <p className="text-[#7878a0] font-['DM_Mono'] text-xs mb-5">5 players per team · Admin required</p>

      <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl p-5 mb-4">
        <h2 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4">Formation Mode</h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { id: 'leader', icon: '👑', label: 'Leader + Random', desc: 'Pick one captain per team, fill the rest randomly.' },
            { id: 'random', icon: '🎲', label: 'Fully Random', desc: 'All 5 members assigned randomly.' },
          ].map(opt => (
            <div
              key={opt.id}
              className={`p-5 rounded-xl border-2 cursor-pointer text-center transition-all
                ${teamMode === opt.id
                  ? 'border-[#ff3d5a] bg-[rgba(255,61,90,0.07)]'
                  : 'border-[#252538] bg-[#161625] hover:border-[#32324a]'
                }`}
              onClick={() => setTeamMode(opt.id as 'leader' | 'random')}
            >
              <div className="text-3xl mb-2">{opt.icon}</div>
              <div className="font-bold text-sm mb-1">{opt.label}</div>
              <div className="text-[11px] text-[#7878a0] leading-snug">{opt.desc}</div>
            </div>
          ))}
        </div>

        {teamMode === 'leader' && n >= 2 && (
          <div className="mb-4">
            <hr className="border-[#252538] mb-4" />
            <p className="font-['DM_Mono'] text-[11px] text-[#7878a0] tracking-widest mb-3">SELECT LEADERS</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className="bg-[#161625] border border-[#252538] rounded-xl p-3.5">
                  <h4 className="font-['Bebas_Neue'] text-base tracking-widest mb-2" style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}>
                    Team {i + 1}
                  </h4>
                  <select
                    className="w-full bg-[#1e1e30] border border-[#32324a] rounded-lg px-3 py-2 text-[#dde0f0] text-sm outline-none focus:border-[#4d7cff] cursor-pointer"
                    value={leaders[i] ?? ''}
                    onChange={e => updateLeader(i, e.target.value)}
                  >
                    <option value="">— Pick Leader —</option>
                    {roster.map(p => (
                      <option key={p} value={p} disabled={leaders.some((l, j) => j !== i && l === p)}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="bg-[#161625] border border-[#252538] rounded-lg px-4 py-2.5 font-['DM_Mono'] text-xs text-[#7878a0]">
              Pool: <span className="text-[#ffb020]">{getPool().join(', ') || '—'}</span>
            </div>
          </div>
        )}

        {roster.length < 10 && (
          <div className="bg-[#161625] border border-[#32324a] rounded-lg px-4 py-2.5 font-['DM_Mono'] text-xs text-[#ff3d5a] mb-4">
            ⚠ Need at least 10 players in the roster (multiples of 5). Currently: {roster.length}
          </div>
        )}

        {err && <p className="text-[#ff3d5a] font-['DM_Mono'] text-xs mb-3">{err}</p>}

        <hr className="border-[#252538] mb-4" />
        <div className="flex gap-3">
          <button
            className="px-5 py-2.5 bg-[#ffb020] text-[#1a0f00] font-bold rounded-xl hover:bg-[#ffa000] transition-all hover:-translate-y-0.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            onClick={handleForm}
            disabled={roster.length < 10 || roster.length % 5 !== 0}
          >
            ✨ Form Teams
          </button>
          <button
            className="px-4 py-2.5 bg-[#161625] border border-[#32324a] text-[#dde0f0] font-bold rounded-xl hover:border-[#4d7cff] hover:text-[#4d7cff] transition-colors text-sm"
            onClick={resetTeams}
          >
            Reset
          </button>
        </div>
      </div>

      {teams.length > 0 && (
        <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl p-5">
          <h2 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4">🛡 Teams</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {teams.map((t, ti) => (
              <div key={t.name} className="bg-[#161625] border border-[#252538] rounded-xl p-4" style={{ borderTopColor: t.color, borderTopWidth: 3 }}>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#252538]">
                  <h3 className="font-['Bebas_Neue'] text-xl tracking-wide" style={{ color: t.color }}>{t.name}</h3>
                </div>
                {t.members.map(m => (
                  <div key={m} className={`flex items-center gap-2 py-1.5 text-sm font-['DM_Mono'] ${m === t.leader ? 'text-[#ffb020]' : 'text-[#7878a0]'}`}>
                    <span className="w-5 inline-block">{m === t.leader ? '👑' : '·'}</span>
                    {m}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
