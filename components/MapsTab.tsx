'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import { WHEEL_COLORS, parseStageMaps } from '@/lib/utils';

export function MapsTab({ spunMap, onSpunMap, spinResults, onSpinResultsChange }: {
  spunMap: string;
  onSpunMap: (map: string) => void;
  spinResults: string[];
  onSpinResultsChange: (results: string[]) => void;
}) {
  const { maps, stageMaps, bracket, isAdmin, loading, addMap, removeMap, assignStage, clearStage } = useTourney();
  const [mapInput, setMapInput] = useState('');
  const [mapErr, setMapErr] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  // Spin results queue — managed by parent, each spin appends
  // Default maps — persisted in localStorage per-session for admin
  const [defaultMaps, setDefaultMaps] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('defaultMaps') ?? '[]'); } catch { return []; }
  });
  // Removed maps that were in the pool (for restore button)
  const [removedFromPool, setRemovedFromPool] = useState<string[]>([]);

  const toggleDefault = (map: string) => {
    setDefaultMaps(prev => {
      const next = prev.includes(map) ? prev.filter(m => m !== map) : [...prev, map];
      localStorage.setItem('defaultMaps', JSON.stringify(next));
      return next;
    });
  };

  const handleRestoreMap = async (map: string) => {
    const result = await addMap(map);
    if (!result?.error) {
      setRemovedFromPool(prev => prev.filter(m => m !== map));
    }
  };

  const getStageMaps = (key: string): string[] => parseStageMaps(stageMaps[key]);

  if (loading) return (
    <div className="flex-1 flex flex-col w-full py-6 gap-5 animate-pulse">
      <div className="h-10 w-40 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl" style={{ background: 'var(--bg-elevated)' }} />
        <div className="rounded-2xl" style={{ background: 'var(--bg-elevated)', opacity: 0.6 }} />
      </div>
    </div>
  );

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
      ctx.fillText(m.length > 14 ? m.slice(0, 13) + '…' : m, r - 8, 4);
      ctx.restore();
    });

    ctx.beginPath(); ctx.arc(cx, cx, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--bg-surface)'; ctx.fill();
    ctx.strokeStyle = 'var(--border-mid)'; ctx.lineWidth = 2; ctx.stroke();
  }, [maps]);

  useEffect(() => { drawWheel(angleRef.current); }, [maps, drawWheel]);

  const spin = () => {
    if (spinning || !maps.length) return;
    setSpinning(true); onSpunMap('');
    const extra = (5 + Math.random() * 6) * Math.PI * 2 + Math.random() * Math.PI * 2;
    const dur = 3200 + Math.random() * 1200;
    const t0 = performance.now(), a0 = angleRef.current;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      angleRef.current = a0 + extra * (1 - Math.pow(1 - t, 4));
      drawWheel(angleRef.current);
      if (t < 1) { requestAnimationFrame(tick); return; }
      setSpinning(false);
      const slice = (Math.PI * 2) / maps.length;
      const pointerAngle = -Math.PI / 2;
      const norm = ((pointerAngle - angleRef.current) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const result = maps[Math.floor(norm / slice) % maps.length];
      onSpunMap(result);
      // Append to spin results queue — parent handles accumulation
    };
    requestAnimationFrame(tick);
  };

  const handleAddMap = async () => {
    const name = mapInput.trim();
    if (!name) return;
    const result = await addMap(name);
    if (result?.error) { setMapErr(result.error); return; }
    setMapInput(''); setMapErr('');
  };

  const getStageLabels = () => {
    if (!bracket) return [];
    const labels: { key: string; label: string }[] = [];
    bracket.upper.forEach((_, ri) => labels.push({ key: `upper_r${ri}`, label: `Winners R${ri + 1}` }));
    if (bracket.type === 'double' && bracket.lower) {
      bracket.lower.forEach((r, ri) => {
        if (r.length) labels.push({ key: `lower_r${ri}`, label: `Losers R${ri + 1}` });
      });
      if (bracket.grandFinal && (bracket.grandFinal.p1 || bracket.grandFinal.p2)) {
        labels.push({ key: 'gf', label: 'Grand Final' });
      }
    }
    return labels;
  };

  const stages = getStageLabels();

  const usedMaps = new Set(
    Object.values(stageMaps).flatMap(v => parseStageMaps(v))
  );

  return (
    <div className="flex-1 flex flex-col w-full py-4 gap-4 min-h-0">

      <div>
        <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Map Selector</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">
          {isAdmin ? 'Spin the wheel · Drag maps onto bracket stages · Each stage supports up to 3 maps' : 'View only — admin required to edit'}
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">

        {/* Wheel panel */}
        <div className="t-surface border t-border rounded-2xl p-4 flex flex-col gap-3 overflow-y-auto">
          <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text">🎡 Wheel</h2>

          {isAdmin && (
            <>
              <div className="flex gap-3">
                <input
                  type="text"
                  className="flex-1 t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none transition-colors"
                  placeholder="Map name…"
                  value={mapInput}
                  onChange={e => setMapInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMap()}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = '')}
                />
                <button
                  className="px-4 py-2.5 font-bold rounded-xl text-sm text-white transition-all cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                  onClick={handleAddMap}
                >
                  + Add
                </button>
              </div>
              {mapErr && <p className="font-['DM_Mono'] text-xs" style={{ color: 'var(--accent-red)' }}>{mapErr}</p>}
            </>
          )}

          <div className="flex flex-wrap gap-2 min-h-8">
            {maps.map(m => (
              <span key={m} className="inline-flex items-center gap-1.5 t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm t-text">
                {m}
                {isAdmin && (
                  <span className="cursor-pointer t-dim hover:text-[var(--accent-red)] transition-colors" onClick={() => removeMap(m)}>✕</span>
                )}
              </span>
            ))}
            {maps.length === 0 && <p className="font-['DM_Mono'] text-xs t-dim">{isAdmin ? 'No maps yet.' : 'No maps added.'}</p>}
          </div>

        <div className="flex flex-col items-center gap-2">
            <span className="text-3xl rotate-90" style={{ color: 'var(--accent-red)' }}>▶</span>
            <canvas ref={canvasRef} width={220} height={220} className="rounded-full drop-shadow-sm" />
            <button
              className="px-6 py-2 text-white font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: 'var(--accent-red)' }}
              onClick={spin}
              disabled={spinning || maps.length === 0}
            >
              🌀 SPIN
            </button>

            {spunMap && (
              <div className="flex flex-col items-center gap-2 w-full">
                <p className="font-['Bebas_Neue'] text-2xl tracking-widest" style={{ color: 'var(--accent-gold)' }}>🎯 {spunMap}</p>
                {isAdmin && (
                  <button
                    className="w-full px-3 py-2 font-['DM_Mono'] text-xs border t-border-mid t-muted t-elevated rounded-xl transition-colors cursor-pointer"
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
                    onClick={async () => { await removeMap(spunMap); setRemovedFromPool(prev => [...prev, spunMap]); onSpunMap(''); }}
                  >
                    🗑 Remove from pool
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Spin Results panel */}
        <div className="t-surface border t-border rounded-2xl p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text">🎯 Spin Results</h2>
            {isAdmin && spinResults.length > 0 && (
              <button
                className="font-['DM_Mono'] text-[10px] t-dim hover:text-[var(--accent-red)] transition-colors cursor-pointer"
                onClick={() => onSpinResultsChange([])}
              >clear all</button>
            )}
          </div>
          {/* Spin results queue — each round in bracket consumes one */}
          <div className="flex flex-col gap-1.5">
            {spinResults.length === 0 ? (
              <p className="font-['DM_Mono'] text-xs t-dim text-center py-3">Spin the wheel to build a map queue for rounds.</p>
            ) : (
              spinResults.map((m, i) => (
                <div key={i} className="flex items-center justify-between t-elevated border t-border rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-['DM_Mono'] text-[10px] t-dim w-5 text-right">#{i + 1}</span>
                    <span className="font-['DM_Mono'] text-sm t-text">🗺 {m}</span>
                  </div>
                  {isAdmin && (
                    <button
                      className="font-['DM_Mono'] text-[10px] t-dim hover:text-[var(--accent-red)] cursor-pointer transition-colors"
                      onClick={() => onSpinResultsChange(spinResults.filter((_, idx) => idx !== i))}
                    >✕</button>
                  )}
                </div>
              ))
            )}
          </div>

          <hr className="t-border" />
          <h3 className="font-['Bebas_Neue'] text-lg tracking-widest t-text">📌 Stage Assignment</h3>

          {!bracket ? (
            <p className="font-['DM_Mono'] text-xs t-dim text-center py-4">Generate a bracket first.</p>
          ) : (
            <div className="space-y-2">
              {stages.map(s => {
                const stageMapsArr = getStageMaps(s.key);
                return (
                  <div key={s.key} className="t-elevated border t-border rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-['Bebas_Neue'] text-sm tracking-widest t-text">{s.label}</span>
                      <span className="font-['DM_Mono'] text-[10px] t-dim">{stageMapsArr.length}/3</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {Array.from({ length: 3 }, (_, slotIdx) => {
                        const map = stageMapsArr[slotIdx];
                        const isOver = dragOverStage === s.key && dragOverSlot === slotIdx;
                        return (
                          <div
                            key={slotIdx}
                            className="flex-1 min-w-[80px] min-h-8 border-2 border-dashed rounded-lg flex items-center justify-center font-['DM_Mono'] text-xs transition-all px-2 py-1"
                            style={{
                              borderColor: map ? 'var(--accent)' : isOver ? 'var(--accent-gold)' : 'var(--border-mid)',
                              background:  map ? 'rgba(58,107,255,0.07)' : isOver ? 'rgba(224,144,16,0.07)' : undefined,
                              color: map ? 'var(--accent)' : 'var(--text-dim)',
                              borderStyle: map ? 'solid' : 'dashed',
                            }}
                            onDragOver={isAdmin ? e => { e.preventDefault(); setDragOverStage(s.key); setDragOverSlot(slotIdx); } : undefined}
                            onDragLeave={isAdmin ? () => { setDragOverStage(null); setDragOverSlot(null); } : undefined}
                            onDrop={isAdmin ? async e => {
                              e.preventDefault(); setDragOverStage(null); setDragOverSlot(null);
                              const m = e.dataTransfer.getData('text/plain');
                              if (m) await assignStage(s.key, m, slotIdx);
                            } : undefined}
                          >
                            {map ? (
                              <>
                                <span className="truncate text-[10px]">🗺 {map}</span>
                                {isAdmin && (
                                  <button
                                    className="ml-1.5 shrink-0 t-dim hover:text-[var(--accent-red)] transition-colors text-sm cursor-pointer"
                                    onClick={() => clearStage(s.key, slotIdx)}
                                  >✕</button>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px]">{isOver ? '+ drop' : `Map ${slotIdx + 1}`}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <hr className="t-border" />
          <p className="font-['DM_Mono'] text-[11px] t-muted tracking-widest">MAP POOL</p>
          <div className="flex flex-wrap gap-2">
            {maps.map(m => {
              const used = usedMaps.has(m);
              const isDefault = defaultMaps.includes(m);
              return (
                <div
                  key={m}
                  className="t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm transition-all flex items-center gap-1.5"
                  style={{ opacity: used ? 0.35 : 1, cursor: used || !isAdmin ? 'default' : 'grab' }}
                  draggable={!used && isAdmin}
                  onDragStart={e => e.dataTransfer.setData('text/plain', m)}
                  title={used ? 'Already assigned' : isAdmin ? 'Drag to a stage slot' : undefined}
                  onMouseEnter={e => { if (!used && isAdmin) { e.currentTarget.style.borderColor = 'var(--accent)'; }}}
                  onMouseLeave={e => { if (!used && isAdmin) { e.currentTarget.style.borderColor = ''; }}}
                >
                  {m}
                  {isAdmin && (
                    <button
                      title={isDefault ? 'Remove from defaults' : 'Set as default map (restored after reset)'}
                      className="transition-colors cursor-pointer text-xs leading-none"
                      style={{ color: isDefault ? 'var(--accent-gold)' : 'var(--text-dim)' }}
                      onClick={e => { e.stopPropagation(); toggleDefault(m); }}
                    >★</button>
                  )}
                </div>
              );
            })}
            {maps.length === 0 && <p className="font-['DM_Mono'] text-xs t-dim">{isAdmin ? 'Add maps using the wheel panel.' : 'No maps yet.'}</p>}
          </div>

          {/* Defaults legend */}
          {isAdmin && defaultMaps.filter(m => maps.includes(m)).length > 0 && (
            <p className="font-['DM_Mono'] text-[10px] t-dim">★ = default map (stays in pool after reset)</p>
          )}

          {/* Restore removed maps */}
          {isAdmin && removedFromPool.filter(m => !maps.includes(m)).length > 0 && (
            <>
              <hr className="t-border" />
              <p className="font-['DM_Mono'] text-[11px] t-muted tracking-widest">RESTORE MAPS</p>
              <div className="flex flex-wrap gap-2">
                {removedFromPool.filter(m => !maps.includes(m)).map(m => (
                  <button
                    key={m}
                    className="flex items-center gap-1.5 t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm cursor-pointer transition-colors"
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.color = 'var(--accent-green)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
                    onClick={() => handleRestoreMap(m)}
                  >
                    ↩ {m}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
