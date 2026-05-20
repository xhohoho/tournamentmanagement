'use client';

import { useState, useMemo } from 'react';
import { useTourney } from '@/lib/context';

export function PlayersTab() {
  const {
    players, roster, isAdmin,
    submitPlayer, removePlayer,
    addToRoster, removeFromRoster,
    setRoster, clearQueue, clearRoster,
  } = useTourney();

  const [nameInput, setNameInput] = useState('');
  const [nameStatus, setNameStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [qSearch, setQSearch] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);

  const filteredQueue = useMemo(() =>
    players.filter(p => p.name.toLowerCase().includes(qSearch.toLowerCase())),
    [players, qSearch]
  );

  const rosterValid = roster.length >= 10 && roster.length % 5 === 0;

  const handleSubmit = async () => {
    const name = nameInput.trim();
    if (!name) return;
    const result = await submitPlayer(name);
    if (result.error) {
      setNameStatus({ text: `❌ ${result.error}`, ok: false });
    } else {
      setNameStatus({ text: `✓ "${name}" added to queue!`, ok: true });
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
  const handleRosterDragStart = (name: string) => setDragging(name);
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
    <div className="max-w-6xl mx-auto px-6 py-8">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest t-text mb-1">Player Registration</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">
          Anyone can submit their name to the queue · Admin selects who plays
        </p>
      </div>

      {/* Submit bar */}
      <div className="t-surface border t-border rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex gap-3">
          <input
            type="text"
            className="flex-1 rounded-xl px-4 py-2.5 font-['Syne'] text-sm outline-none transition-colors border"
            style={{
              color: 'var(--text)',
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border-mid)',
            }}
            placeholder="Enter your name to join the queue…"
            maxLength={24}
            autoComplete="off"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
          />
          <button
            className="px-6 py-2.5 font-['DM_Mono'] font-bold rounded-xl text-sm text-white active:scale-95 transition-all"
            style={{ background: 'var(--accent)', cursor: 'pointer' }}
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
        {nameStatus && (
          <p
            className="mt-2.5 font-['DM_Mono'] text-xs"
            style={{ color: nameStatus.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}
          >
            {nameStatus.text}
          </p>
        )}
      </div>

      {/* Dual panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Queue ── */}
        <div
          className="t-surface border t-border rounded-2xl flex flex-col shadow-sm overflow-hidden"
          style={{ height: 'calc(100vh - 320px)', minHeight: '420px' }}
        >
          {/* Queue header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b t-border shrink-0">
            <div className="flex items-center gap-2.5">
              <span>📋</span>
              <span className="font-['Bebas_Neue'] text-lg tracking-widest t-text">Queue</span>
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold"
                style={{ background: 'var(--accent-red)' }}
              >
                {players.length}
              </span>
            </div>
            {isAdmin && players.length > 0 && (
              <button
                className="font-['DM_Mono'] text-[10px] px-2.5 py-1 rounded-lg border transition-colors"
                style={{ cursor: 'pointer', background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget.style.color = 'var(--accent)'); (e.currentTarget.style.borderColor = 'var(--accent)'); }}
                onMouseLeave={e => { (e.currentTarget.style.color = 'var(--text-muted)'); (e.currentTarget.style.borderColor = 'var(--border-mid)'); }}
                onClick={clearQueue}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-4 py-2.5 border-b t-border shrink-0">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>🔍</span>
              <input
                type="text"
                className="flex-1 bg-transparent font-['DM_Mono'] text-xs outline-none"
                style={{ color: 'var(--text)' }}
                placeholder="Search name…"
                value={qSearch}
                onChange={e => setQSearch(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {filteredQueue.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="font-['DM_Mono'] text-xs text-center" style={{ color: 'var(--text-dim)' }}>
                  {players.length === 0 ? 'No submissions yet.' : 'No matches.'}
                </p>
              </div>
            ) : filteredQueue.map((p, i) => {
              const inRoster = roster.includes(p.name);
              return (
                <div
                  key={p.name}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all select-none"
                  style={{
                    cursor: isAdmin ? 'pointer' : 'default',
                    background: inRoster ? 'rgba(45,204,112,0.07)' : 'var(--bg-elevated)',
                    borderColor: inRoster ? 'var(--accent-green)' : 'var(--border)',
                  }}
                  draggable={isAdmin}
                  onDragStart={e => { e.dataTransfer.setData('text/plain', p.name); handleDragStart(p.name); }}
                  onClick={() => toggleRoster(p.name)}
                >
                  <span className="font-['DM_Mono'] text-[10px] w-5 text-right shrink-0" style={{ color: 'var(--text-dim)' }}>{i + 1}</span>
                  <span className="flex-1 font-['DM_Mono'] text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{p.name}</span>
                  <span
                    className="text-[10px] font-['DM_Mono'] px-1.5 py-0.5 rounded border shrink-0"
                    style={p.byAdmin
                      ? { color: 'var(--accent-gold)', borderColor: 'rgba(255,176,32,0.3)', background: 'rgba(255,176,32,0.08)' }
                      : { color: 'var(--text-muted)', borderColor: 'var(--border-mid)', background: 'var(--bg-elevated)' }
                    }
                  >
                    {p.byAdmin ? '👑' : 'usr'}
                  </span>
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border shrink-0 transition-all"
                    style={inRoster
                      ? { background: 'rgba(45,204,112,0.15)', color: 'var(--accent-green)', borderColor: 'rgba(45,204,112,0.4)' }
                      : { background: 'var(--bg-elevated)', color: 'var(--text-dim)', borderColor: 'var(--border-mid)' }
                    }
                  >
                    {inRoster ? '✓' : '·'}
                  </div>
                  {isAdmin && (
                    <button
                      className="text-sm leading-none shrink-0 transition-colors"
                      style={{ cursor: 'pointer', color: 'var(--text-dim)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                      onClick={e => { e.stopPropagation(); removePlayer(p.name); }}
                    >✕</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t t-border flex items-center justify-between shrink-0">
            <span className="font-['DM_Mono'] text-[10px]" style={{ color: 'var(--text-dim)' }}>Sorted by submission ↓</span>
            {isAdmin && (
              <span className="font-['DM_Mono'] text-[10px]" style={{ color: 'var(--accent-gold)' }}>
                Click to select · Drag to roster
              </span>
            )}
          </div>
        </div>

        {/* ── Roster ── */}
        <div
          className="t-surface border t-border rounded-2xl flex flex-col shadow-sm overflow-hidden"
          style={{ height: 'calc(100vh - 320px)', minHeight: '420px' }}
        >
          {/* Roster header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b t-border shrink-0">
            <div className="flex items-center gap-2.5">
              <span>✅</span>
              <span className="font-['Bebas_Neue'] text-lg tracking-widest t-text">Roster</span>
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold transition-colors"
                style={{ background: rosterValid ? 'var(--accent-green)' : 'var(--border-mid)' }}
              >
                {roster.length}
              </span>
            </div>
            {isAdmin && roster.length > 0 && (
              <button
                className="font-['DM_Mono'] text-[10px] px-2.5 py-1 rounded-lg border transition-colors"
                style={{ cursor: 'pointer', background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget.style.color = 'var(--accent-red)'); (e.currentTarget.style.borderColor = 'var(--accent-red)'); }}
                onMouseLeave={e => { (e.currentTarget.style.color = 'var(--text-muted)'); (e.currentTarget.style.borderColor = 'var(--border-mid)'); }}
                onClick={clearRoster}
              >
                Clear
              </button>
            )}
          </div>

          {/* Drop area */}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-1"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropOnRoster}
          >
            {roster.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div
                  className="rounded-2xl flex flex-col items-center justify-center gap-3 p-10 w-full border-2 border-dashed"
                  style={{ borderColor: 'var(--border-mid)' }}
                >
                  <span className="text-3xl" style={{ color: 'var(--text-dim)', opacity: 0.4 }}>↓</span>
                  <p className="font-['DM_Mono'] text-xs text-center" style={{ color: 'var(--text-dim)' }}>
                    Drop players here or click from queue
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="rounded-xl flex items-center justify-center h-9 font-['DM_Mono'] text-[10px] border border-dashed"
                  style={{ borderColor: 'var(--border-mid)', color: 'var(--text-dim)', opacity: 0.5 }}
                >
                  drop zone
                </div>
                {roster.map((name, i) => (
                  <div
                    key={name}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all cursor-grab"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                    draggable={isAdmin}
                    onDragStart={() => handleRosterDragStart(name)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleRosterDrop(e, name)}
                  >
                    <span className="font-['DM_Mono'] text-[10px] w-5 text-right shrink-0" style={{ color: 'var(--text-dim)' }}>{i + 1}</span>
                    <span className="flex-1 font-['DM_Mono'] text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{name}</span>
                    <span className="font-['DM_Mono'] text-[10px] shrink-0" style={{ color: 'var(--text-dim)' }}>≡</span>
                    {isAdmin && (
                      <button
                        className="text-sm leading-none shrink-0 transition-colors"
                        style={{ cursor: 'pointer', color: 'var(--text-dim)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                        onClick={() => removeFromRoster(name)}
                      >✕</button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t t-border flex items-center justify-between shrink-0">
            <span
              className="font-['DM_Mono'] text-[10px] font-bold"
              style={{ color: rosterValid ? 'var(--accent-green)' : 'var(--accent-red)' }}
            >
              {roster.length} selected {rosterValid ? '✓ Ready' : ''}
            </span>
            <span className="font-['DM_Mono'] text-[10px]" style={{ color: 'var(--text-dim)' }}>Need 10+ in multiples of 5</span>
          </div>
        </div>

      </div>
    </div>
  );
}
