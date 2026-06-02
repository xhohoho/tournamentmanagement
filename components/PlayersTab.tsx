'use client';

import { useState, useRef, useMemo } from 'react';
import { useTourney } from '@/lib/context';
import { HoverButton } from '@/components/HoverButton';

export function PlayersTab() {
  const {
    players, roster, isAdmin, loading,
    submitPlayer, removePlayer,
    addToRoster, removeFromRoster,
    setRoster, clearQueue, clearRoster,
    joinKey, setJoinKey,
    queueCap, queueLocked, setQueueCap, setQueueLocked,
  } = useTourney();

  const [nameInput, setNameInput] = useState('');
  const [joinKeyInput, setJoinKeyInput] = useState('');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [nameStatus, setNameStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [rosterDragOver, setRosterDragOver] = useState(false);
  const submitLock = useRef(false);

  const term = search.toLowerCase().trim();

  const filteredQueue = useMemo(() => {
    if (!term) return players.map((p, i) => ({ ...p, originalIndex: i + 1 }));
    return players
      .map((p, i) => ({ ...p, originalIndex: i + 1 }))
      .filter(p => p.name.toLowerCase().includes(term));
  }, [players, term]);

  const filteredRoster = useMemo(() => {
    if (!term) return roster.map((name, i) => ({ name, originalIndex: i + 1 }));
    return roster
      .map((name, i) => ({ name, originalIndex: i + 1 }))
      .filter(r => r.name.toLowerCase().includes(term));
  }, [roster, term]);

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
    // Hard lock — ref-based so it's synchronous and can't be bypassed by rapid clicks
    if (submitLock.current) return;
    const name = nameInput.trim();
    if (!name) return;

    submitLock.current = true;
    setSubmitting(true);
    setNameInput(''); // clear immediately so the field looks reset right away

    const result = await submitPlayer(name, joinKey ? joinKeyInput : undefined);

    if (result.error) {
      setNameInput(name); // restore input so user can fix/retry
      setNameStatus({ text: `❌ ${result.error}`, ok: false });
    } else {
      setNameStatus({ text: `✓ "${name}" added!`, ok: true });
    }

    setSubmitting(false);
    submitLock.current = false;
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
    setRosterDragOver(false);
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

      {/* Top bar: title + submit */}
      <div className="shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <h1 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text leading-none">Player Registration</h1>
            <p className="font-['DM_Mono'] text-[10px] t-muted mt-0.5">
              {isAdmin ? 'Click to roster · Drag to reorder' : 'Submit your name to join the queue'}
            </p>
          </div>

          <div className="flex-1 flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-lg px-3 py-2 font-['Syne'] text-sm outline-none transition-colors border"
              style={{
                color: 'var(--text)',
                background: submitting ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                borderColor: 'var(--border-mid)',
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? 'not-allowed' : 'text',
              }}
              placeholder={submitting ? 'Adding…' : 'Enter your name…'}
              maxLength={24}
              autoComplete="off"
              disabled={submitting}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !submitting && handleSubmit()}
              onFocus={e => { if (!submitting) e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={e => (e.target.style.borderColor = 'var(--border-mid)')}
            />
            {joinKey && (
              <input
                type="text"
                className="w-28 rounded-lg px-3 py-2 font-['DM_Mono'] text-xs outline-none transition-colors border"
                style={{
                  color: 'var(--text)',
                  background: submitting ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  borderColor: joinKeyInput ? 'var(--accent-green)' : 'var(--border-mid)',
                  opacity: submitting ? 0.6 : 1,
                }}
                placeholder="Join key…"
                autoComplete="off"
                disabled={submitting}
                value={joinKeyInput}
                onChange={e => setJoinKeyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !submitting && handleSubmit()}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = joinKeyInput ? 'var(--accent-green)' : 'var(--border-mid)')}
              />
            )}
            <button
              className="px-4 py-2 font-['DM_Mono'] font-bold rounded-lg text-sm transition-all cursor-pointer shrink-0"
              style={{
                background: submitting ? 'var(--bg-elevated)' : 'var(--accent)',
                color: submitting ? 'var(--text-muted)' : 'white',
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transform: submitting ? 'none' : undefined,
              }}
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? '…' : 'Submit'}
            </button>
          </div>

          {nameStatus && (
            <span className="font-['DM_Mono'] text-xs shrink-0" style={{ color: nameStatus.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {nameStatus.text}
            </span>
          )}
        </div>

        {/* Admin: join key management */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="font-['DM_Mono'] text-[10px] t-muted shrink-0">🔑 Join Key:</span>
            {editingKey ? (
              <>
                <input
                  type="text"
                  className="rounded-lg px-2 py-1 font-['DM_Mono'] text-xs outline-none border"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--accent)', color: 'var(--text)', width: 120 }}
                  placeholder="Set key (blank=off)"
                  value={adminKeyInput}
                  onChange={e => setAdminKeyInput(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      await setJoinKey(adminKeyInput);
                      setEditingKey(false);
                    }
                    if (e.key === 'Escape') setEditingKey(false);
                  }}
                  autoFocus
                />
                <button
                  className="font-['DM_Mono'] text-[10px] px-2 py-1 rounded-md cursor-pointer"
                  style={{ background: 'var(--accent)', color: 'white' }}
                  onClick={async () => { await setJoinKey(adminKeyInput); setEditingKey(false); }}
                >
                  Save
                </button>
                <button
                  className="font-['DM_Mono'] text-[10px] px-2 py-1 rounded-md cursor-pointer t-muted"
                  onClick={() => setEditingKey(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span
                  className="font-['DM_Mono'] text-[10px] px-2 py-0.5 rounded-md"
                  style={{
                    background: joinKey ? 'rgba(34,184,98,0.12)' : 'var(--bg-elevated)',
                    color: joinKey ? 'var(--accent-green)' : 'var(--text-muted)',
                    border: `1px solid ${joinKey ? 'rgba(34,184,98,0.4)' : 'var(--border-mid)'}`,
                  }}
                >
                  {joinKey ? `"${joinKey}" active` : 'off'}
                </span>
                <button
                  className="font-['DM_Mono'] text-[10px] px-2 py-1 rounded-md border cursor-pointer t-muted hover:t-text transition-colors"
                  style={{ borderColor: 'var(--border-mid)', background: 'var(--bg-elevated)' }}
                  onClick={() => { setAdminKeyInput(joinKey); setEditingKey(true); }}
                >
                  {joinKey ? 'Change' : 'Set Key'}
                </button>
                {joinKey && (
                  <HoverButton
                    base={{ borderColor: 'var(--border-mid)', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                    hover={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                    className="font-['DM_Mono'] text-[10px] px-2 py-1 rounded-md border cursor-pointer transition-colors"
                    onClick={() => setJoinKey('')}
                  >
                    Remove Key
                  </HoverButton>
                )}
              </>
            )}
          </div>
        )}

        {/* Admin: queue cap + lock */}
        {isAdmin && (
          <div className="flex items-center gap-3">
            {/* Lock toggle */}
            <button
              className="flex items-center gap-1.5 font-['DM_Mono'] text-[10px] px-2 py-1 rounded-md border transition-all cursor-pointer"
              style={{
                background: queueLocked ? 'rgba(232,41,74,0.1)' : 'var(--bg-elevated)',
                borderColor: queueLocked ? 'var(--accent-red)' : 'var(--border-mid)',
                color: queueLocked ? 'var(--accent-red)' : 'var(--text-muted)',
              }}
              onClick={() => setQueueLocked(!queueLocked)}
              title={queueLocked ? 'Queue locked — click to reopen' : 'Lock queue to stop new registrations'}
            >
              {queueLocked ? '🔒 Locked' : '🔓 Open'}
            </button>
            {/* Cap control */}
            <span className="font-['DM_Mono'] text-[10px] t-muted shrink-0">Cap:</span>
            <input
              type="number"
              min={0}
              max={999}
              className="rounded-md px-2 py-0.5 font-['DM_Mono'] text-xs outline-none border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text)', width: 56, textAlign: 'center' }}
              placeholder="∞"
              value={queueCap === 0 ? '' : queueCap}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                setQueueCap(isNaN(v) ? 0 : Math.max(0, v));
              }}
              title="Maximum number of players (0 = unlimited)"
            />
            {queueCap > 0 && (
              <span className="font-['DM_Mono'] text-[10px]" style={{ color: players.length >= queueCap ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                {players.length}/{queueCap}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Shared search bar */}
      <div className="shrink-0 flex items-center gap-2 rounded-lg px-3 py-2 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)' }}>
        <span className="text-sm t-dim">🔍</span>
        <input
          type="text"
          className="flex-1 bg-transparent font-['DM_Mono'] text-xs outline-none t-text"
          placeholder="Search queue & roster…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="font-['DM_Mono'] text-[10px] t-dim hover:t-text transition-colors cursor-pointer"
            onClick={() => setSearch('')}
          >✕</button>
        )}
      </div>

      {/* Dual panel */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">

        {/* ── Queue ── */}
        <div className="t-surface border t-border rounded-2xl flex flex-col shadow-sm overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b t-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-['Bebas_Neue'] text-base tracking-widest t-text">📋 Queue</span>
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-white text-[9px] font-bold" style={{ background: 'var(--accent-red)' }}>
                {players.length}
              </span>
            </div>
            {isAdmin && players.length > 0 && (
              <HoverButton
                base={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text-muted)' }}
                hover={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                className="font-['DM_Mono'] text-[9px] px-2 py-1 rounded-md border transition-colors cursor-pointer"
                onClick={clearQueue}
              >Clear</HoverButton>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {filteredQueue.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="font-['DM_Mono'] text-xs t-dim text-center">
                  {players.length === 0 ? 'No submissions yet.' : 'No matches.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {filteredQueue.map(p => {
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
                      <span className="font-['DM_Mono'] text-[9px] w-4 text-right shrink-0 t-dim">{p.originalIndex}</span>
                      <span className="flex-1 font-['DM_Mono'] text-[11px] font-medium truncate" style={{ color: inRoster ? 'var(--accent-green)' : 'var(--text)' }}>
                        {p.name}
                      </span>
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

          <div className="px-3 py-1.5 border-t t-border shrink-0 flex items-center justify-between" style={{ minHeight: 32 }}>
            <span className="font-['DM_Mono'] text-[10px] t-dim">by submission order</span>
            {isAdmin && <span className="font-['DM_Mono'] text-[10px]" style={{ color: 'var(--accent-gold)' }}>click to add to roster</span>}
          </div>
        </div>

        {/* ── Roster ── */}
        <div className="t-surface border t-border rounded-2xl flex flex-col shadow-sm overflow-hidden min-h-0">
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
              <HoverButton
                base={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-mid)', color: 'var(--text-muted)' }}
                hover={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                className="font-['DM_Mono'] text-[9px] px-2 py-1 rounded-md border transition-colors cursor-pointer"
                onClick={clearRoster}
              >Clear</HoverButton>
            )}
          </div>

          <div
            className="flex-1 overflow-y-auto p-2 min-h-0 transition-all"
            style={rosterDragOver && dragging && !roster.includes(dragging) ? { outline: '2px dashed var(--accent-green)', outlineOffset: '-4px', borderRadius: 12 } : {}}
            onDragOver={e => { e.preventDefault(); if (!rosterDragOver) setRosterDragOver(true); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRosterDragOver(false); }}
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

                {filteredRoster.length === 0 && term ? (
                  <div className="col-span-2 flex items-center justify-center py-4">
                    <p className="font-['DM_Mono'] text-xs t-dim">No matches in roster.</p>
                  </div>
                ) : (
                  filteredRoster.map(r => (
                    <div
                      key={r.name}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all group"
                      style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border)',
                        cursor: isAdmin ? 'grab' : 'default',
                      }}
                      draggable={isAdmin}
                      onDragStart={() => handleDragStart(r.name)}
                      onDragEnd={() => setDragging(null)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => handleRosterDrop(e, r.name)}
                    >
                      <span className="font-['DM_Mono'] text-[9px] w-4 text-right shrink-0 t-dim">{r.originalIndex}</span>
                      <span className="flex-1 font-['DM_Mono'] text-[11px] font-medium truncate t-text">{r.name}</span>
                      {isAdmin && <span className="font-['DM_Mono'] text-[9px] shrink-0 t-dim opacity-0 group-hover:opacity-100">≡</span>}
                      {isAdmin && (
                        <button
                          className="text-[10px] leading-none shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          style={{ color: 'var(--text-dim)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                          onClick={() => removeFromRoster(r.name)}
                        >✕</button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 border-t t-border shrink-0 flex items-center" style={{ minHeight: 32 }}>
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
