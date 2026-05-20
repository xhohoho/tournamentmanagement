'use client';

import { useState, useEffect, useRef } from 'react';
import { useTourney } from '@/lib/context';
import { TEAM_COLORS } from '@/lib/utils';

const SLOT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789?!@#$%';

function SlotMachine({ finalName, delay, done }: { finalName: string; delay: number; done: boolean }) {
  const [display, setDisplay] = useState('???');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (done) return;
    const timeout = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setDisplay(Array.from({ length: Math.max(3, finalName.length) }, () =>
          SLOT_CHARS[Math.floor(Math.random() * SLOT_CHARS.length)]
        ).join(''));
      }, 60);
    }, delay);
    return () => { clearTimeout(timeout); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [done, delay, finalName]);

  useEffect(() => {
    if (done) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplay(finalName);
    }
  }, [done, finalName]);

  return <span>{display}</span>;
}

// Cycles through roster names randomly for an empty slot preview
function AnimatedSlotName({ names }: { names: string[] }) {
  const [idx, setIdx] = useState(0);
  const [chars, setChars] = useState('??????');
  const phaseRef = useRef<'scramble' | 'show'>('scramble');
  const tickRef = useRef(0);

  useEffect(() => {
    if (!names.length) return;
    const name = names[idx % names.length];
    phaseRef.current = 'scramble';
    tickRef.current = 0;
    let scrambleCount = 0;
    const iv = setInterval(() => {
      if (phaseRef.current === 'scramble') {
        setChars(Array.from({ length: Math.max(4, name.length) }, () =>
          SLOT_CHARS[Math.floor(Math.random() * SLOT_CHARS.length)]
        ).join(''));
        scrambleCount++;
        if (scrambleCount > 12) {
          phaseRef.current = 'show';
          setChars(name);
          setTimeout(() => {
            setIdx(i => (i + 1) % names.length);
          }, 1400);
        }
      }
    }, 55);
    return () => clearInterval(iv);
  }, [idx, names]);

  return <span style={{ opacity: 0.45 }}>{chars}</span>;
}

export function TeamsTab({ lightMode }: { lightMode?: boolean }) {
  const { roster, teams, teamMode, isAdmin, formTeams, resetTeams, setTeamMode, assignLeader } = useTourney();
  const [leaders, setLeaders] = useState<string[]>([]);
  const [animating, setAnimating] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [err, setErr] = useState('');
  const [leaderAssignments, setLeaderAssignments] = useState<Record<string, string>>({});
  const [animatingSlots, setAnimatingSlots] = useState<{teamIdx: number, slotIdx: number, playerName: string}[]>([]);

  const n = Math.floor(roster.length / 5);
  const slots = n > 0 ? n : Math.max(2, Math.ceil(10 / 5));

  useEffect(() => {
    setLeaders(Array(n).fill(''));
  }, [n]);

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
    setAnimating(true);
    setRevealedCount(0);
    const result = await formTeams(teamMode === 'leader' ? leaders : undefined);
    if (result.error) { setErr(result.error); setAnimating(false); return; }
  };

  const startSlotAnimation = (teamIdx: number, playerName: string) => {
    setAnimatingSlots(prev => [...prev, { teamIdx, slotIdx: playerName.length, playerName }]);
  };

  // Build flat slot list for animation
  const allSlots: { name: string; team: string; color: string; isLeader: boolean }[] = [];
  teams.forEach(t => {
    t.members.forEach(m => {
      allSlots.push({ name: m, team: t.name, color: t.color, isLeader: m === t.leader });
    });
  });

  // Initialize leaderAssignments from existing teams
  useEffect(() => {
    const initialAssignments: Record<string, string> = {};
    teams.forEach(team => {
      if (team.leader) {
        initialAssignments[team.name] = team.leader;
      }
    });
    setLeaderAssignments(initialAssignments);
  }, [teams]);

  return (
    <div className={`min-h-[calc(100vh-120px)] t-bg ${lightMode ? 'light' : ''}`}>
    <div className="max-w-6xl mx-auto px-6 py-8">

      {/* Animation overlay */}
      {animating && teams.length > 0 && (
        <div
          className=""
          style={{ background: 'rgba(8,8,16,0.95)' }}
        >
          <div className="font-['Bebas_Neue'] text-5xl tracking-widest" style={{ color: 'var(--accent)' }}>
            FORMING TEAMS
          </div>
          <p className="font-['DM_Mono'] text-xs" style={{ color: 'var(--text-muted)' }}>Dealing players…</p>
          <div className="flex flex-wrap gap-3 justify-center max-w-2xl px-4">
            {allSlots.map((slot, i) => (
              <div
                key={i}
                className="px-4 py-2.5 rounded-xl font-['DM_Mono'] text-sm border transition-all duration-300"
                style={{
                  borderColor: i < revealedCount ? (slot.isLeader ? 'var(--accent-gold)' : slot.color) : 'var(--border-mid)',
                  color: i < revealedCount ? (slot.isLeader ? 'var(--accent-gold)' : slot.color) : 'var(--text-dim)',
                  background: i < revealedCount
                    ? (slot.isLeader ? 'rgba(255,176,32,0.08)' : `${slot.color}15`)
                    : 'var(--bg-elevated)',
                  transform: i < revealedCount ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(8px)',
                  opacity: i < revealedCount ? 1 : 0.3,
                }}
              >
                {slot.isLeader ? '👑 ' : ''}
                {i < revealedCount
                  ? slot.name
                  : <SlotMachine finalName={slot.name} delay={i * 120} done={i < revealedCount} />
                }
                <span className="ml-2 text-[10px] opacity-60">→ {slot.team}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest t-text mb-1">Team Formation</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">5 players per team · Admin required</p>
      </div>

      {!isAdmin ? (
        <div className="t-surface border t-border rounded-2xl px-5 py-4 font-['DM_Mono'] text-sm t-muted">
          🔒 Admin access required to form teams.
          {teams.length > 0 && <TeamsGrid teams={teams} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Config panel */}
          <div className="lg:col-span-1 flex flex-col gap-4">
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
                      background: teamMode === opt.id ? 'rgba(255,61,90,0.07)' : 'var(--bg-elevated)',
                    }}
                    onClick={() => setTeamMode(opt.id as 'leader' | 'random')}
                  >
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <div className="font-['DM_Mono'] text-sm font-bold t-text mb-0.5">{opt.label}</div>
                    <div className="font-['DM_Mono'] text-[11px] t-muted leading-snug">{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Roster summary */}
            <div className="t-surface border t-border rounded-2xl p-5">
              <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-3">Roster</h2>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="text-3xl font-['Bebas_Neue'] font-bold"
                  style={{ color: roster.length >= 10 && roster.length % 5 === 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}
                >
                  {roster.length}
                </div>
                <div className="font-['DM_Mono'] text-xs t-muted">
                  players · {n} team{n !== 1 ? 's' : ''} of 5
                </div>
              </div>
              {roster.length < 10 && (
                <p className="font-['DM_Mono'] text-[11px]" style={{ color: 'var(--accent-red)' }}>
                  ⚠ Need at least 10 players (multiples of 5)
                </p>
              )}
            </div>

            {err && <p className="font-['DM_Mono'] text-xs" style={{ color: 'var(--accent-red)' }}>{err}</p>}

            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 font-['DM_Mono'] font-bold rounded-xl text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent-gold)', color: '#1a0f00', cursor: 'pointer' }}
                onClick={handleForm}
                disabled={roster.length < 10 || roster.length % 5 !== 0}
              >
                ✨ Form Teams
              </button>
              <button
                className="px-4 py-2.5 font-['DM_Mono'] font-bold rounded-xl text-sm border transition-all t-muted"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                onClick={resetTeams}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Leader picker + team slots preview */}
          <div className="lg:col-span-2">
            {teamMode === 'leader' && n >= 2 && (
              <div className="t-surface border t-border rounded-2xl p-5 mb-4">
                <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-1">Select Leaders</h2>
                <p className="font-['DM_Mono'] text-[11px] t-muted mb-4">
                  Pool: <span style={{ color: 'var(--accent-gold)' }}>{getPool().join(', ') || '—'}</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: n }, (_, i) => (
                    <div key={i} className="t-elevated border t-border rounded-xl p-3.5">
                      <h4
                        className="font-['Bebas_Neue'] text-base tracking-widest mb-2"
                        style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}
                      >
                        Team {i + 1}
                      </h4>
                      <select
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none border transition-colors"
                        style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-mid)', color: 'var(--text)', cursor: 'pointer' }}
                        value={leaders[i] ?? ''}
                        onChange={e => updateLeader(i, e.target.value)}
                        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
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
              </div>
            )}

            {/* Team slot preview / formed teams */}
            <div className="t-surface border t-border rounded-2xl p-5">
              <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">
                {teams.length > 0 ? '🛡 Teams' : `Team Slots — ${n > 0 ? n : Math.max(2, Math.ceil(10/5))} team${(n > 0 ? n : 2) !== 1 ? 's' : ''}`}
              </h2>

              {teams.length > 0 ? (
                <div className="space-y-4">
                  <TeamsGrid teams={teams} />
                  {teamMode === 'random' && isAdmin && (
                    <div className="t-surface border t-border rounded-2xl p-5">
                      <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">
                        Assign Leaders
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {teams.map(team => (
                          <div
                            key={team.name}
                            className="t-elevated border t-border rounded-xl p-3.5"
                            style={{ borderColor: team.color }}
                          >
                            <h4
                              className="font-['Bebas_Neue'] text-base tracking-widest mb-2"
                              style={{ color: team.color }}
                            >
                              {team.name}
                            </h4>
                            <select
                              className="w-full rounded-lg px-3 py-2 text-sm outline-none border transition-colors"
                              style={{
                                background: 'var(--bg-hover)',
                                borderColor: leaderAssignments[team.name] ? team.color : 'var(--border-mid)',
                                color: 'var(--text)',
                                cursor: 'pointer'
                              }}
                              value={leaderAssignments[team.name] || ''}
                              onChange={e => {
                                const newAssignments = { ...leaderAssignments, [team.name]: e.target.value };
                                setLeaderAssignments(newAssignments);
                                if (e.target.value) {
                                  assignLeader(team.name, e.target.value);
                                }
                              }}
                              onFocus={e => (e.currentTarget.style.borderColor = team.color)}
                              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
                            >
                              <option value="">— Pick Leader —</option>
                              {roster.map(p => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Array.from({ length: slots }, (_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border-2 border-dashed p-4"
                      style={{ borderColor: TEAM_COLORS[i % TEAM_COLORS.length] + '55' }}
                    >
                      <div
                        className="font-['Bebas_Neue'] text-base tracking-widest mb-3"
                        style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}
                      >
                        Team {i + 1}
                      </div>
                      {Array.from({ length: 5 }, (_, j) => (
                        <div key={j} className="flex items-center gap-2 py-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: TEAM_COLORS[i % TEAM_COLORS.length] + '40' }}
                          />
                          <div className="font-['DM_Mono'] text-xs" style={{ color: TEAM_COLORS[i % TEAM_COLORS.length] }}>
                            {roster.length > 0 ? (
                              <AnimatedSlotName names={roster} />
                            ) : (
                              <div
                                className="h-2.5 rounded-full animate-pulse"
                                style={{
                                  background: TEAM_COLORS[i % TEAM_COLORS.length] + '25',
                                  width: `${50 + ((i * 5 + j) % 4) * 12}%`,
                                }}
                              />
                            )}
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
      )}
    </div>
    </div>
  );
}

function TeamsGrid({ teams }: { teams: ReturnType<typeof useTourney>['teams'] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
      {teams.map((t) => (
        <div
          key={t.name}
          className="rounded-xl border p-4"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            borderTopColor: t.color,
            borderTopWidth: 3,
          }}
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-['Bebas_Neue'] text-xl tracking-wide" style={{ color: t.color }}>{t.name}</h3>
          </div>
          {t.members.map(m => (
            <div
              key={m}
              className="flex items-center gap-2 py-1.5 font-['DM_Mono'] text-sm"
              style={{ color: m === t.leader ? 'var(--accent-gold)' : 'var(--text-muted)' }}
            >
              <span className="w-5">{m === t.leader ? '👑' : '·'}</span>
              {m}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
