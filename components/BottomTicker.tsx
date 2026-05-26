'use client';

import { useEffect, useRef, useState } from 'react';

const TICKER_TEXT =
  'Sama-sama la kita bersedekah, bukan mintak toke barang free je haha';
// Gap of spaces between end of message and start of next loop
const GAP = '          ';
const FULL = TICKER_TEXT + GAP;
// ms per character step
const CHAR_INTERVAL = 80;

export default function BottomTicker() {
  // visibleChars: how many chars of FULL are currently showing (0 = empty, FULL.length = full string visible)
  // offset: index of the first character in FULL that is at the left edge
  // We display: FULL.slice(offset, offset + visibleChars)
  // Animation phases:
  //   INTRO  — visibleChars grows from 0 to FULL.length (chars enter from right)
  //   SCROLL — offset advances, visibleChars stays at FULL.length (chars exit left, new ones enter right)
  //   (seamless: when offset wraps around FULL it loops)
  const [displayed, setDisplayed] = useState('');
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // State machine using a single index that advances each tick.
    // We keep a "virtual" cursor that represents the right edge of the
    // visible window into an infinite repetition of FULL.
    // rightEdge counts up from 0 forever.
    // visibleWindow = FULL length.
    // leftEdge = rightEdge - FULL.length (clamped to 0 during intro).
    let rightEdge = 0;
    const len = FULL.length;

    const tick = () => {
      rightEdge++;
      const leftEdge = Math.max(0, rightEdge - len);
      // Both edges modulo len to index into FULL (which loops)
      // We build the visible string by taking chars from FULL cyclically
      const visibleCount = rightEdge - leftEdge; // len once intro done
      let str = '';
      for (let i = 0; i < visibleCount; i++) {
        str += FULL[(leftEdge + i) % len];
      }
      setDisplayed(str);
      frameRef.current = setTimeout(tick, CHAR_INTERVAL);
    };

    frameRef.current = setTimeout(tick, CHAR_INTERVAL);
    return () => { if (frameRef.current) clearTimeout(frameRef.current); };
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
          width: 16,
          height: 20,
          margin: '0 4px',
          flexShrink: 0,
          background: '#3c3c34',
          border: '1px solid #5a5a52',
          boxShadow: '1px 1px 0 #000',
          borderRadius: 2,
        }}
      />

      {/* scrolling track */}
      <div
        className="flex-1 overflow-hidden flex items-center"
        style={{
          height: 28,
          background: '#0d0d08',
          borderTop: '1px solid #5a5a52',
          borderBottom: '1px solid #111',
        }}
      >
        <span
          style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: 700,
            fontSize: 13,
            color: '#d4c59a',
            textShadow: '1px 1px 0 #000',
            paddingLeft: 6,
            display: 'inline-block',
            whiteSpace: 'pre',
          }}
        >
          {displayed}
        </span>
      </div>

      {/* right decorative button */}
      <div
        aria-hidden="true"
        style={{
          width: 16,
          height: 20,
          margin: '0 4px',
          flexShrink: 0,
          background: '#3c3c34',
          border: '1px solid #5a5a52',
          boxShadow: '1px 1px 0 #000',
          borderRadius: 2,
        }}
      />
    </div>
  );
}
