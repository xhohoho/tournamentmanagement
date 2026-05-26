'use client';

import { useEffect, useRef } from 'react';

const TICKER_TEXT =
  'Shop : https://suddenattack.safie.cc';
const GAP = '          '; // spaces between loops
const FULL = TICKER_TEXT + GAP;
const CHAR_INTERVAL = 80; // ms per character

// How it works:
// We render on a <canvas> so we can control exactly which slice of text
// is visible and where it's drawn.
//
// charW = fixed width of one monospace character (measured once).
// trackW = pixel width of the scrolling track area.
// capacity = Math.ceil(trackW / charW)  — how many chars fit on screen.
//
// "cursor" advances every tick (0, 1, 2, …).
// Phase 1 — INTRO: cursor < capacity
//   Draw FULL[0..cursor] right-aligned at the right edge of the track.
//   Each tick adds one char, which appears at the right while the rest
//   shift left (because we right-align the growing string).
// Phase 2 — SCROLL: cursor >= capacity
//   The window is full. Each tick we advance leftEdge by 1 and drop the
//   leftmost char, while a new char enters from the right.
//   leftEdge = cursor - capacity (mod FULL.length for looping).
//   We draw exactly `capacity` chars starting at leftEdge.

export default function BottomTicker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;

    const ctx = canvas.getContext('2d')!;
    const FONT = 'bold 13px "Courier New", Courier, monospace';
    ctx.font = FONT;
    const charW = ctx.measureText('M').width; // monospace — all chars same width
    const H = canvas.height;

    let cursor = 0;
    let frameId: ReturnType<typeof setTimeout>;
    const len = FULL.length;

    const draw = () => {
      const trackW = canvas.width;
      const capacity = Math.ceil(trackW / charW);

      ctx.clearRect(0, 0, trackW, H);
      ctx.font = FONT;
      ctx.fillStyle = '#d4c59a';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      if (cursor < capacity) {
        // INTRO: right-align the partial string so new chars appear at right
        const slice = FULL.slice(0, cursor + 1);
        const x = trackW - (cursor + 1) * charW;
        ctx.fillText(slice, Math.max(0, x), H / 2);
      } else {
        // SCROLL: slide window leftward
        const leftEdge = (cursor - capacity + 1) % len;
        let slice = '';
        for (let i = 0; i < capacity; i++) {
          slice += FULL[(leftEdge + i) % len];
        }
        ctx.fillText(slice, 0, H / 2);
      }

      cursor++;
      frameId = setTimeout(draw, CHAR_INTERVAL);
    };

    // Sync canvas pixel width to track layout width
    const ro = new ResizeObserver(() => {
      canvas.width = track.clientWidth;
      // cursor stays — no reset, seamless resize
    });
    ro.observe(track);
    canvas.width = track.clientWidth;

    frameId = setTimeout(draw, CHAR_INTERVAL);
    return () => {
      clearTimeout(frameId);
      ro.disconnect();
    };
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
      {/* left decorative button */}
      <div
        aria-hidden="true"
        style={{
          width: 16, height: 20, margin: '0 4px', flexShrink: 0,
          background: '#3c3c34', border: '1px solid #5a5a52',
          boxShadow: '1px 1px 0 #000', borderRadius: 2,
        }}
      />

      {/* scrolling track */}
      <div
        ref={trackRef}
        className="flex-1 overflow-hidden"
        style={{
          height: 28,
          background: '#0d0d08',
          borderTop: '1px solid #5a5a52',
          borderBottom: '1px solid #111',
          position: 'relative',
        }}
      >
        <canvas
          ref={canvasRef}
          height={28}
          style={{ display: 'block', width: '100%', height: 28 }}
        />
      </div>

      {/* right decorative button */}
      <div
        aria-hidden="true"
        style={{
          width: 16, height: 20, margin: '0 4px', flexShrink: 0,
          background: '#3c3c34', border: '1px solid #5a5a52',
          boxShadow: '1px 1px 0 #000', borderRadius: 2,
        }}
      />
    </div>
  );
}
