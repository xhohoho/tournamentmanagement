'use client';

import { useState, useMemo } from 'react';
import { useTourney } from '@/lib/context';

export function PlayersTab() {
  const {
    players, roster, isAdmin, loading,
    submitPlayer, removePlayer,
    addToRoster, removeFromRoster,
    setRoster, clearQueue, clearRoster,
  } = useTourney();

  const [nameInput, setNameInput] = useState('');
  const [nameStatus, setNameStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [qSearch, setQSearch] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [addAsAdmin, setAddAsAdmin] = useState(false);

  const filteredQueue = useMemo(() =>
    players.filter(p => p.name.toLowerCase().includes(qSearch.toLowerCase())),
    [players, qSearch]
  );

  const rosterValid = roster.length >= 10 && roster.length % 5 === 0;

  if (loading) return (
    <div className="flex-1 flex flex-col w-full py-4 gap-3 min-h-0 animate-pulse">
      <div className="h-7 w-48 rounded-lg shrink-0" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-9 w-full rounded-xl shrink-0" style={{ background: 'var(--bg-elevated)' }} />
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {[0, 1].map(col => (
          <div key={col} className="t-surface border t-border rounded-2xl p-3 flex flex-col gap-2">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="h-7 rounded-lg" style={{ background: 'var(--bg-elevated)', opacity: 1 - i * 0.08 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  const handleSubmit = async () => {
    const name = nameInput.trim();
    if (!name) return;
    const result = await submitPlayer(name, isAdmin && addAsAdmin);
    if (result.error) {
      setNameStatus({ text: `❌ ${result.error}`, ok: false });
    } else {
      setNameStatus({ text: `✓ "${name}" added!`, ok: true });
      setNameInput('');
    }
    setTimeout(() => setNameStatus(null), 2500);
  };

  const toggleRoster = async (name: string) => {
    if (!isAdmin) return;
    if (roster.includes(name)) await removeFromRoster(name);
    else await addToRoster(name);
  };

  const handleDragStart = (name: string) => setDragging(name);

  const handleDropOnRoster = async (e: React.DragEvent) => {
    e.preventDefault();
    const name = e.dataTransfer.getData('text/plain') || dragging;
    if (name && isAdmin && !roster.includes(name)) await addToRoster(name);
    setDragging(null);
  };

  const handleRosterDrop = async (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    if (!dragging || dragging === targetName) return;
    const newRoster = [...roster];
    const fromIdx = newRoster.indexOf(dragging);
    const toIdx   = newRoster.indexOf(targetName);
    if (fromIdx === -1 || toIdx === -1) return;
    newRoster.splice(fromIdx, 1);
    newRoster.splice(toIdx, 0, dragging);
    await setRoster(newRoster);
    setDragging(null);
  };

  return (
    <div className="flex-1 flex flex-col w-full py-3 gap-3 min-h-0">

      {/* Top bar: title + submit in one compact row */}
      <div className="shrink-0 flex items-center gap-3">
        <div className="shrink-0">
          <h1 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text leading-none">Player Registration</h1>
          <p className="font-['DM_Mono'] text-[10px] t-muted mt-0.5">
            {isAdmin ? 'Click to roster · Drag to reorder' : 'Submit your name to join the queue'}
          </p>
        </div>

        {/* Submit input — takes remaining space */}
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg px-3 py-2 font-['Syne'] text-sm outline-none transition-colors border"
            style={{ color: 'var(--text)', background: 'var(--bg-surface)', borderColor: 'var(--border-mid)' }}
            placeholder="Enter your name…"
            maxLength={24}
            autoComplete="off"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
          />
          {isAdmin && (
            <button
              className="px-2.5 py-2 font-['DM_Mono'] text-xs rounded-lg border transition-all cursor-pointer shrink-0"
              style={{
                borderColor: addAsAdmin ? 'var(--accent-gold)' : 'var(--border-mid)',
                color: addAsAdmin ? 'var(--accent-gold)' : 'var(--text-muted)',
                background: addAsAdmin ? 'rgba(224,144,16,0.08)' : 'var(--bg-elevated)',
              }}
              onClick={() => setAddAsAdmin(p => !p)}
              title="Toggle: Add as Admin"
            >👑</button>
          )}
          <button
            className="px-4 py-2 font-['DM_Mono'] font-bold rounded-lg text-sm active:scale-95 transition-all cursor-pointer shrink-0"
            style={{
              background: isAdmin && addAsAdmin ? 'var(--accent-gold)' : 'var(--accent)',
              color: isAdmin && addAsAdmin ? '#1a0f00' : 'white',
            }}
            onClick={handleSubmit}
          >
            {isAdmin && addAsAdmin ? '👑 Add' : 'Submit'}
          </button>
        </div>

        {nameStatus && (
          <span className="font-['DM_Mono'] text-xs shrink-0" style={{ color: nameStatus.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {nameStatus.text}
          </span>
        )}
      </div>

      {/* Dual panel — fills all remaining height */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">

        {/* ── Queue ── */}
        <div className="t-surface border t-border rounded-2xl flex flex-col shadow-sm overflow-hidden min-h-0">

          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b t-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-['Bebas_Neue'] text-base tracking-widest t-text">📋 Queue</span>
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-white text-[9px] font-bold" style={{ background: 'var(--accent-red)' }}>
                {players.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Inline search */}
              <div className="flex items-center gap-1 rounded-md px-2 py-1 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>
                <span className="text-[10px] t-dim">🔍</span>
                <input
                  type="text"
                  className="bg-transparent font-['DM_Mono'] text-[10px] outline-none t-text w-20"
                  placeholder="Search…"
                  value={qSearch}
                  onChange={e => setQSearch(e.target.value)}
                />
              </div>
              {isAdmin && players.length > 0 && (
                <button
                  className="font-['DM_Mono'] text-[9px] px-2 py-1 rounded-md border transition-colors cursor-pointer"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                  onClick={clearQueue}
                >Clear</button>
              )}
            </div>
          </div>

          {/* 2-column chip grid — scrolls internally */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {filteredQueue.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="font-['DM_Mono'] text-xs t-dim text-center">
                  {players.length === 0 ? 'No submissions yet.' : 'No matches.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {filteredQueue.map((p, i) => {
                  const inRoster = roster.includes(p.name);
                  return (
                    <div
                      key={p.name}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all select-none group"
                      style={{
                        cursor: isAdmin ? 'pointer' : 'default',
                        background: inRoster ? 'rgba(34,184,98,0.08)' : 'var(--bg-elevated)',
                        borderColor: inRoster ? 'rgba(34,184,98,0.5)' : 'var(--border)',
                      }}
                      draggable={isAdmin}
                      onDragStart={e => { e.dataTransfer.setData('text/plain', p.name); handleDragStart(p.name); }}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => toggleRoster(p.name)}
                    >
                      <span className="font-['DM_Mono'] text-[9px] w-4 text-right shrink-0 t-dim">{i + 1}</span>
                      <span className="flex-1 font-['DM_Mono'] text-[11px] font-medium truncate" style={{ color: inRoster ? 'var(--accent-green)' : 'var(--text)' }}>
                        {p.name}
                      </span>
                      {p.byAdmin && <span className="text-[9px] shrink-0" title="Added by admin">👑</span>}
                      {inRoster && <span className="text-[9px] shrink-0" style={{ color: 'var(--accent-green)' }}>✓</span>}
                      {isAdmin && (
                        <button
                          className="text-[10px] leading-none shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          style={{ color: 'var(--text-dim)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                          onClick={e => { e.stopPropagation(); removePlayer(p.name); }}
                        >✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 border-t t-border shrink-0 flex items-center justify-between">
            <span className="font-['DM_Mono'] text-[9px] t-dim">by submission order</span>
            {isAdmin && <span className="font-['DM_Mono'] text-[9px]" style={{ color: 'var(--accent-gold)' }}>click to add to roster</span>}
          </div>
        </div>

        {/* ── Roster ── */}
        <div className="t-surface border t-border rounded-2xl flex flex-col shadow-sm overflow-hidden min-h-0">

          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b t-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-['Bebas_Neue'] text-base tracking-widest t-text">✅ Roster</span>
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-white text-[9px] font-bold transition-colors"
                style={{ background: rosterValid ? 'var(--accent-green)' : 'var(--border-mid)' }}
              >
                {roster.length}
              </span>
              <span className="font-['DM_Mono'] text-[9px] t-dim">/ need 10+ (×5)</span>
            </div>
            {isAdmin && roster.length > 0 && (
              <button
                className="font-['DM_Mono'] text-[9px] px-2 py-1 rounded-md border transition-colors cursor-pointer"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.borderColor = 'var(--accent-red)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-mid)'; }}
                onClick={clearRoster}
              >Clear</button>
            )}
          </div>

          {/* 2-column chip grid — scrolls internally */}
          <div
            className="flex-1 overflow-y-auto p-2 min-h-0"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropOnRoster}
          >
            {roster.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl w-full" style={{ borderColor: 'var(--border-mid)' }}>
                  <span className="text-2xl opacity-30">↓</span>
                  <p className="font-['DM_Mono'] text-[10px] t-dim text-center">
                    {isAdmin ? 'Click players from queue or drag here' : 'No players selected yet'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {isAdmin && (
                  <div
                    className="col-span-2 flex items-center justify-center h-6 rounded-lg border border-dashed font-['DM_Mono'] text-[9px] t-dim opacity-40"
                    style={{ borderColor: 'var(--border-mid)' }}
                  >
                    drop zone
                  </div>
                )}
                {roster.map((name, i) => (
                  <div
                    key={name}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all group"
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border)',
                      cursor: isAdmin ? 'grab' : 'default',
                    }}
                    draggable={isAdmin}
                    onDragStart={() => handleDragStart(name)}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleRosterDrop(e, name)}
                  >
                    <span className="font-['DM_Mono'] text-[9px] w-4 text-right shrink-0 t-dim">{i + 1}</span>
                    <span className="flex-1 font-['DM_Mono'] text-[11px] font-medium truncate t-text">{name}</span>
                    {isAdmin && <span className="font-['DM_Mono'] text-[9px] shrink-0 t-dim opacity-0 group-hover:opacity-100">≡</span>}
                    {isAdmin && (
                      <button
                        className="text-[10px] leading-none shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        style={{ color: 'var(--text-dim)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                        onClick={() => removeFromRoster(name)}
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 border-t t-border shrink-0">
            <span
              className="font-['DM_Mono'] text-[10px] font-bold"
              style={{ color: rosterValid ? 'var(--accent-green)' : 'var(--accent-red)' }}
            >
              {rosterValid ? `✓ ${roster.length} players ready` : `${roster.length} selected — need ${roster.length < 10 ? 10 - roster.length + ' more' : 'multiple of 5'}`}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
