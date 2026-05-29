'use client';

import { useState, useEffect, useRef } from 'react';
import { useTourney } from '@/lib/context';
import { TEAM_COLORS } from '@/lib/utils';

// How many players have been "revealed" so far after form
function useReveal(active: boolean, total: number, intervalMs = 120) {
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

export function TeamsTab() {
  const { roster, teams, teamMode, isAdmin, loading, formTeams, resetTeams, setTeamMode, assignLeader } = useTourney();
  const [leaders, setLeaders] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [forming, setForming] = useState(false);

  const totalSlots = teams.length * 5;
  const revealCount = useReveal(revealing, totalSlots);

  const revealOrderMap = useRef<Map<string, number>>(new Map());

  const seedRevealOrder = (newTeams: typeof teams) => {
    const allMembers = newTeams.flatMap(t => t.members);
    const orderIndices = Array.from({ length: allMembers.length }, (_, i) => i);
    for (let i = orderIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orderIndices[i], orderIndices[j]] = [orderIndices[j], orderIndices[i]];
    }
    const map = new Map<string, number>();
    allMembers.forEach((member, index) => { map.set(member, orderIndices[index]); });
    revealOrderMap.current = map;
  };

  useEffect(() => {
    if (revealing && revealCount >= totalSlots && totalSlots > 0) setRevealing(false);
  }, [revealing, revealCount, totalSlots]);

  const n = Math.floor(roster.length / 5);
  const previewSlots = n > 0 ? n : Math.max(2, Math.ceil(10 / 5));

  useEffect(() => { setLeaders(Array(n).fill('')); }, [n]);

  const updateLeader = (i: number, val: string) => {
    const next = [...leaders]; next[i] = val; setLeaders(next);
  };

  const getPool = () => roster.filter(p => !leaders.filter(Boolean).includes(p));

  const handleForm = async () => {
    setErr('');
    setRevealing(false);
    setForming(true);
    const result = await formTeams(teamMode === 'leader' ? leaders : undefined);
    setForming(false);
    if (result.error) { setErr(result.error); return; }
    if (result.teams) seedRevealOrder(result.teams);
    setRevealing(true);
  };

  const rosterOk = roster.length >= 10 && roster.length % 5 === 0;

  const isVisible = (member: string) => {
    if (!revealing && revealCount === 0) return true;
    const assignedIndex = revealOrderMap.current.get(member) ?? 0;
    return assignedIndex < revealCount;
  };

  if (loading) return (
    <div className="flex-1 flex flex-col w-full py-6 gap-5 animate-pulse">
      <div className="h-10 w-32 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-4 w-64 rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
      {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-2xl" style={{ background: 'var(--bg-elevated)', opacity: 1 - i * 0.2 }} />)}
    </div>
  );

  const showLeaderPicker = isAdmin && teamMode === 'leader' && n >= 2;

  // Teams grid column count
  const teamCols = teams.length > 0
    ? Math.min(teams.length, Math.ceil(Math.sqrt(teams.length * 1.5)))
    : Math.min(previewSlots, Math.ceil(Math.sqrt(previewSlots * 1.5)));

  return (
    <div className="flex-1 flex flex-col w-full py-4 gap-3 min-h-0">
      {/* Header */}
      <div>
        <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Team Formation</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">5 players per team · {isAdmin ? 'Admin controls below' : 'View only — admin required to edit'}</p>
      </div>

      {/* Main layout: left column (controls) + right column (teams) */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* LEFT: Admin controls — fixed width, doesn't squish */}
        {isAdmin && (
          <div className="flex flex-col gap-3 shrink-0 w-72">

            {/* Formation Mode */}
            <div className="t-surface border t-border rounded-2xl p-4">
              <h2 className="font-['Bebas_Neue'] text-base tracking-widest t-text mb-3">Formation Mode</h2>
              <div className="flex flex-col gap-2">
                {[
                  { id: 'leader', icon: '👑', label: 'Leader + Random', desc: 'Pick captains, fill rest randomly.' },
                  { id: 'random', icon: '🎲', label: 'Fully Random',    desc: 'All members assigned randomly.' },
                ].map(opt => (
                  <div
                    key={opt.id}
                    className="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                    style={{
                      borderColor: teamMode === opt.id ? 'var(--accent-red)' : 'var(--border)',
                      background:  teamMode === opt.id ? 'rgba(232,41,74,0.06)' : 'var(--bg-elevated)',
                    }}
                    onClick={() => setTeamMode(opt.id as 'leader' | 'random')}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                    <div>
                      <div className="font-['DM_Mono'] text-xs font-bold t-text leading-tight">{opt.label}</div>
                      <div className="font-['DM_Mono'] text-[10px] t-muted leading-relaxed mt-0.5">{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Roster + Actions */}
            <div className="t-surface border t-border rounded-2xl p-4 flex flex-col gap-3">
              <div>
                <h2 className="font-['Bebas_Neue'] text-base tracking-widest t-text mb-2">Roster</h2>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-['Bebas_Neue'] font-bold" style={{ color: rosterOk ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {roster.length}
                  </div>
                  <div className="font-['DM_Mono'] text-xs t-muted">players · {n} team{n !== 1 ? 's' : ''} of 5</div>
                </div>
                {!rosterOk && (
                  <p className="font-['DM_Mono'] text-[10px] mt-1.5" style={{ color: 'var(--accent-red)' }}>
                    ⚠ Need ≥10 players, multiples of 5
                  </p>
                )}
              </div>
              {err && <p className="font-['DM_Mono'] text-[10px]" style={{ color: 'var(--accent-red)' }}>{err}</p>}
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 font-['DM_Mono'] font-bold rounded-xl text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{ background: 'var(--accent-gold)', color: '#1a0f00' }}
                  onClick={handleForm}
                  disabled={!rosterOk || forming}
                >
                  {forming ? '⏳ Forming…' : '✨ Form Teams'}
                </button>
                <button
                  className="px-3 py-2 font-['DM_Mono'] font-bold rounded-xl text-xs border transition-all t-muted cursor-pointer"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                  onClick={resetTeams}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Leader Picker */}
            {showLeaderPicker ? (
              <div className="t-surface border t-border rounded-2xl p-4 flex-1 overflow-y-auto min-h-0">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div>
                    <h2 className="font-['Bebas_Neue'] text-base tracking-widest t-text mb-0.5">Select Leaders</h2>
                    <p className="font-['DM_Mono'] text-[10px] t-muted">
                      Pool: <span style={{ color: 'var(--accent-gold)' }}>{getPool().join(', ') || '—'}</span>
                    </p>
                  </div>
                  <span className="font-['DM_Mono'] text-[10px] t-dim shrink-0 mt-0.5">{leaders.filter(Boolean).length}/{n}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {Array.from({ length: n }, (_, i) => (
                    <div key={i} className="t-elevated border t-border rounded-xl p-2.5 flex items-center gap-2">
                      <span className="font-['Bebas_Neue'] text-xs tracking-widest shrink-0 w-14" style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}>
                        Team {i + 1}
                      </span>
                      <select
                        className="flex-1 rounded-lg px-2 py-1 text-xs outline-none border transition-colors cursor-pointer min-w-0"
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
            ) : teamMode !== 'random' && (
              <p className="font-['DM_Mono'] text-[10px] t-dim px-1">
                ℹ Add ≥10 players (2 teams of 5) to enable leader picking.
              </p>
            )}

          </div>
        )}

        {/* RIGHT: Teams grid — takes all remaining space */}
        <div className="flex-1 t-surface border t-border rounded-2xl p-4 min-h-0 overflow-hidden flex flex-col">
          <h2 className="font-['Bebas_Neue'] text-lg tracking-widest t-text mb-3 shrink-0">
            {teams.length > 0 ? '🛡 Teams' : `Preview — ${previewSlots} team${previewSlots !== 1 ? 's' : ''}`}
          </h2>

          {teams.length > 0 ? (
            <div
              className="flex-1 min-h-0"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${teamCols}, minmax(0, 1fr))`,
                gap: '10px',
                alignContent: 'stretch',
              }}
            >
              {teams.map((t) => (
                <div
                  key={t.name}
                  className="rounded-xl border flex flex-col min-h-0 overflow-hidden"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderTopColor: t.color, borderTopWidth: 3 }}
                >
                  <h3
                    className="font-['Bebas_Neue'] tracking-wide px-3 pt-2 pb-1.5 border-b shrink-0"
                    style={{ color: t.color, borderColor: 'var(--border)', fontSize: 'clamp(12px, 1.1vw, 18px)' }}
                  >{t.name}</h3>
                  <div className="flex-1 flex flex-col justify-around px-2 py-1">
                    {t.members.map((m) => {
                      const visible = isVisible(m);
                      return (
                        <div
                          key={m}
                          className="flex items-center gap-1 transition-all duration-200"
                          style={{
                            color: m === t.leader ? 'var(--accent-gold)' : 'var(--text-muted)',
                            opacity: visible ? 1 : 0,
                            transform: visible ? 'translateX(0)' : 'translateX(-8px)',
                            fontSize: 'clamp(9px, 0.75vw, 13px)',
                          }}
                        >
                          <span className="shrink-0 w-4">{m === t.leader ? '👑' : '·'}</span>
                          <span className="flex-1 truncate font-['DM_Mono']">{m}</span>
                          {isAdmin && (
                            m === t.leader ? (
                              <span className="shrink-0 opacity-60" style={{ color: 'var(--accent-gold)', fontSize: 10 }}>👑</span>
                            ) : (
                              <button
                                onClick={async () => { setErr(''); const r = await assignLeader(t.name, m); if (r?.error) setErr(r.error); }}
                                className="shrink-0 px-1 py-0.5 font-['DM_Mono'] bg-[var(--accent-green)] text-white rounded hover:opacity-80 transition-opacity cursor-pointer"
                                style={{ fontSize: 9 }}
                                title="Make team leader"
                              >✓</button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="flex-1 min-h-0"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${teamCols}, minmax(0, 1fr))`,
                gap: '10px',
                alignContent: 'stretch',
              }}
            >
              {Array.from({ length: previewSlots }, (_, i) => (
                <div
                  key={i}
                  className="rounded-xl border flex flex-col min-h-0 overflow-hidden"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderTopColor: TEAM_COLORS[i % TEAM_COLORS.length], borderTopWidth: 3 }}
                >
                  <h3
                    className="font-['Bebas_Neue'] tracking-wide px-3 pt-2 pb-1.5 border-b shrink-0"
                    style={{ color: TEAM_COLORS[i % TEAM_COLORS.length], borderColor: 'var(--border)', fontSize: 'clamp(12px, 1.1vw, 18px)' }}
                  >Team {i + 1}</h3>
                  <div className="flex-1 flex flex-col justify-around px-2 py-1">
                    {Array.from({ length: 5 }, (__, j) => (
                      <div key={j} className="flex items-center gap-1 py-0.5">
                        <span className="w-4 shrink-0 t-dim" style={{ fontSize: 10 }}>·</span>
                        <div className="flex-1 h-1.5 rounded" style={{ background: 'var(--bg-hover)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
