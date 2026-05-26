'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import { WHEEL_COLORS } from '@/lib/utils';
import type { SpinState } from '@/lib/types';

// No spin-related props — queue is owned entirely by context, not page.tsx
export function MapsTab() {
  const {
    maps, isAdmin, loading,
    addMap, removeMap, appendSpinQueue, clearSpinQueue,
    adminToken, spinState: liveSpin,
    spinQueue, removeSpinQueueItem,
  } = useTourney();

  const [mapInput, setMapInput] = useState('');
  const [mapErr, setMapErr] = useState('');
  const [busy, setBusy] = useState(false); // true while any map/queue write is in-flight

  // ─── Spin Result Queue Categories ────────────────────────────────────────────
  const CATEGORIES = ['Game 1', 'Game 2', 'Game 3', 'Decider', 'Veto', 'Reserve'] as const;
  type Category = typeof CATEGORIES[number];
  const [queueCategories, setQueueCategories] = useState<Record<number, Category>>(() => {
    try { return JSON.parse(localStorage.getItem('spinQueueCategories') ?? '{}'); } catch { return {}; }
  });
  const [activeFilter, setActiveFilter] = useState<Category | null>(null);

  const setItemCategory = (idx: number, cat: Category | null) => {
    setQueueCategories(prev => {
      const next = { ...prev };
      if (cat === null) delete next[idx];
      else next[idx] = cat;
      localStorage.setItem('spinQueueCategories', JSON.stringify(next));
      return next;
    });
  };

  // Reindex categories when an item is removed
  const reindexCategories = (removedIdx: number) => {
    setQueueCategories(prev => {
      const next: Record<number, Category> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < removedIdx) next[ki] = v as Category;
        else if (ki > removedIdx) next[ki - 1] = v as Category;
        // ki === removedIdx: drop it
      });
      localStorage.setItem('spinQueueCategories', JSON.stringify(next));
      return next;
    });
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wheelWrapRef = useRef<HTMLDivElement>(null);
  const [wheelSize, setWheelSize] = useState(220);
  const angleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Modal state is fully local — no prop chain to page.tsx
  const [spunMap, setSpunMap] = useState('');

  // Stable ref so the RAF tick always reads the latest maps at spin-end,
  // even if SSE pushed a maps update mid-animation
  const mapsRef = useRef(maps);
  useEffect(() => { mapsRef.current = maps; }, [maps]);

  // Stable ref for appendSpinQueue so the RAF tick always uses the latest
  // version (with the current adminToken). Without this, spin() closes over
  // a stale appendSpinQueue that was created before the user logged in,
  // causing the PATCH to go out without X-Admin-Token → 403 → silent rollback.
  const appendSpinQueueRef = useRef(appendSpinQueue);
  useEffect(() => { appendSpinQueueRef.current = appendSpinQueue; }, [appendSpinQueue]);

  // Persisted Default Maps (localStorage, client-only)
  const [defaultMaps, setDefaultMaps] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('defaultMaps') ?? '[]'); } catch { return []; }
  });

  const toggleDefault = (map: string) => {
    setDefaultMaps(prev => {
      const next = prev.includes(map) ? prev.filter(m => m !== map) : [...prev, map];
      localStorage.setItem('defaultMaps', JSON.stringify(next));
      return next;
    });
  };

  const handleRemoveMap = async (mapToRemove: string) => {
    if (busy) return;
    setBusy(true);
    try { await removeMap(mapToRemove); } finally { setBusy(false); }
  };

  const handleRestoreMap = async (mapToRestore: string) => {
    if (busy) return;
    if (maps.includes(mapToRestore)) return;
    setBusy(true);
    try { await addMap(mapToRestore); } finally { setBusy(false); }
  };

  if (loading) return (
    <div className="flex-1 flex flex-col w-full py-6 gap-5 animate-pulse">
      <div className="h-10 w-40 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl" style={{ background: 'var(--bg-elevated)' }} />
        <div className="rounded-2xl" style={{ background: 'var(--bg-elevated)', opacity: 0.6 }} />
      </div>
    </div>
  );

  // ─── Draw wheel ──────────────────────────────────────────────────────────────
  const drawWheel = useCallback((angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, cx = W / 2, r = W / 2 - 8;
    ctx.clearRect(0, 0, W, W);

    if (!maps.length) {
      ctx.fillStyle = 'var(--bg-elevated)';
      ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'var(--text-dim)';
      ctx.font = '14px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Add maps', cx, cx + 5);
      return;
    }

    const slice = (Math.PI * 2) / maps.length;
    maps.forEach((m, i) => {
      const start = angle + i * slice, end = start + slice;
      ctx.beginPath(); ctx.moveTo(cx, cx); ctx.arc(cx, cx, r, start, end); ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      ctx.translate(cx, cx); ctx.rotate(start + slice / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(13, 140 / maps.length)}px Syne, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 4;
      ctx.fillText(m.length > 14 ? m.slice(0, 13) + '\u2026' : m, r - 8, 4);
      ctx.restore();
    });

    ctx.beginPath(); ctx.arc(cx, cx, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--bg-surface)'; ctx.fill();
    ctx.strokeStyle = 'var(--border-mid)'; ctx.lineWidth = 2; ctx.stroke();
  }, [maps]);

  useEffect(() => { drawWheel(angleRef.current); }, [maps, drawWheel, wheelSize]);

  // ─── Broadcast spin state helper (admin only) ─────────────────────────────
  const broadcastSpinState = useCallback(async (state: SpinState | null) => {
    await fetch('/api/maps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(adminToken ? { 'X-Admin-Token': adminToken } : {}) },
      body: JSON.stringify({ action: 'updateSpinState', spinState: state }),
    });
  }, [adminToken]);

  // ─── ADMIN: spin ──────────────────────────────────────────────────────────
  // appendSpinQueue comes from context and does an optimistic local update
  // immediately, then persists to KV. No prop callback chain — no stale closure risk.
  const spin = useCallback(() => {
    if (spinning || !maps.length) return;
    setSpinning(true);
    setSpunMap('');

    const extra = (5 + Math.random() * 6) * Math.PI * 2 + Math.random() * Math.PI * 2;
    const dur = 3200 + Math.random() * 1200;
    const a0 = angleRef.current;
    const targetAngle = a0 + extra;
    const startTime = Date.now();

    broadcastSpinState({ spinning: true, startAngle: a0, targetAngle, startTime, duration: dur, result: '' });

    const tick = async () => {
      const tAbs = Math.min(1, (Date.now() - startTime) / dur);
      angleRef.current = a0 + extra * (1 - Math.pow(1 - tAbs, 4));
      drawWheel(angleRef.current);

      if (tAbs < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Spin done — read mapsRef for latest maps (safe against mid-animation SSE updates)
      setSpinning(false);
      const currentMaps = mapsRef.current;
      const slice = (Math.PI * 2) / currentMaps.length;
      const pointerAngle = -Math.PI / 2;
      const norm = ((pointerAngle - angleRef.current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const result = currentMaps[Math.floor(norm / slice) % currentMaps.length];

      // Show modal and write to queue — appendSpinQueue updates context state immediately
      setSpunMap(result);

      // IMPORTANT: await appendSpinQueue before broadcasting spinState.
      // Both call updateState() (read-modify-write on KV). If they fire
      // simultaneously the spinState write races the spinQueue write and
      // whichever lands second overwrites the other's changes, causing the
      // queue entry to be silently lost even though the server returned 200.
      await appendSpinQueueRef.current(result);

      // Broadcast for non-admin wheel sync, clear after 1s
      broadcastSpinState({ spinning: false, startAngle: a0, targetAngle, startTime, duration: dur, result });
      setTimeout(() => broadcastSpinState(null), 1000);
    };

    rafRef.current = requestAnimationFrame(tick);
  // appendSpinQueue intentionally omitted — accessed via appendSpinQueueRef
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, maps.length, drawWheel, broadcastSpinState]);

  // ─── NON-ADMIN: mirror live spin from SSE-pushed spinState ───────────────
  const prevSpinRef = useRef<SpinState | null>(null);
  useEffect(() => {
    if (isAdmin) return;
    if (!liveSpin) return;

    const prev = prevSpinRef.current;
    prevSpinRef.current = liveSpin;

    if (!liveSpin.spinning && liveSpin.result) {
      if (!prev || prev.result !== liveSpin.result || prev.spinning) {
        const age = Date.now() - (liveSpin.startTime + liveSpin.duration);
        if (age > 10000) return; // stale — ignore on page refresh

        const { startAngle: a0, targetAngle, startTime, duration: dur } = liveSpin;
        if (Date.now() - startTime >= dur) {
          // Already finished — just snap wheel to final position
          angleRef.current = targetAngle;
          drawWheel(angleRef.current);
        } else {
          setSpinning(true);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          const animate = () => {
            const tAbs = Math.min(1, (Date.now() - startTime) / dur);
            angleRef.current = a0 + (targetAngle - a0) * (1 - Math.pow(1 - tAbs, 4));
            drawWheel(angleRef.current);
            if (tAbs < 1) { rafRef.current = requestAnimationFrame(animate); }
            else { setSpinning(false); }
          };
          rafRef.current = requestAnimationFrame(animate);
        }
      }
      return;
    }

    if (liveSpin.spinning) {
      if (prev?.startTime === liveSpin.startTime) return; // already mirroring this spin
      setSpinning(true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const { startAngle: a0, targetAngle, startTime, duration: dur } = liveSpin;
      const animate = () => {
        const tAbs = Math.min(1, (Date.now() - startTime) / dur);
        angleRef.current = a0 + (targetAngle - a0) * (1 - Math.pow(1 - tAbs, 4));
        drawWheel(angleRef.current);
        if (tAbs < 1) { rafRef.current = requestAnimationFrame(animate); }
        else { setSpinning(false); }
      };
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [liveSpin, isAdmin, drawWheel]);

  // Dynamically size the wheel to fit its container
  useEffect(() => {
    const el = wheelWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      // Reserve space for pointer (≈44px) + button/status (≈44px) + gaps (≈16px)
      const reserved = 104;
      const size = Math.floor(Math.min(width, Math.max(0, height - reserved)));
      if (size > 0) setWheelSize(size);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const handleAddMap = async () => {
    if (busy) return;
    const name = mapInput.trim();
    if (!name) return;
    setBusy(true);
    try {
      const result = await addMap(name);
      if (result?.error) { setMapErr(result.error); return; }
      setMapInput(''); setMapErr('');
    } finally { setBusy(false); }
  };

  const handleRemoveQueueItem = async (idx: number) => {
    if (busy) return;
    setBusy(true);
    try { await removeSpinQueueItem(idx); reindexCategories(idx); } finally { setBusy(false); }
  };

  // Restore map pool to defaults (or all maps that appear in queue) WITHOUT clearing queue
  const handleRestoreMapPool = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Re-add every map from defaultMaps (starred) that's missing from pool
      const toRestore = defaultMaps.filter(m => !maps.includes(m));
      await Promise.all(toRestore.map(m => addMap(m)));
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden py-4 gap-4">
        <div className="shrink-0">
          <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Map Selector</h1>
          <p className="font-['DM_Mono'] text-xs t-muted">
            {isAdmin ? 'Spin the wheel to build a map queue. Drag them directly into bracket slots.' : 'Live view — spin results appear automatically'}
          </p>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">

          {/* Wheel panel */}
          <div className="t-surface border t-border rounded-2xl p-4 flex flex-col gap-3 min-h-0">
            <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text shrink-0">
              🎡 Wheel
              {spinning && !isAdmin && (
                <span className="ml-2 font-['DM_Mono'] text-xs t-muted animate-pulse normal-case tracking-normal">live…</span>
              )}
            </h2>

            {isAdmin && (
              <div className="shrink-0">
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="text"
                    className="flex-1 min-w-[150px] t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none transition-colors"
                    placeholder="Map name…"
                    value={mapInput}
                    onChange={e => setMapInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMap()}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = '')}
                  />
                  <button
                    className="shrink-0 px-4 py-2.5 font-bold rounded-xl text-sm text-white transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--accent)' }}
                    onClick={handleAddMap}
                    disabled={busy}
                  >
                    + Add
                  </button>
                </div>
                {mapErr && <p className="font-['DM_Mono'] text-xs mt-1" style={{ color: 'var(--accent-red)' }}>{mapErr}</p>}
              </div>
            )}

            {/* Map list — fixed height so it never crushes the wheel */}
            <div className="shrink-0 max-h-[96px] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {maps.map(m => (
                  <span key={m} className="inline-flex items-center gap-1.5 t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm t-text">
                    {m}
                    {isAdmin && (
                      <span
                        className={`t-dim transition-colors shrink-0 ${busy ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:text-[var(--accent-red)]'}`}
                        onClick={() => !busy && handleRemoveMap(m)}
                      >
                        ✕
                      </span>
                    )}
                  </span>
                ))}
                {maps.length === 0 && <p className="font-['DM_Mono'] text-xs t-dim">{isAdmin ? 'No maps yet.' : 'No maps added.'}</p>}
              </div>
            </div>

            {/* Wheel area — takes all remaining space, measures itself for canvas size */}
            <div ref={wheelWrapRef} className="flex-1 min-h-0 w-full overflow-hidden flex flex-col items-center justify-center gap-2">
              <span className="text-3xl rotate-90 shrink-0" style={{ color: 'var(--accent-red)' }}>▶</span>
              <canvas
                ref={canvasRef}
                width={wheelSize}
                height={wheelSize}
                className="rounded-full drop-shadow-sm shrink-0"
                style={{ width: wheelSize, height: wheelSize }}
              />
              {isAdmin ? (
                <button
                  className="shrink-0 px-6 py-2 text-white font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  style={{ background: 'var(--accent-red)' }}
                  onClick={spin}
                  disabled={spinning || maps.length === 0}
                >
                  {spinning ? '🌀 Spinning…' : '🌀 SPIN'}
                </button>
              ) : (
                <div className="shrink-0 h-9 flex items-center">
                  {spinning
                    ? <span className="font-['DM_Mono'] text-xs t-muted animate-pulse">🌀 Admin is spinning…</span>
                    : <span className="font-['DM_Mono'] text-xs t-dim">Waiting for admin to spin</span>
                  }
                </div>
              )}
            </div>
          </div>

          {/* Spin Results panel */}
          <div className="t-surface border t-border rounded-2xl p-5 flex flex-col gap-4 min-h-0">
            <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
              <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text">🎯 Spin Results Queue</h2>
              {isAdmin && (
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Restore map pool — does NOT clear queue */}
                  {defaultMaps.length > 0 && (
                    <button
                      className={`font-['DM_Mono'] text-[10px] transition-colors whitespace-nowrap
                        ${busy ? 'opacity-30 cursor-not-allowed t-dim' : 'cursor-pointer hover:text-[var(--accent-green)] t-dim'}`}
                      title="Re-add starred default maps to pool (result history untouched)"
                      onClick={handleRestoreMapPool}
                      disabled={busy}
                    >↩ restore map pool</button>
                  )}
                  <button
                    className={`shrink-0 font-['DM_Mono'] text-[10px] t-dim hover:text-[var(--accent-red)] transition-colors whitespace-nowrap
                      ${spinQueue.length === 0 || busy ? 'invisible pointer-events-none' : 'cursor-pointer'}`}
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      try {
                        const missing = spinQueue.filter(m => !maps.includes(m));
                        await clearSpinQueue();
                        setQueueCategories({});
                        localStorage.removeItem('spinQueueCategories');
                        await Promise.all(missing.map(m => addMap(m)));
                      } finally { setBusy(false); }
                    }}
                  >clear all</button>
                </div>
              )}
            </div>

            {/* Category filter pills */}
            {spinQueue.length > 0 && (
              <div className="shrink-0 flex flex-wrap gap-1.5">
                <button
                  className={`font-['DM_Mono'] text-[10px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer
                    ${activeFilter === null ? 'border-[var(--accent)] text-[var(--accent)]' : 't-border t-dim hover:t-text'}`}
                  onClick={() => setActiveFilter(null)}
                >All</button>
                {CATEGORIES.map(cat => {
                  const count = spinQueue.filter((_, i) => queueCategories[i] === cat).length;
                  if (count === 0 && activeFilter !== cat) return null;
                  return (
                    <button
                      key={cat}
                      className={`font-['DM_Mono'] text-[10px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer
                        ${activeFilter === cat ? 'border-[var(--accent)] text-[var(--accent)]' : 't-border t-dim hover:t-text'}`}
                      onClick={() => setActiveFilter(prev => prev === cat ? null : cat)}
                    >{cat}{count > 0 && <span className="ml-1 opacity-60">({count})</span>}</button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-1.5">
              {spinQueue.length === 0 ? (
                <p className="font-['DM_Mono'] text-xs t-dim text-center py-3">Spin the wheel to build a map queue. The bracket automatically assigns them in order.</p>
              ) : (
                spinQueue.map((m, i) => {
                  const isRemoved = !maps.includes(m);
                  const cat = queueCategories[i] ?? null;
                  if (activeFilter !== null && cat !== activeFilter) return null;
                  return (
                    <div key={i} className="flex items-center justify-between t-elevated border t-border rounded-xl px-3 py-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="shrink-0 font-['DM_Mono'] text-[10px] t-dim w-5 text-right">#{i + 1}</span>
                        <span className="font-['DM_Mono'] text-sm t-text truncate">🗺 {m}</span>
                        {cat && (
                          <span className="shrink-0 font-['DM_Mono'] text-[9px] px-1.5 py-0.5 rounded-full border border-[var(--accent)] text-[var(--accent)] opacity-80">{cat}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap">
                        {/* Category selector */}
                        {isAdmin && (
                          <select
                            className="font-['DM_Mono'] text-[10px] t-elevated border t-border rounded px-1 py-0.5 t-text cursor-pointer bg-transparent"
                            value={cat ?? ''}
                            onChange={e => setItemCategory(i, (e.target.value || null) as Category | null)}
                          >
                            <option value="">— tag —</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}
                        {isAdmin && isRemoved && (
                          <button
                            className={`font-['DM_Mono'] text-[10px] t-dim transition-colors px-1 py-1 ${busy ? 'opacity-30 cursor-not-allowed' : 'hover:text-[var(--accent-green)] cursor-pointer'}`}
                            title="Restore map to pool"
                            onClick={() => handleRestoreMap(m)}
                            disabled={busy}
                          >↩</button>
                        )}
                        {isAdmin && (
                          <button
                            className={`font-['DM_Mono'] text-[10px] t-dim transition-colors px-1 py-1 ${busy ? 'opacity-30 cursor-not-allowed' : 'hover:text-[var(--accent-red)] cursor-pointer'}`}
                            onClick={() => handleRemoveQueueItem(i)}
                            disabled={busy}
                          >✕</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="shrink-0">
              <hr className="t-border my-2" />
              <p className="font-['DM_Mono'] text-[11px] t-muted tracking-widest mb-2">MAP POOL DEFAULTS</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {maps.map(m => {
                  const isDefault = defaultMaps.includes(m);
                  return (
                    <div
                      key={m}
                      className="t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <span className="truncate max-w-[150px]">{m}</span>
                      {isAdmin && (
                        <button
                          title={isDefault ? 'Remove from defaults' : 'Set as default map (restored after reset)'}
                          className="shrink-0 transition-colors cursor-pointer text-xs leading-none"
                          style={{ color: isDefault ? 'var(--accent-gold)' : 'var(--text-dim)' }}
                          onClick={() => toggleDefault(m)}
                        >★</button>
                      )}
                    </div>
                  );
                })}
                {maps.length === 0 && <p className="font-['DM_Mono'] text-xs t-dim">{isAdmin ? 'Add maps using the wheel panel.' : 'No maps yet.'}</p>}
              </div>
              {isAdmin && defaultMaps.filter(m => maps.includes(m)).length > 0 && (
                <p className="font-['DM_Mono'] text-[10px] t-dim">★ = default map (stays in pool after reset)</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RESULT MODAL — admin only */}
      {spunMap && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#1e1e1e] border border-[var(--border-mid)] rounded overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-[#d32f2f] text-white px-5 py-3 font-semibold text-lg">
              We have a winner!
            </div>
            <div className="p-10 flex items-center justify-center border-b border-[#333]">
              <p className="text-white text-5xl font-light tracking-wide text-center break-words">{spunMap}</p>
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-4 bg-[#242424]">
              <button
                className="text-sm text-gray-300 hover:text-white font-medium transition-colors cursor-pointer"
                onClick={() => setSpunMap('')}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-[#5c7cfa] hover:bg-[#4c6cf0] text-white text-sm font-semibold rounded shadow-sm transition-colors cursor-pointer"
                onClick={() => { handleRemoveMap(spunMap); setSpunMap(''); }}
              >
                Remove from pool
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
