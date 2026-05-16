'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTourney } from '@/lib/context';
import { WHEEL_COLORS } from '@/lib/utils';

export function MapsTab() {
  const { maps, stageMaps, bracket, addMap, removeMap, assignStage, clearStage } = useTourney();
  const [mapInput, setMapInput] = useState('');
  const [mapErr, setMapErr] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [spunMap, setSpunMap] = useState('');
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

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

  const handleAssignSpun = async () => {
    if (!spunMap) return;
    const stages = getStageLabels();
    if (!stages.length) { alert('Generate a bracket first.'); return; }
    const choice = prompt(
      `Assign "${spunMap}" to which stage?\n\n` +
      stages.map((s, i) => `${i + 1}. ${s.label}${stageMaps[s.key] ? ' (has: ' + stageMaps[s.key] + ')' : ''}`).join('\n') +
      '\n\nEnter number:'
    );
    const idx = parseInt(choice ?? '') - 1;
    if (isNaN(idx) || idx < 0 || idx >= stages.length) return;
    await assignStage(stages[idx].key, spunMap);
  };

  const usedMaps = Object.values(stageMaps);
  const stages = getStageLabels();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="font-['Bebas_Neue'] text-4xl tracking-widest mb-1">Map Selector</h1>
      <p className="text-[#7878a0] font-['DM_Mono'] text-xs mb-5">Spin the wheel · Drag maps onto bracket stages</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

        {/* Wheel */}
        <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl p-5">
          <h2 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4">🎡 Wheel</h2>

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              className="flex-1 bg-[#161625] border border-[#32324a] rounded-xl px-4 py-2.5 text-[#dde0f0] font-['DM_Mono'] text-sm outline-none focus:border-[#4d7cff] transition-colors"
              placeholder="Map name…"
              value={mapInput}
              onChange={e => setMapInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMap()}
            />
            <button
              className="px-4 py-2.5 bg-[#4d7cff] text-white font-bold rounded-xl hover:bg-[#2d5eff] transition-all text-sm"
              onClick={handleAddMap}
            >
              + Add
            </button>
          </div>
          {mapErr && <p className="text-[#ff3d5a] font-['DM_Mono'] text-xs mb-3">{mapErr}</p>}

          <div className="flex flex-wrap gap-2 mb-4 min-h-9">
            {maps.map((m, i) => (
              <span key={m} className="inline-flex items-center gap-1.5 bg-[#161625] border border-[#32324a] rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm">
                {m}
                <span className="cursor-pointer text-[#4a4a6a] hover:text-[#ff3d5a] transition-colors" onClick={() => removeMap(m)}>✕</span>
              </span>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3.5">
            <span className="text-3xl rotate-90">▶</span>
            <canvas
              ref={canvasRef}
              width={280}
              height={280}
              className="rounded-full drop-shadow-[0_0_20px_rgba(77,124,255,0.3)]"
            />
            <button
              className="px-6 py-2.5 bg-[#ff3d5a] text-white font-bold rounded-xl hover:bg-[#ff1a3a] transition-all hover:-translate-y-0.5 text-sm disabled:opacity-40 disabled:transform-none"
              onClick={spin}
              disabled={spinning || maps.length === 0}
            >
              🌀 SPIN
            </button>
            {spunMap && (
              <p className="font-['Bebas_Neue'] text-2xl tracking-widest text-[#ffb020]">🎯 {spunMap}</p>
            )}
            {spunMap && (
              <button
                className="px-4 py-2 bg-[#161625] border border-[#32324a] text-[#dde0f0] font-bold rounded-xl hover:border-[#4d7cff] hover:text-[#4d7cff] transition-colors text-sm"
                onClick={handleAssignSpun}
              >
                📌 Assign to Stage…
              </button>
            )}
          </div>
        </div>

        {/* Stage assignment */}
        <div className="bg-[#0f0f1a] border border-[#252538] rounded-xl p-5">
          <h2 className="font-['Bebas_Neue'] text-xl tracking-widest mb-4">📌 Stage Assignment</h2>
          <div className="bg-[#161625] border border-[#252538] rounded-lg px-4 py-2.5 font-['DM_Mono'] text-xs text-[#7878a0] mb-4">
            Drag a map chip onto a stage, or spin and use "Assign to Stage".
          </div>

          {!bracket ? (
            <p className="font-['DM_Mono'] text-xs text-[#4a4a6a] text-center py-8">Generate a bracket first.</p>
          ) : (
            <div className="mb-4">
              {stages.map(s => (
                <div
                  key={s.key}
                  className="flex items-center gap-3 bg-[#161625] border border-[#252538] rounded-xl px-4 py-3 mb-2"
                >
                  <span className="font-['DM_Mono'] text-xs text-[#7878a0] min-w-[110px] tracking-wide">{s.label}</span>
                  <div
                    className={`flex-1 min-h-9 border-2 border-dashed rounded-xl flex items-center justify-center font-['DM_Mono'] text-sm transition-all px-3 py-1 cursor-default
                      ${stageMaps[s.key]
                        ? 'border-[#b06dff] border-solid text-[#b06dff] bg-[rgba(176,109,255,0.08)]'
                        : dragOverStage === s.key
                          ? 'border-[#4d7cff] bg-[rgba(77,124,255,0.1)] text-[#4d7cff]'
                          : 'border-[#32324a] text-[#4a4a6a]'
                      }`}
                    onDragOver={e => { e.preventDefault(); setDragOverStage(s.key); }}
                    onDragLeave={() => setDragOverStage(null)}
                    onDrop={async e => {
                      e.preventDefault();
                      setDragOverStage(null);
                      const map = e.dataTransfer.getData('text/plain');
                      if (map) await assignStage(s.key, map);
                    }}
                  >
                    {stageMaps[s.key] ? '🗺 ' + stageMaps[s.key] : 'Drop here'}
                  </div>
                  {stageMaps[s.key] && (
                    <button
                      className="text-[#4a4a6a] hover:text-[#ff3d5a] font-bold transition-colors text-sm"
                      onClick={() => clearStage(s.key)}
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
          )}

          <hr className="border-[#252538] my-4" />
          <p className="font-['DM_Mono'] text-[11px] text-[#7878a0] tracking-widest mb-3">MAP POOL</p>
          <div className="flex flex-wrap gap-2">
            {maps.map(m => {
              const used = usedMaps.includes(m);
              return (
                <div
                  key={m}
                  className={`bg-[#1e1e30] border border-[#32324a] rounded-lg px-3 py-1.5 font-['DM_Mono'] text-sm transition-all
                    ${used ? 'opacity-35 cursor-not-allowed' : 'cursor-grab hover:border-[#4d7cff] hover:text-[#4d7cff]'}`}
                  draggable={!used}
                  onDragStart={e => e.dataTransfer.setData('text/plain', m)}
                  title={used ? 'Already assigned' : 'Drag to a stage'}
                >
                  {m}
                </div>
              );
            })}
            {maps.length === 0 && (
              <p className="font-['DM_Mono'] text-xs text-[#4a4a6a]">Add maps using the wheel panel.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
