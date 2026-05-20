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
    if (roster.includes(name)) {
      await removeFromRoster(name);
    } else {
      await addToRoster(name);
    }
  };

  // Drag from queue to roster
  const handleDragStart = (name: string) => setDragging(name);
  const handleDropOnRoster = async (e: React.DragEvent) => {
    e.preventDefault();
    const name = e.dataTransfer.getData('text/plain') || dragging;
    if (name && isAdmin && !roster.includes(name)) {
      await addToRoster(name);
    }
    setDragging(null);
  };

  // Drag to reorder roster
  const handleRosterDragStart = (name: string) => setDragging(name);
  const handleRosterDrop = async (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    if (!dragging || dragging === targetName) return;
    const newRoster = [...roster];
    const fromIdx = newRoster.indexOf(dragging);
    const toIdx = newRoster.indexOf(targetName);
    if (fromIdx === -1 || toIdx === -1) return;
    newRoster.splice(fromIdx, 1);
    newRoster.splice(toIdx, 0, dragging);
    await setRoster(newRoster);
    setDragging(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest mb-1">Player Registration</h1>
      <p className="text-[#7878a0] font-['DM_Mono'] text-xs mb-5">
        Anyone can submit their name to the queue · Admin selects who plays
      </p>

      {/* Submit bar */}
      <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl p-5 mb-4">
        <div className="flex gap-3">
          <input
            type="text"
            className="flex-1 bg-[#161625] border border-[#32324a] rounded-xl px-4 py-3 text-[#dde0f0] font-['Syne'] text-sm outline-none focus:border-[#4d7cff] transition-colors"
            placeholder="Enter your name to join the queue…"
            maxLength={24}
            autoComplete="off"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <button
            className="px-5 py-3 bg-[#4d7cff] text-white font-bold rounded-xl hover:bg-[#2d5eff] transition-all hover:-translate-y-0.5 text-sm"
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
        {nameStatus && (
          <p className={`mt-2 font-['DM_Mono'] text-xs ${nameStatus.ok ? 'text-[#2dcc70]' : 'text-[#ff3d5a]'}`}>
            {nameStatus.text}
          </p>
        )}
      </div>

      {/* Dual panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Queue */}
        <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl flex flex-col min-h-[420px] max-h-[calc(100vh-220px)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#252538]">
            <div className="flex items-center gap-2 font-['Bebas_Neue'] text-lg tracking-widest">
              📋 Queue
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#ff3d5a] text-white text-[10px] font-bold">
                {players.length}
              </span>
            </div>
            {isAdmin && players.length > 0 && (
              <button
                className="text-[10px] font-['DM_Mono'] px-2 py-1 rounded-lg bg-[#161625] border border-[#32324a] text-[#7878a0] hover:border-[#4d7cff] hover:text-[#4d7cff] transition-colors"
                onClick={clearQueue}
              >
                Clear All
              </button>
            )}
          </div>

          <div className="px-3 py-2 border-b border-[#252538]">
            <input
              type="text"
              className="w-full bg-[#161625] border border-[#32324a] rounded-lg px-3 py-2 text-[#dde0f0] font-['DM_Mono'] text-xs outline-none focus:border-[#4d7cff] transition-colors"
              placeholder="🔍  Search name…"
              value={qSearch}
              onChange={e => setQSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 scrollbar-thin scrollbar-thumb-[#32324a]">
            {filteredQueue.length === 0 ? (
              <p className="text-[#4a4a6a] font-['DM_Mono'] text-xs text-center py-10">
                {players.length === 0 ? 'No submissions yet.' : 'No matches.'}
              </p>
            ) : filteredQueue.map((p, i) => {
              const inRoster = roster.includes(p.name);
              return (
                <div
                  key={p.name}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border mb-1.5 transition-all select-none
                    ${isAdmin ? 'cursor-pointer' : 'cursor-default'}
                    ${inRoster
                      ? 'border-[#2dcc70] bg-[rgba(45,204,112,0.07)]'
                      : 'border-[#252538] bg-[#161625] hover:border-[#32324a] hover:bg-[#1e1e30]'
                    }`}
                  draggable={isAdmin}
                  onDragStart={e => { e.dataTransfer.setData('text/plain', p.name); handleDragStart(p.name); }}
                  onClick={() => toggleRoster(p.name)}
                >
                  <span className="font-['DM_Mono'] text-[10px] text-[#4a4a6a] w-4 text-right">{i + 1}</span>
                  <span className={`flex-1 font-['DM_Mono'] text-sm font-medium ${inRoster ? 'text-[#dde0f0]' : 'text-[#dde0f0]'}`}>
                    {p.name}
                  </span>
                  <span className={`text-[10px] font-['DM_Mono'] px-1.5 py-0.5 rounded border ${p.byAdmin ? 'border-[#ffb020]/40 text-[#ffb020] bg-[rgba(255,176,32,0.08)]' : 'border-[#32324a] text-[#7878a0] bg-[#1e1e30]'}`}>
                    {p.byAdmin ? '👑' : 'usr'}
                  </span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border transition-all flex-shrink-0
                    ${inRoster ? 'bg-[rgba(45,204,112,0.15)] text-[#2dcc70] border-[rgba(45,204,112,0.4)]' : 'bg-[#1e1e30] text-[#4a4a6a] border-[#32324a]'}`}>
                    {inRoster ? '✓' : '·'}
                  </div>
                  {isAdmin && (
                    <button
                      className="text-[#4a4a6a] hover:text-[#ff3d5a] transition-colors text-sm leading-none px-1 rounded"
                      onClick={e => { e.stopPropagation(); removePlayer(p.name); }}
                    >✕</button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2.5 border-t border-[#252538] flex items-center justify-between">
            <span className="font-['DM_Mono'] text-[11px] text-[#7878a0]">Sorted by submission ↓</span>
            {isAdmin && <span className="font-['DM_Mono'] text-[11px] text-[#ffb020]">Click to select · Drag to roster</span>}
          </div>
        </div>

        {/* Roster */}
        <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl flex flex-col min-h-[420px] max-h-[calc(100vh-220px)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#252538]">
            <div className="flex items-center gap-2 font-['Bebas_Neue'] text-lg tracking-widest">
              ✅ Roster
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#2dcc70] text-white text-[10px] font-bold">
                {roster.length}
              </span>
            </div>
            {isAdmin && roster.length > 0 && (
              <button
                className="text-[10px] font-['DM_Mono'] px-2 py-1 rounded-lg bg-[#161625] border border-[#32324a] text-[#7878a0] hover:border-[#ff3d5a] hover:text-[#ff3d5a] transition-colors"
                onClick={clearRoster}
              >
                Clear
              </button>
            )}
          </div>

          <div
            className="flex-1 overflow-y-auto p-2.5"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropOnRoster}
          >
            {roster.length === 0 ? (
              <div className="border-2 border-dashed border-[#32324a] rounded-xl flex items-center justify-center min-h-[80px] text-[#4a4a6a] font-['DM_Mono'] text-xs text-center p-4">
                Drop players here or click from queue
              </div>
            ) : (
              <div>
                <div className="border-2 border-dashed border-[#32324a]/40 rounded-xl flex items-center justify-center h-10 text-[#4a4a6a] font-['DM_Mono'] text-[10px] mb-2 opacity-50">
                  drop zone
                </div>
                {roster.map((name, i) => (
                  <div
                    key={name}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#161625] border border-[#252538] mb-1.5 cursor-grab hover:border-[#32324a] transition-all"
                    draggable={isAdmin}
                    onDragStart={() => handleRosterDragStart(name)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleRosterDrop(e, name)}
                  >
                    <span className="font-['DM_Mono'] text-[10px] text-[#4a4a6a] w-4 text-right">{i + 1}</span>
                    <span className="flex-1 font-['DM_Mono'] text-sm font-medium">{name}</span>
                    {isAdmin && (
                      <button
                        className="text-[#4a4a6a] hover:text-[#ff3d5a] transition-colors text-sm leading-none px-1 rounded"
                        onClick={() => removeFromRoster(name)}
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-[#252538] flex items-center justify-between">
            <span className={`font-['DM_Mono'] text-[11px] font-bold ${rosterValid ? 'text-[#2dcc70]' : 'text-[#ff3d5a]'}`}>
              {roster.length} selected {rosterValid ? '✓' : ''}
            </span>
            <span className="font-['DM_Mono'] text-[11px] text-[#7878a0]">Need 10+ in multiples of 5</span>
          </div>
        </div>

      </div>
    </div>
  );
}
