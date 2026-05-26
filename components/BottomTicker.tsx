'use client';

import { useEffect, useRef } from 'react';

const TICKER_TEXT = 'Shop : https://suddenattack.safie.cc';
const GAP = '               '; // gap between loops
const FULL = TICKER_TEXT + GAP;
const MS_PER_CHAR = 90; // speed: ms per character step

export default function BottomTicker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // ── measure charW on an offscreen canvas so canvas.width change never breaks it
    const probe = document.createElement('canvas');
    const pctx = probe.getContext('2d')!;
    const FONT = 'bold 13px "Courier New", Courier, monospace';
    pctx.font = FONT;
    const charW = Math.ceil(pctx.measureText('M').width); // fixed monospace width

    const ctx = canvas.getContext('2d')!;
    const len = FULL.length;
    let cursor = 0;          // total ticks elapsed
    let lastTick = 0;        // timestamp of last char advance
    let rafId = 0;

    const syncWidth = () => {
      const w = container.clientWidth;
      if (canvas.width !== w) canvas.width = w;
    };

    const render = (ts: number) => {
      rafId = requestAnimationFrame(render);

      // advance cursor once per MS_PER_CHAR
      if (ts - lastTick < MS_PER_CHAR) return;
      lastTick = ts;

      syncWidth();
      const W = canvas.width;
      const H = canvas.height;
      const capacity = Math.floor(W / charW); // chars that fit

      ctx.clearRect(0, 0, W, H);
      ctx.font = FONT;
      ctx.fillStyle = '#d4c59a';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      if (cursor <= capacity) {
        // INTRO: grow string from right — right-align the partial string
        let slice = '';
        for (let i = 0; i < cursor; i++) slice += FULL[i % len];
        const x = W - cursor * charW;
        if (slice) ctx.fillText(slice, x, H / 2);
      } else {
        // SCROLL: slide window — leftmost char exits, new char enters from right
        const leftEdge = (cursor - capacity) % len;
        let slice = '';
        for (let i = 0; i < capacity; i++) slice += FULL[(leftEdge + i) % len];
        ctx.fillText(slice, 0, H / 2);
      }

      cursor++;
    };

    syncWidth();
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      className="w-full flex items-center shrink-0"
      style={{
        height: 28,
        background: '#1a1a14',
        borderTop: '1px solid #5a5a52',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
      role="marquee"
      aria-label="Scrolling announcement"
    >
      <div aria-hidden="true" style={{ width: 16, height: 20, margin: '0 4px', flexShrink: 0, background: '#3c3c34', border: '1px solid #5a5a52', boxShadow: '1px 1px 0 #000', borderRadius: 2 }} />

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ height: 28, background: '#0d0d08', borderTop: '1px solid #5a5a52', borderBottom: '1px solid #111' }}
      >
        <canvas ref={canvasRef} height={28} style={{ display: 'block' }} />
      </div>

      <div aria-hidden="true" style={{ width: 16, height: 20, margin: '0 4px', flexShrink: 0, background: '#3c3c34', border: '1px solid #5a5a52', boxShadow: '1px 1px 0 #000', borderRadius: 2 }} />
    </div>
  );
}
