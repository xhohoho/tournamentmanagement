'use client';

import { useEffect, useRef } from 'react';

const TICKER_TEXT = 'Shop : https://suddenattack.safie.cc     '; // trailing spaces = gap before it wraps
const MS_PER_CHAR = 50; // lower = faster

export default function BottomTicker() {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    // Fill the display with enough chars to cover the container
    // Then rotate: shift first char to end every tick
    let offset = 0;

    const buildDisplay = () => {
      const containerWidth = el.parentElement?.clientWidth ?? 600;
      // How many chars fit? Use a rough estimate based on monospace char width (~8px at 13px font)
      const CHAR_WIDTH = 8;
      const capacity = Math.ceil(containerWidth / CHAR_WIDTH) + 1;
      const len = TICKER_TEXT.length;

      let display = '';
      for (let i = 0; i < capacity; i++) {
        display += TICKER_TEXT[(offset + i) % len];
      }
      el.textContent = display;
    };

    buildDisplay();
    const id = setInterval(() => {
      offset = (offset + 1) % TICKER_TEXT.length;
      buildDisplay();
    }, MS_PER_CHAR);

    return () => clearInterval(id);
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
        style={{ height: 28, background: '#0d0d08', borderTop: '1px solid #5a5a52', borderBottom: '1px solid #111' }}
      >
        <span
          ref={spanRef}
          style={{
            display: 'block',
            height: '100%',
            lineHeight: '28px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: 'bold',
            fontSize: 13,
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
