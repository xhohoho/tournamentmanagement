'use client';

import { useState, useEffect, useRef } from 'react';
import { useTourney } from '@/lib/context';
import { TEAM_COLORS } from '@/lib/utils';

// ─── Reveal animation hook ────────────────────────────────────────────────────
function useReveal(active: boolean, total: number, intervalMs = 120) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) { setCount(0); return; }
    setCount(0);
    const iv = setInterval(() => {
      setCount(c => { if (c >= total) { clearInterval(iv); return c; } return c + 1; });
    }, intervalMs);
    return () => clearInterval(iv);
  }, [active, total, intervalMs]);
  return count;
}


// ─── SubInRow: inline substitute-player input ────────────────────────────────
interface SubInRowProps {
  teamId: string;
  member: string;
  onAdd: (teamId: string, member: string, name: string) => Promise<{ error?: string }>;
  onCancel: () => void;
}

function SubInRow({ teamId, member, onAdd, onCancel }: SubInRowProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 0); }, []);

  const handleSubmit = async () => {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    setErr('');
    const r = await onAdd(teamId, member, name);
    if (r?.error) { setErr(r.error); setBusy(false); }
  };

  return (
    <div
      className="flex items-center gap-1 pl-5 pr-1 py-0.5"
      style={{ fontSize: 'clamp(9px, 0.75vw, 12px)' }}
    >
      <span style={{ opacity: 0.5, color: 'var(--accent-green)' }}>↳</span>
      <input
        ref={inputRef}
        className="flex-1 min-w-0 bg-transparent border-b outline-none font-['DM_Mono'] t-text"
        style={{
          borderColor: err ? 'var(--accent-red)' : 'var(--border-mid)',
          fontSize: 'inherit',
          paddingBottom: 1,
        }}
        placeholder="sub-in name…"
        value={draft}
        onChange={e => { setDraft(e.target.value); setErr(''); }}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        disabled={busy}
      />
      <button
        onClick={handleSubmit}
        disabled={busy || !draft.trim()}
        className="shrink-0 px-1.5 py-0.5 rounded font-['DM_Mono'] font-bold transition-opacity disabled:opacity-30 cursor-pointer"
        style={{ fontSize: 9, background: 'var(--accent-green)', color: '#fff' }}
      >{busy ? '…' : '✓'}</button>
      {err && <span style={{ color: 'var(--accent-red)', fontSize: 8 }}>{err}</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TeamsTab() {
  const {
    roster, teams, teamMode, isAdmin, loading,
    formTeams, resetTeams, setTeamMode,
    assignLeader, renameTeam, setTeamNameFromLeader,
    addReplacement, removeReplacement,
  } = useTourney();

  const [leaders, setLeaders] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [forming, setForming] = useState(false);

  // Team name inline editing: teamId -> draft string | undefined (not editing)
  const [editingName, setEditingName] = useState<Record<string, string | undefined>>({});

  // Which player row has the sub-in input expanded: "teamId::member" | null
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  // Draft value for the currently expanded sub input
  const [subDraft, setSubDraft] = useState('');
  const subInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-focus the sub input whenever it opens
  useEffect(() => {
    if (expandedSub) {
      setSubDraft('');
      setTimeout(() => subInputRef.current?.focus(), 0);
    }
  }, [expandedSub]);

  const n = Math.floor(roster.length / 5);
  const previewSlots = n > 0 ? n : Math.max(2, Math.ceil(10 / 5));

  useEffect(() => { setLeaders(Array(n).fill('')); }, [n]);

  const updateLeader = (i: number, val: string) => {
    const next = [...leaders]; next[i] = val; setLeaders(next);
  };

  const handleReset = async () => {
    await resetTeams();
    setLeaders(Array(n).fill(''));
    setErr('');
    setExpandedSub(null);
  };

  const handleForm = async () => {
    setErr('');
    setRevealing(false);
    setForming(true);
    setExpandedSub(null);
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
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 rounded-2xl" style={{ background: 'var(--bg-elevated)', opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );

  const teamCols = teams.length > 0
    ? Math.min(teams.length, Math.ceil(Math.sqrt(teams.length * 1.5)))
    : Math.min(previewSlots, Math.ceil(Math.sqrt(previewSlots * 1.5)));

  const showCaptainSkeleton = isAdmin && teamMode === 'leader' && n >= 2 && teams.length === 0;

  return (
    <div className="flex-1 flex flex-col w-full py-4 gap-3 min-h-0">

      {/* Header */}
      <div>
        <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Team Formation</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">
          5 players per team · {isAdmin ? 'Admin controls below' : 'View only — admin required to edit'}
        </p>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* LEFT: Admin sidebar */}
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
                    Need at least 10 players, multiples of 5
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
                  {forming ? 'Forming...' : 'Form Teams'}
                </button>
                <button
                  className="px-3 py-2 font-['DM_Mono'] font-bold rounded-xl text-xs border transition-all t-muted cursor-pointer"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                  onClick={handleReset}
                >
                  Reset
                </button>
              </div>
            </div>

            {teamMode === 'leader' && n < 2 && (
              <p className="font-['DM_Mono'] text-[10px] t-dim px-1">
                Add at least 10 players (2 teams of 5) to pick captains.
              </p>
            )}

          </div>
        )}

        {/* RIGHT: Teams grid */}
        <div className="flex-1 t-surface border t-border rounded-2xl p-4 min-h-0 overflow-hidden flex flex-col">
          <h2 className="font-['Bebas_Neue'] text-lg tracking-widest t-text mb-3 shrink-0">
            {teams.length > 0
              ? 'Teams'
              : `Preview — ${previewSlots} team${previewSlots !== 1 ? 's' : ''}${teamMode === 'random' ? ' · Fully Random' : ''}`}
          </h2>

          {/* ── Formed teams ── */}
          {teams.length > 0 ? (
            <div
              className="flex-1 min-h-0 overflow-y-auto"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${teamCols}, minmax(0, 1fr))`,
                gap: '10px',
                alignContent: 'start',
              }}
            >
              {teams.map((t) => {
                const displayName = t.customName || t.name;
                const isEditingThisTeam = editingName[t.name] !== undefined;

                return (
                  <div
                    key={t.name}
                    className="rounded-xl border flex flex-col overflow-hidden"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderTopColor: t.color, borderTopWidth: 3 }}
                  >
                    {/* ── Team header ── */}
                    <div
                      className="px-3 pt-2 pb-1.5 border-b shrink-0 flex items-center gap-1"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {isAdmin && isEditingThisTeam ? (
                        <input
                          autoFocus
                          className="flex-1 min-w-0 bg-transparent outline-none font-['Bebas_Neue'] tracking-wide"
                          style={{ color: t.color, fontSize: 'clamp(12px, 1.1vw, 18px)' }}
                          value={editingName[t.name] ?? displayName}
                          onChange={e => setEditingName(prev => ({ ...prev, [t.name]: e.target.value }))}
                          onKeyDown={async e => {
                            if (e.key === 'Enter') {
                              const val = (editingName[t.name] ?? '').trim();
                              const r = await renameTeam(t.name, val);
                              if (r?.error) setErr(r.error);
                              setEditingName(prev => { const n = { ...prev }; delete n[t.name]; return n; });
                            } else if (e.key === 'Escape') {
                              setEditingName(prev => { const n = { ...prev }; delete n[t.name]; return n; });
                            }
                          }}
                          onBlur={async () => {
                            const val = (editingName[t.name] ?? '').trim();
                            const r = await renameTeam(t.name, val);
                            if (r?.error) setErr(r.error);
                            setEditingName(prev => { const n = { ...prev }; delete n[t.name]; return n; });
                          }}
                        />
                      ) : (
                        <h3
                          className="font-['Bebas_Neue'] tracking-wide flex-1 truncate"
                          style={{ color: t.color, fontSize: 'clamp(12px, 1.1vw, 18px)' }}
                        >{displayName}</h3>
                      )}

                      {isAdmin && !isEditingThisTeam && (
                        <div className="flex gap-0.5 shrink-0">
                          <button
                            onClick={() => setEditingName(prev => ({ ...prev, [t.name]: displayName }))}
                            className="px-1 py-0.5 rounded hover:opacity-100 transition-opacity cursor-pointer"
                            style={{ background: 'transparent', color: t.color, fontSize: 10, opacity: 0.5 }}
                            title="Edit team name"
                          >✏️</button>
                          {t.leader && (
                            <button
                              onClick={async () => { const r = await setTeamNameFromLeader(t.name); if (r?.error) setErr(r.error); }}
                              className="px-1 py-0.5 rounded hover:opacity-100 transition-opacity cursor-pointer"
                              style={{ background: 'transparent', fontSize: 10, opacity: 0.5, color: 'var(--accent-gold)' }}
                              title={`Set name to captain: ${t.leader}`}
                            >👑</button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Members list ── */}
                    <div className="flex flex-col px-2 py-1.5 gap-0.5">
                      {t.members.map((m) => {
                        const visible = isVisible(m);
                        const replacement = t.replacements?.[m];
                        const isLeader = m === t.leader;
                        const subKey = `${t.name}::${m}`;
                        const isSubExpanded = expandedSub === subKey;

                        return (
                          <div
                            key={m}
                            className="transition-all duration-200"
                            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(-8px)' }}
                          >
                            {/* Player row */}
                            <div
                              className="flex items-center gap-1 rounded px-1 py-0.5 group"
                              style={{
                                color: isLeader ? 'var(--accent-gold)' : 'var(--text-muted)',
                                fontSize: 'clamp(9px, 0.75vw, 13px)',
                              }}
                            >
                              <span className="shrink-0 w-4">{isLeader ? '👑' : '·'}</span>

                              {/* Name — strikethrough if replaced, with inline sub name */}
                              <span className="flex items-center gap-1 flex-1 min-w-0">
                                <span
                                  className="font-['DM_Mono'] truncate"
                                  style={replacement ? { textDecoration: 'line-through', opacity: 0.4 } : {}}
                                >{m}</span>
                                {replacement && (
                                  <span
                                    className="font-['DM_Mono'] truncate shrink-0"
                                    style={{ color: 'var(--accent-green)', fontSize: 'clamp(8px, 0.7vw, 11px)' }}
                                  >→ {replacement}</span>
                                )}
                              </span>

                              {/* Admin action buttons */}
                              {isAdmin && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {/* Make captain — only for non-leaders */}
                                  {!isLeader && (
                                    <button
                                      onClick={async () => { setErr(''); const r = await assignLeader(t.name, m); if (r?.error) setErr(r.error); }}
                                      className="px-1 py-0.5 font-['DM_Mono'] text-white rounded hover:opacity-80 transition-opacity cursor-pointer"
                                      style={{ fontSize: 9, background: 'var(--accent-green)' }}
                                      title="Make captain"
                                    >✓</button>
                                  )}

                                  {/* Sub button: toggle input / undo */}
                                  {replacement ? (
                                    <button
                                      onClick={async () => { const r = await removeReplacement(t.name, m); if (r?.error) setErr(r.error); }}
                                      className="px-1 py-0.5 rounded hover:opacity-80 transition-opacity cursor-pointer font-['DM_Mono']"
                                      style={{ fontSize: 9, color: 'var(--accent-red)', background: 'transparent' }}
                                      title="Undo replacement"
                                    >✕ sub</button>
                                  ) : (
                                    <button
                                      onClick={() => setExpandedSub(isSubExpanded ? null : subKey)}
                                      className="px-1 py-0.5 rounded hover:opacity-80 transition-opacity cursor-pointer font-['DM_Mono']"
                                      style={{
                                        fontSize: 9,
                                        background: isSubExpanded ? 'var(--accent-red)' : 'var(--bg-hover)',
                                        color: isSubExpanded ? '#fff' : 'var(--text-dim)',
                                      }}
                                      title="Sub out player"
                                    >{isSubExpanded ? '✕' : '⇄ sub'}</button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Sub-in input — expands below the row */}
                            {isAdmin && isSubExpanded && !replacement && (
                              <SubInRow
                                teamId={t.name}
                                member={m}
                                onAdd={async (tid, mem, name) => {
                                  const r = await addReplacement(tid, mem, name);
                                  if (r?.error) setErr(r.error);
                                  else setExpandedSub(null);
                                  return r ?? {};
                                }}
                                onCancel={() => setExpandedSub(null)}
                              />
                            )}


                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

          ) : showCaptainSkeleton ? (
            <div
              className="flex-1 min-h-0"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${teamCols}, minmax(0, 1fr))`,
                gap: '10px',
                alignContent: 'stretch',
              }}
            >
              {Array.from({ length: previewSlots }, (_, i) => {
                const color = TEAM_COLORS[i % TEAM_COLORS.length];
                const picked = leaders[i] ?? '';
                const available = roster.filter(p => !leaders.some((l, j) => j !== i && l === p));
                return (
                  <div
                    key={i}
                    className="rounded-xl border flex flex-col min-h-0 overflow-hidden"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderTopColor: color, borderTopWidth: 3 }}
                  >
                    <h3
                      className="font-['Bebas_Neue'] tracking-wide px-3 pt-2 pb-1.5 border-b shrink-0"
                      style={{ color, borderColor: 'var(--border)', fontSize: 'clamp(12px, 1.1vw, 18px)' }}
                    >Team {i + 1}</h3>
                    <div className="flex-1 flex flex-col justify-around px-2 py-1">
                      <div className="flex items-center gap-1 py-0.5">
                        <span className="shrink-0 w-4" style={{ fontSize: 10 }}>👑</span>
                        <select
                          className="flex-1 min-w-0 bg-transparent outline-none border-0 cursor-pointer font-['DM_Mono'] truncate"
                          style={{ color: picked ? color : 'var(--text-dim)', fontSize: 'clamp(9px, 0.75vw, 13px)' }}
                          value={picked}
                          onChange={e => updateLeader(i, e.target.value)}
                        >
                          <option value="">— pick captain —</option>
                          {available.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      {Array.from({ length: 4 }, (__, j) => (
                        <div key={j} className="flex items-center gap-1 py-0.5">
                          <span className="w-4 shrink-0 t-dim" style={{ fontSize: 10 }}>·</span>
                          <div className="flex-1 h-1.5 rounded" style={{ background: 'var(--bg-hover)' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
