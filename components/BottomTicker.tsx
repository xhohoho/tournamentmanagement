'use client';

import { useEffect, useRef, useState } from 'react';

const TICKER_TEXT = 'Shop : https://suddenattack.safie.cc';
const PX_PER_SECOND = 100;

export default function BottomTicker() {
  const spanRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [keyframes, setKeyframes] = useState('');
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const span = spanRef.current;
    const container = containerRef.current;
    if (!span || !container) return;

    const textWidth = span.offsetWidth;
    const containerWidth = container.clientWidth;
    const totalTravel = containerWidth + textWidth;

    setDuration(totalTravel / PX_PER_SECOND);
    setKeyframes(`
      @keyframes ticker-slide {
        from { transform: translateX(${containerWidth}px); }
        to   { transform: translateX(${-textWidth}px); }
      }
    `);
  }, []);

  const fontStyle: React.CSSProperties = {
    fontFamily: '"Courier New", Courier, monospace',
    fontWeight: 'bold',
    fontSize: 13,
    color: '#d4c59a',
    textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
    whiteSpace: 'nowrap',
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
  };

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
        style={{ height: 28, position: 'relative', background: '#0d0d08', borderTop: '1px solid #5a5a52', borderBottom: '1px solid #111' }}
      >
        <span
          ref={spanRef}
          style={{
            ...fontStyle,
            // Only apply animation once keyframes are ready
            animation: duration ? `ticker-slide ${duration}s linear infinite` : 'none',
          }}
        >
          {TICKER_TEXT}
        </span>
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

      {/* Inject keyframes with exact pixel values after measurement */}
      {keyframes && <style>{keyframes}</style>}
    </div>
  );
}
