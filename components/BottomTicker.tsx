'use client';

import { useEffect, useRef, useCallback } from 'react';

const PX_PER_SECOND = 200;
const SHOP_URL = 'https://suddenattack.safie.cc';

interface Props {
  text: string;
}

export default function BottomTicker({ text }: Props) {
  const spanRef      = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const styleRef     = useRef<HTMLStyleElement | null>(null);

  const rebuild = useCallback(() => {
    const span      = spanRef.current;
    const container = containerRef.current;
    if (!span || !container) return;

    const textWidth      = span.offsetWidth;
    const containerWidth = container.clientWidth;
    const totalTravel    = containerWidth + textWidth;
    const duration       = totalTravel / PX_PER_SECOND;

    if (!styleRef.current) {
      styleRef.current = document.createElement('style');
      document.head.appendChild(styleRef.current);
    }
    styleRef.current.textContent = `
      @keyframes ticker-slide {
        from { left: ${containerWidth}px; }
        to   { left: ${-textWidth}px; }
      }
      .ticker-span {
        animation: ticker-slide ${duration}s linear infinite;
      }
    `;
  }, []);

  useEffect(() => {
    rebuild();

    const ro = new ResizeObserver(rebuild);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      styleRef.current?.remove();
      styleRef.current = null;
    };
  }, [rebuild, text]);

  const handleClick = () => {
    window.open(SHOP_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleClick}
      title="Visit Sudden Attack Shop"
      className="w-full flex items-center shrink-0 cursor-pointer group"
      style={{
        height: 28,
        background: '#1a1a14',
        borderTop: '1px solid #5a5a52',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
      role="link"
      aria-label="Scrolling announcement — click to visit Sudden Attack Shop"
    >
      {/* Left decorative button */}
      <div
        aria-hidden="true"
        className="group-hover:bg-[#4a4a3c] transition-colors"
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
        style={{
          height: 28,
          position: 'relative',
          background: '#0d0d08',
          borderTop: '1px solid #5a5a52',
          borderBottom: '1px solid #111',
        }}
      >
        <span
          ref={spanRef}
          className="ticker-span"
          style={{
            position: 'absolute',
            top: 0, bottom: 0,
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: 'bold',
            fontSize: 13,
            color: '#d4c59a',
            textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
            userSelect: 'none',
          }}
        >
          {text}
        </span>
      </div>

      {/* Right decorative button */}
      <div
        aria-hidden="true"
        className="group-hover:bg-[#4a4a3c] transition-colors"
        style={{
          width: 16, height: 20, margin: '0 4px', flexShrink: 0,
          background: '#3c3c34', border: '1px solid #5a5a52',
          boxShadow: '1px 1px 0 #000', borderRadius: 2,
        }}
      />
    </div>
  );
}
