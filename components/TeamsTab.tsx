'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

// ─── Popover state ────────────────────────────────────────────────────────────
interface PopoverTarget {
  teamId: string;
  teamColor: string;
  member: string;
  isLeader: boolean;
  hasReplacement: boolean;
  anchorRect: DOMRect;
}

// ─── Sub-in popover component ─────────────────────────────────────────────────
function SubPopover({
  target,
  onClose,
  onAssignLeader,
  onAddReplacement,
  onRemoveReplacement,
}: {
  target: PopoverTarget;
  onClose: () => void;
  onAssignLeader: () => Promise<void>;
  onAddReplacement: (name: string) => Promise<void>;
  onRemoveReplacement: () => Promise<void>;
}) {
  const [subName, setSubName] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Position: below the row, left-aligned, but keep inside viewport
  const style = (() => {
    const PAD = 8;
    const W = 220;
    const { left, bottom, top } = target.anchorRect;
    const vh = window.innerHeight;
    const spaceBelow = vh - bottom;
    const placeAbove = spaceBelow < 160 && top > 160;
    return {
      position: 'fixed' as const,
      width: W,
      left: Math.min(left, window.innerWidth - W - PAD),
      ...(placeAbove ? { bottom: vh - top + 4 } : { top: bottom + 4 }),
      zIndex: 9999,
    };
  })();

  // Close on outside click or Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSub = async () => {
    if (!subName.trim()) return;
    setBusy(true);
    await onAddReplacement(subName.trim());
    setBusy(false);
    onClose();
  };

  const handleLeader = async () => {
    setBusy(true);
    await onAssignLeader();
    setBusy(false);
    onClose();
  };

  const handleRemove = async () => {
    setBusy(true);
    await onRemoveReplacement();
    setBusy(false);
    onClose();
  };

  return (
    <div
      ref={popRef}
      style={style}
      className="rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
      onClick={e => e.stopPropagation()}
      // Prevent the popover from closing when interacting inside
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between shrink-0"
        style={{ background: target.teamColor + '18', borderBottom: `1px solid ${target.teamColor}30` }}
      >
        <span
          className="font-['DM_Mono'] text-xs font-bold truncate"
          style={{ color: target.teamColor }}
        >{target.member}</span>
        <button
          onClick={onClose}
          className="shrink-0 ml-2 opacity-40 hover:opacity-80 cursor-pointer transition-opacity"
          style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', lineHeight: 1 }}
        >✕</button>
      </div>

      {/* Body */}
      <div
        className="flex flex-col gap-2 p-3"
        style={{ background: 'var(--bg-surface, var(--bg-elevated))' }}
      >
        {/* Make leader — only for non-leaders */}
        {!target.isLeader && (
          <button
            disabled={busy}
            onClick={handleLeader}
            className="w-full py-1.5 rounded-xl font-['DM_Mono'] text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent-gold)', color: '#1a0f00' }}
          >👑 Make Captain</button>
        )}

        {/* Replacement section */}
        {target.hasReplacement ? (
          <button
            disabled={busy}
            onClick={handleRemove}
            className="w-full py-1.5 rounded-xl font-['DM_Mono'] text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 border"
            style={{ background: 'transparent', color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
          >✕ Undo Replacement</button>
        ) : (
          <>
            <p className="font-['DM_Mono'] text-[10px] t-muted -mb-1">Sub-in player name</p>
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                value={subName}
                onChange={e => setSubName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSub(); }}
                placeholder="Replacement name…"
                className="flex-1 min-w-0 rounded-lg px-2 py-1.5 font-['DM_Mono'] text-xs outline-none border"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-mid)',
                  color: 'var(--text)',
                }}
              />
              <button
                disabled={!subName.trim() || busy}
                onClick={handleSub}
                className="shrink-0 px-3 py-1.5 rounded-lg font-['DM_Mono'] text-xs font-bold cursor-pointer disabled:opacity-30 transition-opacity"
                style={{ background: 'var(--accent-green)', color: '#fff' }}
              >{busy ? '…' : '↵'}</button>
            </div>
          </>
        )}
      </div>
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

  // Popover
  const [popover, setPopover] = useState<PopoverTarget | null>(null);

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

  const handleReset = async () => {
    await resetTeams();
    setLeaders(Array(n).fill(''));
    setErr('');
    setPopover(null);
  };

  const handleForm = async () => {
    setErr('');
    setRevealing(false);
    setForming(true);
    setPopover(null);
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

  const openPopover = useCallback((
    e: React.MouseEvent,
    teamId: string,
    teamColor: string,
    member: string,
    isLeader: boolean,
    hasReplacement: boolean,
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ teamId, teamColor, member, isLeader, hasReplacement, anchorRect: rect });
  }, []);

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

                      {/* Name edit buttons — shown when not in edit mode */}
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

                        return (
                          <div
                            key={m}
                            className="transition-all duration-200"
                            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(-8px)' }}
                          >
                            {/* Player row — clickable by admin */}
                            <div
                              className={`flex items-center gap-1 rounded-lg px-1 ${isAdmin ? 'cursor-pointer hover:bg-white/5 active:bg-white/10' : ''} transition-colors`}
                              style={{
                                color: isLeader ? 'var(--accent-gold)' : 'var(--text-muted)',
                                fontSize: 'clamp(9px, 0.75vw, 13px)',
                                paddingTop: 2,
                                paddingBottom: 2,
                              }}
                              onClick={isAdmin
                                ? e => openPopover(e, t.name, t.color, m, isLeader, !!replacement)
                                : undefined
                              }
                              title={isAdmin ? 'Click to manage player' : undefined}
                            >
                              <span className="shrink-0 w-4">{isLeader ? '👑' : '·'}</span>
                              <span
                                className="flex-1 truncate font-['DM_Mono']"
                                style={replacement ? { textDecoration: 'line-through', opacity: 0.4 } : {}}
                              >{m}</span>
                              {/* Subtle indicator that there's a replacement or it's manageable */}
                              {replacement && (
                                <span style={{ fontSize: 8, color: 'var(--accent-green)', opacity: 0.7 }}>↳</span>
                              )}
                            </div>

                            {/* Replacement name shown inline below, indented */}
                            {replacement && (
                              <div
                                className="flex items-center gap-1 pl-5"
                                style={{ fontSize: 'clamp(8px, 0.7vw, 11px)', color: 'var(--accent-green)' }}
                              >
                                <span style={{ opacity: 0.6 }}>↳</span>
                                <span className="font-['DM_Mono'] truncate">{replacement}</span>
                              </div>
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
            /* Leader mode skeleton */
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
            /* Plain skeleton */
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

      {/* ── Floating popover ── */}
      {popover && isAdmin && (
        <SubPopover
          target={popover}
          onClose={() => setPopover(null)}
          onAssignLeader={async () => {
            const r = await assignLeader(popover.teamId, popover.member);
            if (r?.error) setErr(r.error);
          }}
          onAddReplacement={async (name) => {
            const r = await addReplacement(popover.teamId, popover.member, name);
            if (r?.error) setErr(r.error);
          }}
          onRemoveReplacement={async () => {
            const r = await removeReplacement(popover.teamId, popover.member);
            if (r?.error) setErr(r.error);
          }}
        />
      )}
    </div>
  );
}
