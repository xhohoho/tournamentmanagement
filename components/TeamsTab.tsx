'use client';
import { useState, useEffect } from 'react';
import { useTourney } from '@/lib/context';
import { TEAM_COLORS } from '@/lib/utils';

// How many players have been "revealed" so far after form
// revealCount goes 0 → total players, one per interval tick
function useReveal(active: boolean, total: number, intervalMs = 180) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) { setCount(0); return; }
    setCount(0);
    const iv = setInterval(() => {
      setCount(c => {
        if (c >= total) { clearInterval(iv); return c; }
        return c + 1;
      });
    }, intervalMs);
    return () => clearInterval(iv);
  }, [active, total, intervalMs]);

  return count;
}

// Shuffle function for randomizing player order
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function TeamsTab() {
  const { roster, teams, teamMode, isAdmin, formTeams, resetTeams, setTeamMode, assignLeader } = useTourney();
  const [leaders, setLeaders] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [shuffledPlayers, setShuffledPlayers] = useState<{teamIdx: number; slotIdx: number}[]>([]);

  // Total slots across all teams (5 per team)
  const totalSlots = teams.length * 5;
  const revealCount = useReveal(revealing, totalSlots);

  // Stop revealing once all slots are shown
  useEffect(() => {
    if (revealing && revealCount >= totalSlots && totalSlots > 0) {
      setRevealing(false);
    }
  }, [revealing, revealCount, totalSlots]);

  // Generate shuffled player order when revealing starts
  useEffect(() => {
    if (revealing) {
      setShuffledPlayers(() => {
        const players = [];
        teams.forEach((team, teamIdx) => {
          for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
            players.push({ teamIdx, slotIdx });
          }
        });
        return shuffle(players);
      });
    }
  }, [revealing, teams]);

  const n = Math.floor(roster.length / 5);
  const previewSlots = n > 0 ? n : Math.max(2, Math.ceil(10 / 5));

  useEffect(() => { setLeaders(Array(n).fill('')); }, [n]);

  const updateLeader = (i: number, val: string) => {
    const next = [...leaders]; next[i] = val; setLeaders(next);
  };

  const getPool = () => roster.filter(p => !leaders.filter(Boolean).includes(p));

  const handleForm = async () => {
    setErr('');
    const result = await formTeams(teamMode === 'leader' ? leaders : undefined);
    if (result.error) { setErr(result.error); return; }
    // Trigger reveal animation after teams arrive
    setRevealing(true);
  };

  const rosterOk = roster.length >= 10 && roster.length % 5 === 0;

  // Global slot index: team 0 slot 0 = 0, team 0 slot 1 = 1, team 1 slot 0 = 5, etc.
  const isVisible = (teamIdx: number, slotIdx: number) => {
    const player = shuffledPlayers.find(p => p.teamIdx === teamIdx && p.slotIdx === slotIdx);
    return shuffledPlayers.indexOf(player) < revealCount;
  };

  return (
    <div className="flex-1 flex flex-col w-full py-6 gap-5">
      <div>
        <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest t-text mb-1">Team Formation</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">5 players per team · {isAdmin ? 'Admin controls below' : 'View only — admin required to edit'}</p>
      </div>

      {!isAdmin && (
        <div className="t-surface border t-border rounded-2xl px-5 py-3 font-['DM_Mono'] text-sm t-muted flex items-center gap-2">
          🔒 <span>Admin access required to form or modify teams.</span>
        </div>
      )}

      <div className={`flex-1 flex flex-col gap-5 ${!isAdmin ? 'min-h-0' : ''}`}>
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 shrink-0">

            {/* Mode selector */}
            <div className="t-surface border t-border rounded-2xl p-5">
              <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">Formation Mode</h2>
              <div className="flex flex-col gap-3">
                {[
                  { id: 'leader', icon: '👑', label: 'Leader + Random', desc: 'Pick captains, fill rest randomly.' },
                  { id: 'random', icon: '🎲', label: 'Fully Random',    desc: 'All members assigned randomly.' },
                ].map(opt => (
                  <div
                    key={opt.id}
                    className="p-4 rounded-xl border-2 cursor-pointer transition-all"
                    style={{
                      borderColor: teamMode === opt.id ? 'var(--accent-red)' : 'var(--border)',
                      background:  teamMode === opt.id ? 'rgba(232,41,74,0.06)' : 'var(--bg-elevated)',
                    }}
                    onClick={() => setTeamMode(opt.id as 'leader' | 'random')}
                  >
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <div className="font-['DM_Mono'] text-sm font-bold t-text mb-0.5">{opt.label}</div>
                    <div className="font-['DM_Mono'] text-[11px] t-muted">{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Roster summary + actions */}
            <div className="t-surface border t-border rounded-2xl p-5 flex flex-col gap-4">
              <div>
                <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-3">Roster</h2>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-['Bebas_Neue'] font-bold" style={{ color: rosterOk ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {roster.length}
                  </div>
                  <div className="font-['DM_Mono'] text-xs t-muted">players · {n} team{n !== 1 ? 's' : ''} of 5</div>
                </div>
                {!rosterOk && (
                  <p className="font-['DM_Mono'] text-[11px] mt-2" style={{ color: 'var(--accent-red)' }}>
                    ⚠ Need at least 10 players in multiples of 5
                  </p>
                )}
              </div>
              {err && <p className="font-['DM_Mono'] text-xs" style={{ color: 'var(--accent-red)' }}>{err}</p>}
              <div className="flex gap-3 mt-auto">
                <button
                  className="flex-1 py-2.5 font-['DM_Mono'] font-bold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{ background: 'var(--accent-gold)', color: '#1a0f00' }}
                  onClick={handleForm}
                  disabled={!rosterOk}
                >
                  ✨ Form Teams
                </button>
                <button
                  className="px-4 py-2.5 font-['DM_Mono'] font-bold rounded-xl text-sm border transition-all t-muted cursor-pointer"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                  onClick={resetTeams}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Leader picker */}
            {teamMode === 'leader' && n >= 2 ? (
              <div className="t-surface border t-border rounded-2xl p-5">
                <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-1">Select Leaders</h2>
                <p className="font-['DM_Mono'] text-[11px] t-muted mb-4">
                  Pool: <span style={{ color: 'var(--accent-gold)' }}>{getPool().join(', ') || '—'}</span>
                </p>
                <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-48">
                  {Array.from({ length: n }, (_, i) => (
                    <div key={i} className="t-elevated border t-border rounded-xl p-3">
                      <h4 className="font-['Bebas_Neue'] text-sm tracking-widest mb-2" style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}>
                        Team {i + 1}
                      </h4>
                      <select
                        className="w-full rounded-lg px-2 py-1.5 text-sm outline-not- border transition-colors cursor-pointer"
                        style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-mid)', color: 'var(--text)' }}
                        value={leaders[i] ?? ''}
                        onChange={e => updateLeader(i, e.target.value)}
                      >
                        <option value="">— Pick —</option>
                        {roster.map(p => (
                          <option key={p} value={p} disabled={leaders.some((l, j) => j !== i && l === p)}>{p}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="t-surface border t-border rounded-2xl p-5 flex items-center justify-center">
                <p className="font-['DM_Mono'] text-xs t-dim text-center">
                  {teamMode === 'random' ? 'Fully random — no leaders needed.' : 'Need 2+ teams to pick leaders.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Teams grid */}
        <div className="flex-1 t-surface border t-border rounded-2xl p-5 min-h-0 overflow-y-auto">
          <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">
            {teams.length > 0 ? '🛡 Teams' : `Preview — ${previewSlots} team${previewSlots !== 1 ? 's' : ''}`}
          </h2>

          {teams.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {teams.map((t, teamIdx) => (
                <div key={t.name} className="rounded-xl border p-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderTopColor: t.color, borderTopWidth: 3 }}>
                  <h3 className="font-['Bebas_Neue'] text-xl tracking-wide mb-3 pb-2 border-b" style={{ color: t.color, borderColor: 'var(--border)' }}>{t.name}</h3>
                  {t.members.map((m, slotIdx) => {
                    const visible = !revealing && revealCount === 0
                      ? true  // already done, show all
                      : isVisible(teamIdx, slotIdx);
                    return (
                      <div
                        key={m}
                        className="flex items-center justify-between py-1.5 font-['DM_Mono'] text-sm transition-all duration-200"
                        style={{
                          color: m === t.leader ? 'var(--accent-gold)' : 'var(--text-muted)',
                          opacity: visible ? 1 : 0,
                          transform: visible ? 'translateX(0)' : 'translateX(-8px)',
                        }}
                      >
                        <span className="w-5 shrink-0">{m === t.leader ? '👑' : '·'}</span>
                        <span className="flex-1 truncate">{m}</span>
                        {isAdmin && m !== t.leader && (
                          <button
                            onClick={() => assignLeader(t.name, m)}
                            className="ml-2 px-2 py-0.5 text-xs font-['DM_Mono'] bg-[var(--accent-green)] text-white rounded hover:opacity-80 transition-opacity cursor-pointer"
                            title="Make team leader"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            // Preview — static empty slots, no animation
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: previewSlots }, (_, i) => (
                <div key={i} className="rounded-xl border-2 border-dashed p-4" style={{ borderColor: TEAM_COLORS[i % TEAM_COLORS.length] + '55' }}>
                  <div className="font-['Bebas_Neue'] text-base tracking-widest mb-3" style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}>Team {i + 1}</div>
                  {Array.from({ length: 5 }, (__, j) => (
                    <div key={j} className="flex items-center gap-2 py-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TEAM_COLORS[i % TEAM_COLORS.length] + '40' }} />
                      <div className="h-2 rounded" style={{ width: `${50 + (j * 17 + i * 11) % 35}%`, background: TEAM_COLORS[i % TEAM_COLORS.length] + '30' }} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}