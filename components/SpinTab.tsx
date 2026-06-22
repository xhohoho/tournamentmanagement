'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import { WHEEL_COLORS } from '@/lib/utils';
import type { SpinState } from '@/lib/types';

export function SpinTab() {
  const {
    isAdmin, loading,
    spinTabState: liveSpin,
    spinTabQueue, removeSpinTabQueueItem, removeSpinTabQueueItemByName,
    appendSpinTabQueue,
    spinTabResults, removeSpinTabResult, appendSpinTabResult,
    spinTabStarredItems,
    saveSpinTabStarred, clearSpinTab,
    updateSpinTabState,
  } = useTourney();

  // items = the wheel's item pool (what gets added/spun)
  // results = the ordered history of spin outcomes, shown in the Spin Results panel
  const items      = spinTabQueue;
  const results    = spinTabResults;
  const starredItems = spinTabStarredItems;

  // Wheel items = the full pool
  const wheelItems = items;

  const [itemInput, setItemInput] = useState('');
  const [busy, setBusy]           = useState(false);

  // ─── Drag reorder — proper splice-at-target ───────────────────────────────
  const dragIdxRef     = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);
  // Shadow index array for optimistic visual reorder during drag
  const [dragOrder, setDragOrder] = useState<number[] | null>(null);

  const handleDragStart = (idx: number) => {
    dragIdxRef.current = idx;
    setDragOrder(results.map((_, i) => i));
  };

  const handleDragEnter = (idx: number) => {
    const from = dragIdxRef.current;
    if (from === null || from === idx) return;
    dragOverIdxRef.current = idx;
    setDragOrder(prev => {
      if (!prev) return prev;
      const next     = [...prev];
      const fromPos  = next.indexOf(from);
      const toPos    = next.indexOf(idx);
      if (fromPos === -1 || toPos === -1) return prev;
      next.splice(fromPos, 1);
      next.splice(toPos, 0, from);
      return next;
    });
  };

  const handleDragEnd = async () => {
    const from  = dragIdxRef.current;
    const order = dragOrder;
    dragIdxRef.current     = null;
    dragOverIdxRef.current = null;
    setDragOrder(null);

    if (from === null || !order) return;
    const reordered = order.map(i => results[i]);
    if (reordered.every((v, i) => v === results[i])) return;   // nothing changed

    setBusy(true);
    try {
      // Clear from back to front so indices don't shift mid-loop
      for (let i = results.length - 1; i >= 0; i--) {
        await removeSpinTabResult(i);
      }
      for (const item of reordered) {
        await appendSpinTabResult(item);
      }
    } finally { setBusy(false); }
  };

  // ─── Star / unstar ────────────────────────────────────────────────────────
  const toggleStar = (item: string) => {
    const next = starredItems.includes(item)
      ? starredItems.filter(m => m !== item)
      : [...starredItems, item];
    saveSpinTabStarred(next);
  };

  // ─── Wheel canvas ─────────────────────────────────────────────────────────
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const wheelWrapRef = useRef<HTMLDivElement>(null);
  const [wheelSize, setWheelSize] = useState(220);
  const angleRef  = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const rafRef    = useRef<number | null>(null);
  const [spunItem, setSpunItem] = useState('');

  const wheelItemsRef = useRef(wheelItems);
  useEffect(() => { wheelItemsRef.current = wheelItems; }, [wheelItems]);

  // Stable ref so the RAF spin closure always calls the latest appendSpinTabResult
  const appendSpinTabResultRef = useRef(appendSpinTabResult);
  useEffect(() => { appendSpinTabResultRef.current = appendSpinTabResult; }, [appendSpinTabResult]);

  const drawWheel = useCallback((angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    if (W < 32) return;
    const cx = W / 2, r = W / 2 - 8;
    const cs            = getComputedStyle(canvas);
    const colBgElevated = cs.getPropertyValue('--bg-elevated').trim() || '#2a2a2a';
    const colBgSurface  = cs.getPropertyValue('--bg-surface').trim()  || '#1a1a1a';
    const colBorderMid  = cs.getPropertyValue('--border-mid').trim()  || '#444';
    const colTextDim    = cs.getPropertyValue('--text-dim').trim()    || '#888';
    ctx.clearRect(0, 0, W, W);
    if (!wheelItems.length) {
      ctx.fillStyle = colBgElevated;
      ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colTextDim;
      ctx.font = '14px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Add items to spin', cx, cx + 5);
      return;
    }
    const slice = (Math.PI * 2) / wheelItems.length;
    wheelItems.forEach((m, i) => {
      const start = angle + i * slice, end = start + slice;
      ctx.beginPath(); ctx.moveTo(cx, cx); ctx.arc(cx, cx, r, start, end); ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      ctx.translate(cx, cx); ctx.rotate(start + slice / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(13, 140 / wheelItems.length)}px Syne, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 4;
      ctx.fillText(m.length > 14 ? m.slice(0, 13) + '…' : m, r - 8, 4);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx, cx, 16, 0, Math.PI * 2);
    ctx.fillStyle = colBgSurface; ctx.fill();
    ctx.strokeStyle = colBorderMid; ctx.lineWidth = 2; ctx.stroke();
  }, [items]);

  useEffect(() => { drawWheel(angleRef.current); }, [items, drawWheel, wheelSize]);

  // Broadcast on SpinTab's own isolated live-wheel field — never touches Maps tab's spinState.
  const broadcastSpinState = useCallback(async (state: SpinState | null) => {
    await updateSpinTabState(state);
  }, [updateSpinTabState]);

  const spin = useCallback(() => {
    if (spinning || !wheelItems.length) return;
    setSpinning(true);
    setSpunItem('');
    const extra     = (5 + Math.random() * 6) * Math.PI * 2 + Math.random() * Math.PI * 2;
    const dur       = 3200 + Math.random() * 1200;
    const a0        = angleRef.current;
    const targetAngle = a0 + extra;
    const startTime = Date.now();
    broadcastSpinState({ spinning: true, startAngle: a0, targetAngle, startTime, duration: dur, result: '' });
    const tick = async () => {
      const tAbs = Math.min(1, (Date.now() - startTime) / dur);
      angleRef.current = a0 + extra * (1 - Math.pow(1 - tAbs, 4));
      drawWheel(angleRef.current);
      if (tAbs < 1) { rafRef.current = requestAnimationFrame(tick); return; }
      setSpinning(false);
      const currentItems = wheelItemsRef.current;
      if (!currentItems.length) return;
      const slice  = (Math.PI * 2) / currentItems.length;
      const norm   = ((-Math.PI / 2 - angleRef.current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const result = currentItems[Math.floor(norm / slice) % currentItems.length];

      setSpunItem(result);                                   // show modal (clean string)
      await appendSpinTabResultRef.current(result);           // record in results history

      broadcastSpinState({ spinning: false, startAngle: a0, targetAngle, startTime, duration: dur, result });
      setTimeout(() => broadcastSpinState(null), 1000);
    };
    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, wheelItems.length, drawWheel, broadcastSpinState]);

  // ─── Live spin listener — viewer side only ─────────────────────────────────
  // liveSpin comes from spinTabState, a field fully isolated from Maps tab's
  // spinState, so no tag-based filtering is needed here.
  const prevSpinRef = useRef<SpinState | null>(null);
  useEffect(() => {
    if (isAdmin) return;
    if (!liveSpin) return;

    const prev = prevSpinRef.current;
    prevSpinRef.current = liveSpin;

    if (!liveSpin.spinning && liveSpin.result) {
      if (!prev || prev.result !== liveSpin.result || prev.spinning) {
        const age = Date.now() - (liveSpin.startTime + liveSpin.duration);
        if (age > 10000) return;
        const { startAngle: a0, targetAngle, startTime, duration: dur } = liveSpin;
        if (Date.now() - startTime >= dur) {
          angleRef.current = targetAngle; drawWheel(angleRef.current);
        } else {
          setSpinning(true);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          const animate = () => {
            const tAbs = Math.min(1, (Date.now() - startTime) / dur);
            angleRef.current = a0 + (targetAngle - a0) * (1 - Math.pow(1 - tAbs, 4));
            drawWheel(angleRef.current);
            if (tAbs < 1) { rafRef.current = requestAnimationFrame(animate); } else { setSpinning(false); }
          };
          rafRef.current = requestAnimationFrame(animate);
        }
      }
      return;
    }
    if (liveSpin.spinning) {
      if (prev?.startTime === liveSpin.startTime) return;
      setSpinning(true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const { startAngle: a0, targetAngle, startTime, duration: dur } = liveSpin;
      const animate = () => {
        const tAbs = Math.min(1, (Date.now() - startTime) / dur);
        angleRef.current = a0 + (targetAngle - a0) * (1 - Math.pow(1 - tAbs, 4));
        drawWheel(angleRef.current);
        if (tAbs < 1) { rafRef.current = requestAnimationFrame(animate); } else { setSpinning(false); }
      };
      rafRef.current = requestAnimationFrame(animate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSpin, isAdmin, drawWheel]);

  useEffect(() => {
    const el = wheelWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const size = Math.floor(Math.min(width, Math.max(0, height - 104)));
      if (size >= 32) setWheelSize(size);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleAddItem = async () => {
    if (busy) return;
    const name = itemInput.trim();
    if (!name) return;
    setBusy(true);
    try { await appendSpinTabQueue(name); setItemInput(''); } finally { setBusy(false); }
  };

  const handleDeletePoolItem = async (idx: number) => {
    if (busy) return;
    setBusy(true);
    try { await removeSpinTabQueueItem(idx); } finally { setBusy(false); }
  };

  // Delete-by-name variant for the spun-result modal (removes first matching pool entry)
  // Works like MapsTab's handleRemoveMap — removes by name, not index
  const handleDeleteSpunItem = async (item: string) => {
    if (busy) return;
    setBusy(true);
    try { await removeSpinTabQueueItemByName(item); } finally { setBusy(false); }
  };

  const handleRemoveResult = async (idx: number) => {
    if (busy) return;
    setBusy(true);
    try { await removeSpinTabResult(idx); } finally { setBusy(false); }
  };

  const handleClearAll = async () => {
    if (busy || (items.length === 0 && results.length === 0 && starredItems.length === 0)) return;
    setBusy(true);
    try { await clearSpinTab(); } finally { setBusy(false); }
  };

  // Restore starred items back into the wheel pool (skip duplicates)
  const handleRestorePool = async () => {
    if (busy || starredItems.length === 0) return;
    setBusy(true);
    try {
      for (const item of starredItems) {
        if (!items.includes(item)) {
          await appendSpinTabQueue(item);
        }
      }
    } finally { setBusy(false); }
  };

  // Resolve display order for the Results panel: shadow during drag, identity otherwise
  const displayResults = dragOrder
    ? dragOrder.map(i => ({ item: results[i], origIdx: i }))
    : results.map((item, i) => ({ item, origIdx: i }));

  if (loading) return (
    <div className="flex-1 flex flex-col w-full py-4 gap-5 min-h-0 overflow-hidden animate-pulse">
      <div className="h-10 w-40 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 min-h-0">
        <div className="rounded-2xl" style={{ background: 'var(--bg-elevated)' }} />
        <div className="rounded-2xl" style={{ background: 'var(--bg-elevated)', opacity: 0.6 }} />
      </div>
    </div>
  );

  return (
    <>
      <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden py-4 gap-4">
        <div className="shrink-0">
          <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Spin</h1>
          <p className="font-['DM_Mono'] text-xs t-muted">
            {isAdmin
              ? 'Add items to the wheel and spin to record results.'
              : 'Live view — spin results appear automatically'}
          </p>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">

          {/* ── Wheel panel ─────────────────────────────────────────────────── */}
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
                    placeholder="Item name…"
                    value={itemInput}
                    onChange={e => setItemInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = '')}
                  />
                  <button
                    className="shrink-0 px-4 py-2.5 font-bold rounded-xl text-sm text-white transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--accent)' }}
                    onClick={handleAddItem}
                    disabled={busy}
                  >+ Add</button>
                </div>
              </div>
            )}

            {/* Item pool chips */}
            {items.length > 0 && (
              <div className="shrink-0 max-h-[96px] overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {items.map((m, idx) => {
                    const isStarred = starredItems.includes(m);
                    return (
                      <span
                        key={`${idx}-${m}`}
                        className="inline-flex items-center gap-1.5 t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm"
                        style={{ color: 'var(--text)' }}
                      >
                        {m}
                        {isAdmin && (
                          <>
                            <button
                              className="shrink-0 transition-colors cursor-pointer text-xs leading-none"
                              style={{ color: isStarred ? 'var(--accent-gold)' : 'var(--text-dim)' }}
                              title={isStarred ? 'Unstar' : 'Star — kept after clear all'}
                              onClick={() => toggleStar(m)}
                            >★</button>
                            <button
                              className={`shrink-0 transition-colors text-[10px] leading-none ${busy ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:text-[var(--accent-red)]'}`}
                              style={{ color: 'var(--text-dim)' }}
                              title="Delete from pool"
                              onClick={() => !busy && handleDeletePoolItem(idx)}
                              disabled={busy}
                            >🗑</button>
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

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
                  disabled={spinning || wheelItems.length === 0}
                >{spinning ? '🌀 Spinning…' : '🌀 SPIN'}</button>
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

          {/* ── Spin Results panel ──────────────────────────────────────────── */}
          <div className="t-surface border t-border rounded-2xl p-5 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
              <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text">🎯 Spin Results</h2>
              {isAdmin && (
                <div className="flex items-center gap-2 flex-wrap">
                  {starredItems.length > 0 && (
                    <button
                      className={`font-['DM_Mono'] text-[10px] transition-colors whitespace-nowrap
                        ${busy ? 'opacity-30 pointer-events-none' : 'cursor-pointer hover:text-[var(--accent-gold)]'}`}
                      style={{ color: 'var(--accent-gold)' }}
                      title="Restore all starred items back into the wheel pool"
                      onClick={handleRestorePool}
                      disabled={busy}
                    >★ restore pool</button>
                  )}
                  <button
                    className={`font-['DM_Mono'] text-[10px] t-dim transition-colors whitespace-nowrap
                      ${(items.length === 0 && results.length === 0 && starredItems.length === 0) || busy ? 'opacity-30 pointer-events-none' : 'cursor-pointer hover:text-[var(--accent-red)]'}`}
                    title="Clear all results and restore starred items to wheel"
                    onClick={handleClearAll}
                    disabled={busy || (items.length === 0 && results.length === 0 && starredItems.length === 0)}
                  >clear all</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 min-h-0">
              {results.length === 0 ? (
                <p className="font-['DM_Mono'] text-xs t-dim text-center py-3">
                  Add items to the wheel and spin to see results here.
                </p>
              ) : (
                displayResults.map(({ item, origIdx }, displayIdx) => {
                  return (
                    <div
                      key={`${origIdx}-${item}`}
                      draggable={isAdmin}
                      onDragStart={isAdmin ? () => handleDragStart(origIdx) : undefined}
                      onDragEnter={isAdmin ? () => handleDragEnter(origIdx) : undefined}
                      onDragEnd={isAdmin ? handleDragEnd : undefined}
                      onDragOver={isAdmin ? e => e.preventDefault() : undefined}
                      className="flex items-center justify-between t-elevated border t-border rounded-xl px-3 py-2 gap-2"
                      style={{ cursor: isAdmin ? 'grab' : 'default' }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      {isAdmin && (
                      <span className="shrink-0 t-dim text-sm leading-none select-none">⠿</span>
                      )}
                      <span className="shrink-0 font-['DM_Mono'] text-[10px] t-dim w-5 text-right">#{displayIdx + 1}</span>
                      <span className="font-['DM_Mono'] text-sm t-text truncate">{item}</span>
                      </div>

                      {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                          <button
                            className={`font-['DM_Mono'] text-[10px] t-dim px-1 py-1 transition-colors ${busy ? 'opacity-30 cursor-not-allowed' : 'hover:text-[var(--accent-red)] cursor-pointer'}`}
                          title="Remove from results"
                        onClick={() => handleRemoveResult(origIdx)}
                      disabled={busy}
                      >✕</button>
                      </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Starred items footer */}
            {starredItems.length > 0 && (
              <div className="shrink-0">
                <hr className="t-border my-2" />
                <p className="font-['DM_Mono'] text-[11px] t-muted tracking-widest mb-2">★ STARRED</p>
                <div className="flex flex-wrap gap-2">
                  {starredItems.map(m => (
                    <div key={m} className="t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm t-text shrink-0">
                      <span className="truncate max-w-[150px]">{m}</span>
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <p className="font-['DM_Mono'] text-[10px] t-dim mt-1">starred items are restored to wheel on clear all</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Spun result modal ─────────────────────────────────────────────────── */}
      {spunItem && isAdmin && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <div className="w-full max-w-md t-surface border t-border rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-scale-in">
            <div className="text-white px-5 py-3 font-['Bebas_Neue'] text-xl tracking-widest" style={{ background: 'var(--accent-red)' }}>
              🎯 Spin Result
            </div>
            <div className="p-10 flex items-center justify-center border-b t-border t-bg">
              <p className="font-['Bebas_Neue'] text-5xl tracking-widest t-text text-center break-words">{spunItem}</p>
            </div>
            <div className="px-5 pt-3 pb-1 t-surface">
              <p className="font-['DM_Mono'] text-xs t-muted">Added to Spin Results.</p>
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-3 t-elevated border-t t-border">
              <button
                className="font-['DM_Mono'] text-sm t-muted hover:t-text transition-colors cursor-pointer"
                onClick={() => setSpunItem('')}
              >Close</button>
              <button
                className="px-4 py-2 text-white font-['DM_Mono'] text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-40 hover:opacity-90"
                style={{ background: 'var(--accent-red)' }}
                onClick={() => { handleDeleteSpunItem(spunItem); setSpunItem(''); }}
              >Delete from pool</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
