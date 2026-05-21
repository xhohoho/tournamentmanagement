'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import { WHEEL_COLORS, parseStageMaps } from '@/lib/utils';

export function MapsTab({ spunMap, onSpunMap }: { spunMap: string; onSpunMap: (map: string) => void }) {
  const { maps, stageMaps, bracket, isAdmin, loading, addMap, removeMap, assignStage, clearStage } = useTourney();
  const [mapInput, setMapInput] = useState('');
  const [mapErr, setMapErr] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

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
      // Pointer is at 6 o'clock (π/2). Offset norm by π/2 so the picked slice
      // matches where the pointer actually sits, not the 12 o'clock origin.
      const norm = ((-angleRef.current + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      onSpunMap(maps[Math.floor(norm / slice) % maps.length]);
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
    <div className="flex-1 flex flex-col w-full py-6 gap-5">

      <div>
        <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest t-text mb-1">Map Selector</h1>
        <p className="font-['DM_Mono'] text-xs t-muted">
          {isAdmin ? 'Spin the wheel · Drag maps onto bracket stages · Each stage supports up to 3 maps' : 'View only — admin required to edit'}
        </p>
      </div>

      {/* View-only banner */}
      {!isAdmin && (
        <div className="t-surface border t-border rounded-2xl px-5 py-3 font-['DM_Mono'] text-sm t-muted flex items-center gap-2 shrink-0">
          🔒 <span>Admin access required to add maps or assign stages.</span>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 min-h-0">

        {/* Wheel panel */}
        <div className="t-surface border t-border rounded-2xl p-5 flex flex-col gap-4">
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

          <div className="flex flex-col items-center gap-3">
            <span className="text-3xl rotate-90" style={{ color: 'var(--accent-red)' }}>▶</span>
            <canvas ref={canvasRef} width={260} height={260} className="rounded-full drop-shadow-sm" />
            <button
              className="px-6 py-2.5 text-white font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: 'var(--accent-red)' }}
              onClick={spin}
              disabled={spinning || maps.length === 0}
            >
              🌀 SPIN
            </button>

            {spunMap && (
              <div className="flex flex-col items-center gap-2">
                <p className="font-['Bebas_Neue'] text-2xl tracking-widest" style={{ color: 'var(--accent-gold)' }}>🎯 {spunMap}</p>
                {isAdmin && (
                  <button
                    className="px-3 py-1.5 font-['DM_Mono'] text-xs border t-border-mid t-muted t-elevated rounded-xl transition-colors cursor-pointer"
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
                    onClick={async () => { await removeMap(spunMap); onSpunMap(''); }}
                  >
                    🗑 Remove from pool
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stage assignment panel */}
        <div className="t-surface border t-border rounded-2xl p-5 flex flex-col gap-4 overflow-y-auto">
          <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text">📌 Stage Assignment</h2>

          {!bracket ? (
            <p className="font-['DM_Mono'] text-xs t-dim text-center py-8">Generate a bracket first.</p>
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
              return (
                <div
                  key={m}
                  className="t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm transition-all"
                  style={{ opacity: used ? 0.35 : 1, cursor: used || !isAdmin ? 'default' : 'grab' }}
                  draggable={!used && isAdmin}
                  onDragStart={e => e.dataTransfer.setData('text/plain', m)}
                  title={used ? 'Already assigned' : isAdmin ? 'Drag to a stage slot' : undefined}
                  onMouseEnter={e => { if (!used && isAdmin) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}}
                  onMouseLeave={e => { if (!used && isAdmin) { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}}
                >
                  {m}
                </div>
              );
            })}
            {maps.length === 0 && <p className="font-['DM_Mono'] text-xs t-dim">{isAdmin ? 'Add maps using the wheel panel.' : 'No maps yet.'}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
