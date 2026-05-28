'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import { WHEEL_COLORS } from '@/lib/utils';
import type { SpinState } from '@/lib/types';

export function MapsTab() {
  const {
    maps, isAdmin, loading,
    addMap, removeMap, appendSpinQueue, clearSpinQueue,
    adminToken, spinState: liveSpin,
    spinQueue, removeSpinQueueItem,
    spinCategories: serverCategories,
    spinItemCategory: serverItemCategory,
    saveSpinCategories,
  } = useTourney();

  const [mapInput, setMapInput] = useState('');
  const [mapErr, setMapErr] = useState('');
  const [busy, setBusy] = useState(false);

  // ─── Categories ───────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<string[]>(serverCategories);
  const [itemCategory, setItemCategoryState] = useState<Record<number, string>>(serverItemCategory);
  const [newCatInput, setNewCatInput] = useState('');
  // activeCategory = which category is "checked" — next spin result auto-assigns here
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Ref so the RAF spin closure can always read the latest value without stale closure issues
  const activeCategoryRef = useRef<string | null>(null);
  useEffect(() => { activeCategoryRef.current = activeCategory; }, [activeCategory]);

  // itemCategory ref — same reason: spin tick reads it after await
  const itemCategoryRef = useRef(itemCategory);
  useEffect(() => { itemCategoryRef.current = itemCategory; }, [itemCategory]);

  // categories ref — needed so saveItemCategory can read latest cats without stale closure
  const categoriesRef = useRef(categories);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);

  // Keep local state in sync when server pushes updates (viewer side)
  useEffect(() => { setCategories(serverCategories); }, [serverCategories]);
  useEffect(() => { setItemCategoryState(serverItemCategory); itemCategoryRef.current = serverItemCategory; }, [serverItemCategory]);

  // spinQueue length ref — used to know the index of the newly appended item
  const spinQueueLenRef = useRef(spinQueue.length);
  useEffect(() => { spinQueueLenRef.current = spinQueue.length; }, [spinQueue.length]);

  // ─── Drag state ───────────────────────────────────────────────────────────────
  const [uncatOrder, setUncatOrder] = useState<number[]>([]);
  const dragQueueIdxRef = useRef<number | null>(null);
  const dragOverUncatRef = useRef<number | null>(null);
  const [dropTargetCat, setDropTargetCat] = useState<string | null>(null);

  // catOrders: per-category ordered list of queue indices
  const [catOrders, setCatOrders] = useState<Record<string, number[]>>({});
  const dragSourceCatRef = useRef<string | null>(null);

  useEffect(() => {
    const uncatIdxs = spinQueue.map((_, i) => i).filter(i => !itemCategory[i]);
    setUncatOrder(prev => {
      const kept = prev.filter(i => uncatIdxs.includes(i));
      const added = uncatIdxs.filter(i => !prev.includes(i));
      return [...kept, ...added];
    });
    // Sync catOrders for each category
    setCatOrders(prev => {
      const next: Record<string, number[]> = {};
      categories.forEach(cat => {
        const catIdxs = spinQueue.map((_, i) => i).filter(i => itemCategory[i] === cat);
        const prevOrder = prev[cat] ?? [];
        const kept = prevOrder.filter(i => catIdxs.includes(i));
        const added = catIdxs.filter(i => !prevOrder.includes(i));
        next[cat] = [...kept, ...added];
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinQueue.length, categories.length]);

  const saveCategories = (cats: string[]) => {
    setCategories(cats);
    saveSpinCategories(cats, itemCategoryRef.current);
  };
  const saveItemCategory = (map: Record<number, string>) => {
    setItemCategoryState(map);
    itemCategoryRef.current = map;
    saveSpinCategories(categoriesRef.current, map);
  };

  const addCategory = () => {
    const name = newCatInput.trim();
    if (!name || categories.includes(name)) return;
    saveCategories([...categories, name]);
    setNewCatInput('');
  };

  const removeCategory = (cat: string) => {
    saveCategories(categories.filter(c => c !== cat));
    if (activeCategory === cat) setActiveCategory(null);
    const next = { ...itemCategoryRef.current };
    Object.keys(next).forEach(k => { if (next[Number(k)] === cat) delete next[Number(k)]; });
    saveItemCategory(next);
  };

  const assignItemCategory = (idx: number, cat: string | null) => {
    const next = { ...itemCategoryRef.current };
    if (cat === null) delete next[idx];
    else next[idx] = cat;
    saveItemCategory(next);
    if (cat !== null) {
      setUncatOrder(prev => prev.filter(i => i !== idx));
      setCatOrders(prev => {
        const prevCat = prev[cat] ?? [];
        return { ...prev, [cat]: prevCat.includes(idx) ? prevCat : [...prevCat, idx] };
      });
    } else {
      setUncatOrder(prev => prev.includes(idx) ? prev : [...prev, idx]);
      // Remove from all category orders
      setCatOrders(prev => {
        const updated: Record<string, number[]> = {};
        Object.entries(prev).forEach(([c, arr]) => { updated[c] = arr.filter(i => i !== idx); });
        return updated;
      });
    }
  };

  const reindexCategories = (removedIdx: number) => {
    const next: Record<number, string> = {};
    Object.entries(itemCategoryRef.current).forEach(([k, v]) => {
      const ki = Number(k);
      if (ki < removedIdx) next[ki] = v;
      else if (ki > removedIdx) next[ki - 1] = v;
    });
    saveItemCategory(next);
    setUncatOrder(prev =>
      prev.filter(i => i !== removedIdx).map(i => (i > removedIdx ? i - 1 : i))
    );
    setCatOrders(prev => {
      const updated: Record<string, number[]> = {};
      Object.entries(prev).forEach(([cat, arr]) => {
        updated[cat] = arr
          .filter(i => i !== removedIdx)
          .map(i => (i > removedIdx ? i - 1 : i));
      });
      return updated;
    });
  };

  // ─── Restore helpers ──────────────────────────────────────────────────────────
  // All unique maps that appear in the spin queue but are no longer in the wheel pool
  const getMissingFromPool = () =>
    [...new Set(spinQueue)].filter(m => !maps.includes(m));

  // ─── Drag handlers ─────────────────────────────────────────────────────────────
  // Uncat drag
  const handleUncatDragStart = (queueIdx: number) => {
    dragQueueIdxRef.current = queueIdx;
    dragSourceCatRef.current = null;
  };
  const handleUncatDragEnter = (orderIdx: number) => {
    dragOverUncatRef.current = orderIdx;
    const draggingQueueIdx = dragQueueIdxRef.current;
    if (draggingQueueIdx === null || dragSourceCatRef.current !== null) return;
    setUncatOrder(prev => {
      const fromOrderIdx = prev.indexOf(draggingQueueIdx);
      if (fromOrderIdx === -1 || fromOrderIdx === orderIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromOrderIdx, 1);
      next.splice(orderIdx, 0, moved);
      return next;
    });
  };
  const handleUncatDragEnd = () => {
    dragQueueIdxRef.current = null;
    dragOverUncatRef.current = null;
    dragSourceCatRef.current = null;
    setDropTargetCat(null);
  };

  // Categorised drag (reorder within same category)
  const handleCatItemDragStart = (queueIdx: number, cat: string) => {
    dragQueueIdxRef.current = queueIdx;
    dragSourceCatRef.current = cat;
  };
  const handleCatItemDragEnter = (orderIdx: number, cat: string) => {
    const draggingQueueIdx = dragQueueIdxRef.current;
    if (draggingQueueIdx === null || dragSourceCatRef.current !== cat) return;
    setCatOrders(prev => {
      const arr = [...(prev[cat] ?? [])];
      const fromOrderIdx = arr.indexOf(draggingQueueIdx);
      if (fromOrderIdx === -1 || fromOrderIdx === orderIdx) return prev;
      const [moved] = arr.splice(fromOrderIdx, 1);
      arr.splice(orderIdx, 0, moved);
      return { ...prev, [cat]: arr };
    });
  };
  const handleCatItemDragEnd = () => {
    dragQueueIdxRef.current = null;
    dragSourceCatRef.current = null;
    setDropTargetCat(null);
  };

  // Drop onto category zone (from uncategorised)
  const handleCatDragOver = (e: React.DragEvent, cat: string) => {
    e.preventDefault();
    setDropTargetCat(cat);
  };
  const handleCatDragLeave = () => setDropTargetCat(null);
  const handleCatDrop = (e: React.DragEvent, cat: string) => {
    e.preventDefault();
    const queueIdx = dragQueueIdxRef.current;
    if (queueIdx === null) return;
    assignItemCategory(queueIdx, cat);
    dragQueueIdxRef.current = null;
    dragSourceCatRef.current = null;
    setDropTargetCat(null);
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wheelWrapRef = useRef<HTMLDivElement>(null);
  const [wheelSize, setWheelSize] = useState(220);
  const angleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const rafRef = useRef<number | null>(null);
  const [spunMap, setSpunMap] = useState('');

  const mapsRef = useRef(maps);
  useEffect(() => { mapsRef.current = maps; }, [maps]);

  const appendSpinQueueRef = useRef(appendSpinQueue);
  useEffect(() => { appendSpinQueueRef.current = appendSpinQueue; }, [appendSpinQueue]);

  // defaultMaps = starred maps — persistent, survive clear/reset
  const [defaultMaps, setDefaultMaps] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('defaultMaps') ?? '[]'); } catch { return []; }
  });

  // knownMaps = every map ever added — never shrinks, used for MAP POOL DEFAULTS display
  const [knownMaps, setKnownMaps] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('knownMaps') ?? '[]'); } catch { return []; }
  });

  // Grow knownMaps whenever new maps appear in the live pool
  useEffect(() => {
    setKnownMaps(prev => {
      const added = maps.filter(m => !prev.includes(m));
      if (added.length === 0) return prev;
      const next = [...prev, ...added];
      localStorage.setItem('knownMaps', JSON.stringify(next));
      return next;
    });
  }, [maps]);

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

  // ↩ restore pool — add back every map that's in the queue but missing from the wheel, keep results
  const handleRestoreMapPool = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const missing = getMissingFromPool();
      if (missing.length > 0) await Promise.all(missing.map(m => addMap(m)));
    } finally { setBusy(false); }
  };

  // clear all — restore only starred maps to wheel, remove non-starred, wipe spin queue
  const handleClearAll = async () => {
    if (busy || spinQueue.length === 0) return;
    setBusy(true);
    try {
      // Remove non-starred maps from pool
      const toRemove = maps.filter(m => !defaultMaps.includes(m));
      if (toRemove.length > 0) await Promise.all(toRemove.map(m => removeMap(m)));
      // Restore starred maps that were removed from pool
      const toRestore = defaultMaps.filter(m => !maps.includes(m));
      if (toRestore.length > 0) await Promise.all(toRestore.map(m => addMap(m)));
      await clearSpinQueue();
      saveSpinCategories(categoriesRef.current, {});
      setItemCategoryState({});
      itemCategoryRef.current = {};
      setUncatOrder([]);
      setCatOrders({});
    } finally { setBusy(false); }
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

  // ─── Draw wheel ───────────────────────────────────────────────────────────────
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

  const broadcastSpinState = useCallback(async (state: SpinState | null) => {
    await fetch('/api/maps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(adminToken ? { 'X-Admin-Token': adminToken } : {}) },
      body: JSON.stringify({ action: 'updateSpinState', spinState: state }),
    });
  }, [adminToken]);

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
      if (tAbs < 1) { rafRef.current = requestAnimationFrame(tick); return; }
      setSpinning(false);
      const currentMaps = mapsRef.current;
      const slice = (Math.PI * 2) / currentMaps.length;
      const norm = ((-Math.PI / 2 - angleRef.current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const result = currentMaps[Math.floor(norm / slice) % currentMaps.length];
      setSpunMap(result);

      const newItemIdx = spinQueueLenRef.current;
      await appendSpinQueueRef.current(result);

      const cat = activeCategoryRef.current;
      if (cat) {
        const next = { ...itemCategoryRef.current, [newItemIdx]: cat };
        saveItemCategory(next);
      }

      broadcastSpinState({ spinning: false, startAngle: a0, targetAngle, startTime, duration: dur, result });
      setTimeout(() => broadcastSpinState(null), 1000);
    };
    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, maps.length, drawWheel, broadcastSpinState]);

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
  }, [liveSpin, isAdmin, drawWheel]);

  useEffect(() => {
    const el = wheelWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const size = Math.floor(Math.min(width, Math.max(0, height - 104)));
      if (size > 0) setWheelSize(size);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const buildGroups = () => {
    const grouped: Array<{ cat: string | null; items: Array<{ idx: number; map: string }> }> = [];
    categories.forEach(cat => {
      const catOrder = catOrders[cat] ?? [];
      // Use catOrder for ordering, fall back to natural order for any stragglers
      const catIdxs = spinQueue.map((_, i) => i).filter(i => itemCategory[i] === cat);
      const orderedIdxs = [
        ...catOrder.filter(i => catIdxs.includes(i)),
        ...catIdxs.filter(i => !catOrder.includes(i)),
      ];
      const items = orderedIdxs.map(i => ({ idx: i, map: spinQueue[i] }));
      grouped.push({ cat, items });
    });
    const uncatItems = uncatOrder
      .filter(i => i < spinQueue.length && !itemCategory[i])
      .map(i => ({ idx: i, map: spinQueue[i] }));
    if (uncatItems.length > 0 || categories.length === 0) grouped.push({ cat: null, items: uncatItems });
    return grouped;
  };

  const missingFromPool = getMissingFromPool();

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
                  >+ Add</button>
                </div>
                {mapErr && <p className="font-['DM_Mono'] text-xs mt-1" style={{ color: 'var(--accent-red)' }}>{mapErr}</p>}
              </div>
            )}

            <div className="shrink-0 max-h-[96px] overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {maps.map(m => {
                  const isDefault = defaultMaps.includes(m);
                  return (
                    <span key={m} className="inline-flex items-center gap-1.5 t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm t-text">
                      {m}
                      {isAdmin && (
                        <>
                          <button
                            className="shrink-0 transition-colors cursor-pointer text-xs leading-none"
                            style={{ color: isDefault ? 'var(--accent-gold)' : 'var(--text-dim)' }}
                            title={isDefault ? 'Unstar — removed on reset' : 'Star — keep after reset'}
                            onClick={() => toggleDefault(m)}
                          >★</button>
                          <span
                            className={`t-dim transition-colors shrink-0 ${busy ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:text-[var(--accent-red)]'}`}
                            onClick={() => !busy && handleRemoveMap(m)}
                          >✕</span>
                        </>
                      )}
                    </span>
                  );
                })}
                {maps.length === 0 && <p className="font-['DM_Mono'] text-xs t-dim">{isAdmin ? 'No maps yet.' : 'No maps added.'}</p>}
              </div>
            </div>

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
              <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text">🎯 Spin Results Queue</h2>
              {isAdmin && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* restore pool — add back all maps that are in the queue but removed from wheel */}
                  <button
                    className={`font-['DM_Mono'] text-[10px] whitespace-nowrap t-dim transition-colors
                      ${busy || missingFromPool.length === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:text-[var(--accent-green)]'}`}
                    title={missingFromPool.length === 0 ? 'All maps already in pool' : `Restore ${missingFromPool.length} map(s) back to wheel`}
                    onClick={handleRestoreMapPool}
                    disabled={busy || missingFromPool.length === 0}
                  >↩ restore pool</button>
                  {/* clear all — restore maps to wheel AND clear the result queue */}
                  <button
                    className={`font-['DM_Mono'] text-[10px] t-dim transition-colors whitespace-nowrap
                      ${spinQueue.length === 0 || busy ? 'opacity-30 pointer-events-none' : 'cursor-pointer hover:text-[var(--accent-red)]'}`}
                    title="Restore all maps to wheel and clear result queue"
                    onClick={handleClearAll}
                    disabled={busy || spinQueue.length === 0}
                  >clear all</button>
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="shrink-0 flex gap-2">
                <input
                  type="text"
                  className="flex-1 t-elevated border t-border rounded-lg px-2.5 py-1 font-['DM_Mono'] text-[11px] t-text outline-none"
                  placeholder="Add category e.g. Upper 1st Round"
                  value={newCatInput}
                  onChange={e => setNewCatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCategory()}
                />
                <button
                  className="shrink-0 px-3 py-1 rounded-lg font-['DM_Mono'] text-[11px] font-bold text-white cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                  onClick={addCategory}
                >+ Add</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0">
              {spinQueue.length === 0 && categories.length === 0 ? (
                <p className="font-['DM_Mono'] text-xs t-dim text-center py-3">Spin the wheel to build a map queue.</p>
              ) : (
                buildGroups().map(({ cat, items }) => {
                  const isActive = cat !== null && activeCategory === cat;
                  const isDropTarget = cat !== null && dropTargetCat === cat;

                  return (
                    <div
                      key={cat ?? '__uncat'}
                      className="flex flex-col gap-0.5"
                      onDragOver={cat !== null ? e => handleCatDragOver(e, cat) : undefined}
                      onDragLeave={cat !== null ? handleCatDragLeave : undefined}
                      onDrop={cat !== null ? e => handleCatDrop(e, cat) : undefined}
                    >
                      {/* Group header */}
                      <div
                        className="flex items-center gap-2 mb-1 mt-0.5 rounded-md px-1 py-0.5 transition-colors"
                        style={{ background: isDropTarget ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}
                      >
                        {cat !== null && isAdmin && (
                          <button
                            className="shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer"
                            style={{
                              background: isActive ? 'var(--accent)' : 'transparent',
                              borderColor: isActive ? 'var(--accent)' : 'var(--border-mid)',
                            }}
                            title={isActive ? 'Deactivate — spins go to uncategorised' : 'Activate — next spins auto-assign here'}
                            onClick={() => setActiveCategory(isActive ? null : cat)}
                          >
                            {isActive && (
                              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        )}

                        <span
                          className="font-['DM_Mono'] text-[10px] tracking-widest font-bold shrink-0 select-none"
                          style={{ color: cat ? 'var(--accent)' : 'var(--text-dim)' }}
                        >{cat ? cat.toUpperCase() : 'UNCATEGORISED'}</span>

                        <div
                          className="flex-1 h-px transition-all"
                          style={{ background: cat ? 'var(--accent)' : 'var(--border-mid)', opacity: isDropTarget ? 0.8 : 0.35 }}
                        />

                        {isDropTarget && (
                          <span className="font-['DM_Mono'] text-[9px] shrink-0" style={{ color: 'var(--accent)' }}>drop here</span>
                        )}

                        {cat !== null && isAdmin && (
                          <button
                            className="shrink-0 font-['DM_Mono'] text-[10px] t-dim hover:text-[var(--accent-red)] transition-colors cursor-pointer leading-none opacity-40 hover:opacity-100"
                            onClick={() => removeCategory(cat)}
                            title="Remove category"
                          >✕</button>
                        )}
                      </div>

                      {items.length === 0 && cat !== null && (
                        <p
                          className="font-['DM_Mono'] text-[10px] t-dim pl-2 italic py-1.5 rounded border border-dashed transition-colors"
                          style={{ borderColor: isDropTarget ? 'var(--accent)' : 'transparent' }}
                        >
                          {isDropTarget ? 'Release to assign' : isActive ? 'Next spin result goes here' : 'No maps yet — drag from uncategorised'}
                        </p>
                      )}

                      {items.map(({ idx, map: m }, orderIdx) => {
                        const isRemoved = !maps.includes(m);
                        const isUncat = cat === null;
                        const isDraggable = isAdmin;

                        return (
                          <div
                            key={idx}
                            draggable={isDraggable}
                            onDragStart={isDraggable ? () => (isUncat ? handleUncatDragStart(idx) : handleCatItemDragStart(idx, cat!)) : undefined}
                            onDragEnter={isDraggable ? () => (isUncat ? handleUncatDragEnter(orderIdx) : handleCatItemDragEnter(orderIdx, cat!)) : undefined}
                            onDragEnd={isDraggable ? (isUncat ? handleUncatDragEnd : handleCatItemDragEnd) : undefined}
                            onDragOver={isDraggable ? e => e.preventDefault() : undefined}
                            className="flex items-center justify-between t-elevated border t-border rounded-xl px-3 py-2 gap-2 transition-opacity"
                            style={{ cursor: isDraggable ? 'grab' : 'default' }}
                          >
                            <div className="flex items-center gap-2 overflow-hidden min-w-0">
                              {isDraggable && (
                                <span className="shrink-0 t-dim text-sm leading-none select-none">⠿</span>
                              )}
                              <span className="shrink-0 font-['DM_Mono'] text-[10px] t-dim w-5 text-right">#{idx + 1}</span>
                              <span className="font-['DM_Mono'] text-sm t-text truncate">🗺 {m}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isAdmin && isRemoved && (
                                <button
                                  className={`font-['DM_Mono'] text-[10px] t-dim px-1 py-1 transition-colors ${busy ? 'opacity-30 cursor-not-allowed' : 'hover:text-[var(--accent-green)] cursor-pointer'}`}
                                  title="Restore this map to pool"
                                  onClick={() => handleRestoreMap(m)}
                                  disabled={busy}
                                >↩</button>
                              )}
                              {isAdmin && (
                                <button
                                  className={`font-['DM_Mono'] text-[10px] t-dim px-1 py-1 transition-colors ${busy ? 'opacity-30 cursor-not-allowed' : 'hover:text-[var(--accent-red)] cursor-pointer'}`}
                                  onClick={() => handleRemoveQueueItem(idx)}
                                  disabled={busy}
                                >✕</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            <div className="shrink-0">
              <hr className="t-border my-2" />
              <p className="font-['DM_Mono'] text-[11px] t-muted tracking-widest mb-2">MAP POOL DEFAULTS</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {defaultMaps.length === 0
                  ? <p className="font-['DM_Mono'] text-xs t-dim">{isAdmin ? 'Star maps in the wheel panel to pin them here.' : 'No default maps set.'}</p>
                  : defaultMaps.map(m => (
                    <div key={m} className="t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm t-text shrink-0">
                      <span className="truncate max-w-[150px]">★ {m}</span>
                    </div>
                  ))
                }
              </div>
              {isAdmin && defaultMaps.length > 0 && (
                <p className="font-['DM_Mono'] text-[10px] t-dim">starred maps are restored to the wheel on clear all</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {spunMap && isAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#1e1e1e] border border-[var(--border-mid)] rounded overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-[#d32f2f] text-white px-5 py-3 font-semibold text-lg">We have a winner!</div>
            <div className="p-10 flex items-center justify-center border-b border-[#333]">
              <p className="text-white text-5xl font-light tracking-wide text-center break-words">{spunMap}</p>
            </div>
            <div className="px-5 py-4 flex items-center justify-end gap-4 bg-[#242424]">
              <button className="text-sm text-gray-300 hover:text-white font-medium transition-colors cursor-pointer" onClick={() => setSpunMap('')}>Close</button>
              <button
                className="px-4 py-2 bg-[#5c7cfa] hover:bg-[#4c6cf0] text-white text-sm font-semibold rounded shadow-sm transition-colors cursor-pointer"
                onClick={() => { handleRemoveMap(spunMap); setSpunMap(''); }}
              >Remove from pool</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
