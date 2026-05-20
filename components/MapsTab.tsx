'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import { WHEEL_COLORS } from '@/lib/utils';

export function MapsTab({ lightMode }: { lightMode?: boolean }) {
  const { maps, stageMaps, bracket, addMap, removeMap, removeSpunMap, assignStage, clearStage } = useTourney();
  const [mapInput, setMapInput] = useState('');
  const [mapErr, setMapErr] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [spunMap, setSpunMap] = useState('');
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  // Normalize stageMaps values to always string[]
  const getStageMaps = (key: string): string[] => {
    const v = stageMaps[key];
    if (!v) return [];
    if (Array.isArray(v)) return v as unknown as string[];
    return [v as unknown as string];
  };

  const drawWheel = useCallback((angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, cx = W / 2, r = W / 2 - 8;
    ctx.clearRect(0, 0, W, W);

    if (!maps.length) {
      ctx.fillStyle = '#1e1e30';
      ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a4a6a';
      ctx.font = '14px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Add maps', cx, cx);
      return;
    }

    const slice = (Math.PI * 2) / maps.length;
    maps.forEach((m, i) => {
      const start = angle + i * slice, end = start + slice;
      ctx.beginPath(); ctx.moveTo(cx, cx); ctx.arc(cx, cx, r, start, end); ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length]; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save();
      ctx.translate(cx, cx); ctx.rotate(start + slice / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(13, 140 / maps.length)}px Syne, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4;
      ctx.fillText(m.length > 14 ? m.slice(0, 13) + '…' : m, r - 8, 4);
      ctx.restore();
    });

    ctx.beginPath(); ctx.arc(cx, cx, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#080810'; ctx.fill();
    ctx.strokeStyle = '#252538'; ctx.lineWidth = 2; ctx.stroke();
  }, [maps]);

  useEffect(() => { drawWheel(angleRef.current); }, [maps, drawWheel]);

  const spin = () => {
    if (spinning || !maps.length) return;
    setSpinning(true);
    setSpunMap('');
    const extra = (5 + Math.random() * 6) * Math.PI * 2 + Math.random() * Math.PI * 2;
    const dur = 3200 + Math.random() * 1200;
    const t0 = performance.now();
    const a0 = angleRef.current;

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - t, 4);
      angleRef.current = a0 + extra * ease;
      drawWheel(angleRef.current);

      if (t < 1) { requestAnimationFrame(tick); return; }
      setSpinning(false);
      const slice = (Math.PI * 2) / maps.length;
      const norm = ((-angleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const idx = Math.floor(norm / slice) % maps.length;
      setSpunMap(maps[idx]);
    };
    requestAnimationFrame(tick);
  };

  const handleAddMap = async () => {
    const name = mapInput.trim();
    if (!name) return;
    const result = await addMap(name);
    if (result?.error) { setMapErr(result.error); return; }
    setMapInput('');
    setMapErr('');
  };

  const handleRemoveSpun = async () => {
    if (!spunMap) return;
    await removeSpunMap(spunMap);
    setSpunMap('');
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

  // All maps currently in any stage
  const usedMaps = new Set(
    Object.values(stageMaps).flatMap(v =>
      Array.isArray(v) ? (v as unknown as string[]) : v ? [v as unknown as string] : []
    )
  );

  return (
    <div className={`min-h-[calc(100vh-120px)] t-bg ${lightMode ? 'light' : ''}`}>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest t-text mb-1">Map Selector</h1>
        <p className="t-muted font-['DM_Mono'] text-xs mb-5">Spin the wheel · Drag maps onto bracket stages · Each stage supports up to 3 maps (BO3)</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

          {/* Wheel */}
          <div className="t-surface border t-border rounded-xl p-5">
            <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">🎡 Wheel</h2>

            <div className="flex gap-3 mb-4">
              <input
                type="text"
                className="flex-1 t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none transition-colors"
                style={{ '--tw-ring-color': 'var(--accent)' } as React.CSSProperties}
                placeholder="Map name…"
                value={mapInput}
                onChange={e => setMapInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMap()}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = '')}
              />
              <button
                className="px-4 py-2.5 font-bold rounded-xl text-sm text-white transition-all"
                style={{ background: 'var(--accent)', cursor: 'pointer' }}
                onClick={handleAddMap}
              >
                + Add
              </button>
            </div>
            {mapErr && <p className="font-['DM_Mono'] text-xs mb-3" style={{ color: 'var(--accent-red)' }}>{mapErr}</p>}

            <div className="flex flex-wrap gap-2 mb-4 min-h-9">
              {maps.map((m) => (
                <span key={m} className="inline-flex items-center gap-1.5 t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm t-text">
                  {m}
                  <span className="cursor-pointer t-dim hover:text-[var(--accent-red)] transition-colors" onClick={() => removeMap(m)}>✕</span>
                </span>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3.5">
              <span className="text-3xl rotate-90" style={{ color: 'var(--accent-red)' }}>▶</span>
              <canvas
                ref={canvasRef}
                width={280}
                height={280}
                className="rounded-full drop-shadow-[0_0_20px_rgba(77,124,255,0.3)]"
              />
              <button
                className="px-6 py-2.5 text-white font-bold rounded-xl transition-all text-sm disabled:opacity-40 disabled:transform-none"
                style={{ background: 'var(--accent-red)', cursor: 'pointer' }}
                onClick={spin}
                disabled={spinning || maps.length === 0}
              >
                🌀 SPIN
              </button>

              {spunMap && (
                <div className="flex flex-col items-center gap-2">
                  <p className="font-['Bebas_Neue'] text-2xl tracking-widest" style={{ color: 'var(--accent-gold)' }}>🎯 {spunMap}</p>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1.5 font-['DM_Mono'] text-xs border t-border-mid t-muted t-elevated rounded-xl transition-colors"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
                      onClick={handleRemoveSpun}
                    >
                      🗑 Remove from pool
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stage assignment */}
          <div className="t-surface border t-border rounded-xl p-5">
            <h2 className="font-['Bebas_Neue'] text-xl tracking-widest t-text mb-4">📌 Stage Assignment</h2>
            <div className="t-elevated border t-border-mid rounded-lg px-4 py-2.5 font-['DM_Mono'] text-xs t-muted mb-4">
              Drag a map chip directly onto a stage row. Each stage holds up to 3 maps (BO3).
            </div>

            {!bracket ? (
              <p className="font-['DM_Mono'] text-xs t-dim text-center py-8">Generate a bracket first.</p>
            ) : (
              <div className="mb-4 space-y-2">
                {stages.map(s => {
                  const stageMapsArr = getStageMaps(s.key);
                  const maxSlots = 3;
                  return (
                    <div key={s.key} className="t-elevated border t-border rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-['Bebas_Neue'] text-sm tracking-widest t-text">{s.label}</span>
                        <span className="font-['DM_Mono'] text-[10px] t-dim">{stageMapsArr.length}/3 maps</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {Array.from({ length: maxSlots }, (_, slotIdx) => {
                          const map = stageMapsArr[slotIdx];
                          const isOver = dragOverStage === s.key && dragOverSlot === slotIdx;
                          return (
                            <div
                              key={slotIdx}
                              className="flex-1 min-w-[80px] min-h-8 border-2 border-dashed rounded-lg flex items-center justify-center font-['DM_Mono'] text-xs transition-all px-2 py-1 relative"
                              style={{
                                borderColor: map ? 'var(--accent)' : isOver ? 'var(--accent-gold)' : 'var(--border-mid)',
                                background: map ? 'rgba(77,124,255,0.08)' : isOver ? 'rgba(255,176,32,0.08)' : undefined,
                                color: map ? 'var(--accent)' : 'var(--text-dim)',
                                borderStyle: map ? 'solid' : 'dashed',
                              }}
                              onDragOver={e => { e.preventDefault(); setDragOverStage(s.key); setDragOverSlot(slotIdx); }}
                              onDragLeave={() => { setDragOverStage(null); setDragOverSlot(null); }}
                              onDrop={async e => {
                                e.preventDefault();
                                setDragOverStage(null); setDragOverSlot(null);
                                const m = e.dataTransfer.getData('text/plain');
                                if (m) await assignStage(s.key, m, slotIdx);
                              }}
                            >
                              {map ? (
                                <>
                                  <span className="truncate text-[10px]">🗺 {map}</span>
                                  <button
                                    className="ml-1.5 shrink-0 t-dim hover:text-[var(--accent-red)] transition-colors text-sm"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => clearStage(s.key, slotIdx)}
                                  >✕</button>
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

            <hr className="t-border my-4" />
            <p className="font-['DM_Mono'] text-[11px] t-muted tracking-widest mb-3">MAP POOL</p>
            <div className="flex flex-wrap gap-2">
              {maps.map(m => {
                const used = usedMaps.has(m);
                return (
                  <div
                    key={m}
                    className="t-elevated border t-border rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm transition-all"
                    style={{
                      opacity: used ? 0.35 : 1,
                      cursor: used ? 'not-allowed' : 'grab',
                      borderColor: !used ? 'var(--border-mid)' : undefined,
                    }}
                    draggable={!used}
                    onDragStart={e => e.dataTransfer.setData('text/plain', m)}
                    title={used ? 'Already assigned' : 'Drag to a stage slot'}
                    onMouseEnter={e => { if (!used) { e.currentTarget.style.borderColor = 'var(--accent)'; (e.currentTarget.style as CSSStyleDeclaration & { color: string }).color = 'var(--accent)'; }}}
                    onMouseLeave={e => { if (!used) { e.currentTarget.style.borderColor = 'var(--border-mid)'; (e.currentTarget.style as CSSStyleDeclaration & { color: string }).color = ''; }}}
                  >
                    {m}
                  </div>
                );
              })}
              {maps.length === 0 && (
                <p className="font-['DM_Mono'] text-xs t-dim">Add maps using the wheel panel.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
