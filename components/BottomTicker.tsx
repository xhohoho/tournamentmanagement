'use client';

import { useEffect, useRef } from 'react';

const TICKER_TEXT = 'Shop : https://suddenattack.safie.cc';
const PX_PER_SECOND = 80; // scroll speed — adjust this

export default function BottomTicker() {
  const span1Ref = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const span = span1Ref.current;
    const track = trackRef.current;
    if (!span || !track) return;

    // Total width of one unit = text width + gap (100vw)
    const oneUnitWidth = span.offsetWidth;
    const duration = oneUnitWidth / PX_PER_SECOND;

    track.style.animationDuration = `${duration}s`;
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
        <div
          ref={trackRef}
          style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            animation: 'ticker-scroll linear infinite',
            animationDuration: '10s', // placeholder, overwritten in useEffect
            willChange: 'transform',
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: 'bold',
            fontSize: 13,
            color: '#d4c59a',
            textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
          }}
        >
          <span ref={span1Ref} style={{ paddingRight: '100vw' }}>{TICKER_TEXT}</span>
          <span style={{ paddingRight: '100vw' }}>{TICKER_TEXT}</span>
        </div>
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

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
