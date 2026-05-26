'use client';

import { useEffect, useRef } from 'react';

const TICKER_TEXT = 'Shop : https://suddenattack.safie.cc';
const MS_PER_CHAR = 50; // lower = faster

export default function BottomTicker() {
  const spanRef = useRef<HTMLSpanElement>(null);
  const rulerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    const ruler = rulerRef.current;
    if (!el || !ruler) return;

    const charWidth = ruler.offsetWidth / TICKER_TEXT.length;
    const containerWidth = el.parentElement?.clientWidth ?? 600;

    // How many chars needed to fill the screen
    const capacity = Math.ceil(containerWidth / charWidth) + 1;

    // Gap between repetitions — one full screen width worth of spaces
    const gapSize = capacity;
    const gap = ' '.repeat(gapSize);

    // Full loop string: text + gap (must be longer than capacity so only 1 copy is visible at a time)
    const loopText = TICKER_TEXT + gap;

    let offset = 0;
    const len = loopText.length;

    const buildDisplay = () => {
      let display = '';
      for (let i = 0; i < capacity; i++) {
        display += loopText[(offset + i) % len];
      }
      el.textContent = display;
    };

    buildDisplay();
    const id = setInterval(() => {
      offset = (offset + 1) % len;
      buildDisplay();
    }, MS_PER_CHAR);

    return () => clearInterval(id);
  }, []);

  const fontStyle = {
    fontFamily: '"Courier New", Courier, monospace',
    fontWeight: 'bold',
    fontSize: 13,
  } as const;

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
      {/* Left decorative button */}
      <div
        aria-hidden="true"
        style={{
          width: 16, height: 20, margin: '0 4px', flexShrink: 0,
          background: '#3c3c34', border: '1px solid #5a5a52',
          boxShadow: '1px 1px 0 #000', borderRadius: 2,
        }}
      />

      {/* Ticker track */}
      <div
        className="flex-1 overflow-hidden"
        style={{ height: 28, position: 'relative', background: '#0d0d08', borderTop: '1px solid #5a5a52', borderBottom: '1px solid #111' }}
      >
        {/* Invisible ruler to measure real char width */}
        <span
          ref={rulerRef}
          aria-hidden="true"
          style={{
            ...fontStyle,
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {TICKER_TEXT}
        </span>

        {/* Visible ticker */}
        <span
          ref={spanRef}
          style={{
            ...fontStyle,
            display: 'block',
            height: '100%',
            lineHeight: '28px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            color: '#d4c59a',
            textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
          }}
        />
      </div>

      {/* Right decorative button */}
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
