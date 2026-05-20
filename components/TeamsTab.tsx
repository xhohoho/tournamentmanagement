'use client';

import { useState, useEffect, useRef } from 'react';
import { useTourney } from '@/lib/context';
import { TEAM_COLORS } from '@/lib/utils';

const SLOT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?!@#$%';

function SlotMachine({ finalName, delay }: { finalName: string; delay: number }) {
  const [display, setDisplay] = useState('???');
  const [done, setDone] = useState(false);
  const ivRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      ivRef.current = setInterval(() => {
        setDisplay(Array.from({ length: Math.max(3, finalName.length) }, () =>
          SLOT_CHARS[Math.floor(Math.random() * SLOT_CHARS.length)]
        ).join(''));
      }, 60);
      setTimeout(() => {
        if (ivRef.current) clearInterval(ivRef.current);
        setDisplay(finalName);
        setDone(true);
      }, 900 + delay);
    }, delay);
    return () => { clearTimeout(t); if (ivRef.current) clearInterval(ivRef.current); };
  }, [finalName, delay]);

  void done;
  return <span>{display}</span>;
}

function AnimatedSlotName({ names }: { names: string[] }) {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState('??????');

  useEffect(() => {
    if (!names.length) return;
    const name = names[idx % names.length];
    let count = 0;
    const iv = setInterval(() => {
      setChars(Array.from({ length: Math.max(4, name.length) }, () =>
        SLOT_CHARS[Math.floor(Math.random() * SLOT_CHARS.length)]
      ).join(''));
      if (++count > 12) {
        clearInterval(iv);
        setChars(name);
        setTimeout(() => setIdx(i => (i + 1) % names.length), 1400);
      }
    }, 55);
    return () => clearInterval(iv);
  }, [idx, names]);

  return <span style={{ opacity: 0.45 }}>{chars}</span>;
}

type AnimatingSlot = { teamIdx: number; slotIdx: number };

export function TeamsTab() {
  const { roster, teams, teamMode, isAdmin, formTeams, resetTeams, setTeamMode, assignLeader } = useTourney();
  const [leaders, setLeaders] = useState<string[]>([]);
  const [animatingSlots, setAnimatingSlots] = useState<AnimatingSlot[]>([]);
  const [err, setErr] = useState('');

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
    // Animate all slots briefly
    const slots: AnimatingSlot[] = [];
    teams.forEach((_, ti) => Array.from({ length: 5 }, (__, si) => slots.push({ teamIdx: ti, slotIdx: si })));
    setAnimatingSlots(slots);
    setTimeout(() => setAnimatingSlots([]), 2000);
  };

  const rosterOk = roster.length >= 10 && roster.length % 5 === 0;

  return (
    <div className="flex-1 flex flex-col w-full py-6 gap-5">

      <div>
        <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest t-text mb-1">Team Formation</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">5 players per team · {isAdmin ? 'Admin controls below' : 'View only — admin required to edit'}</p>
      </div>

      {/* View-only banner for non-admins */}
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
                        className="w-full rounded-lg px-2 py-1.5 text-sm outline-none border transition-colors cursor-pointer"
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

        {/* Teams grid — always visible */}
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
                    const isAnimating = animatingSlots.some(s => s.teamIdx === teamIdx && s.slotIdx === slotIdx);
                    return (
                      <div key={m} className="flex items-center justify-between py-1.5 font-['DM_Mono'] text-sm" style={{ color: m === t.leader ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                        <span className="w-5 shrink-0">{m === t.leader ? '👑' : '·'}</span>
                        <span className="flex-1 truncate">{isAnimating ? <SlotMachine finalName={m} delay={slotIdx * 120} /> : m}</span>
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: previewSlots }, (_, i) => (
                <div key={i} className="rounded-xl border-2 border-dashed p-4" style={{ borderColor: TEAM_COLORS[i % TEAM_COLORS.length] + '55' }}>
                  <div className="font-['Bebas_Neue'] text-base tracking-widest mb-3" style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}>Team {i + 1}</div>
                  {Array.from({ length: 5 }, (__, j) => (
                    <div key={j} className="flex items-center gap-2 py-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TEAM_COLORS[i % TEAM_COLORS.length] + '40' }} />
                      <div className="font-['DM_Mono'] text-xs" style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}>
                        {n > 0 ? <AnimatedSlotName names={roster} /> : <span className="opacity-30">—</span>}
                      </div>
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
