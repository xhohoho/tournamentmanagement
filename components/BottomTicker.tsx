'use client';

import { useEffect, useRef, useState } from 'react';

const TICKER_TEXT = 'Shop : https://suddenattack.safie.cc';
const PX_PER_SECOND = 100;

export default function BottomTicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // The track is 2x the container width (two spans, each 100% of container)
    // So one full loop = container width
    setDuration(container.clientWidth / PX_PER_SECOND);
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
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ height: 28, background: '#0d0d08', borderTop: '1px solid #5a5a52', borderBottom: '1px solid #111' }}
      >
        <div
          style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            animation: duration ? `ticker-scroll ${duration}s linear infinite` : 'none',
            willChange: 'transform',
          }}
        >
          {/*
            Each span is exactly 100% of the container width.
            span1 starts at 0 and scrolls to -100% (off left).
            span2 starts right behind it at +100% and fills in.
            translateX(-50%) moves the whole track by exactly one container width = seamless.
          */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minWidth: '100%',
              fontFamily: '"Courier New", Courier, monospace',
              fontWeight: 'bold',
              fontSize: 13,
              color: '#d4c59a',
              textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
            }}
          >
            {TICKER_TEXT}
          </span>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minWidth: '100%',
              fontFamily: '"Courier New", Courier, monospace',
              fontWeight: 'bold',
              fontSize: 13,
              color: '#d4c59a',
              textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
            }}
          >
            {TICKER_TEXT}
          </span>
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
