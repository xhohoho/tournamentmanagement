const TICKER_TEXT =
  'Shop : https://suddenattack.safie.cc';

export default function BottomTicker() {
  return (
    <>
      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ticker-strip {
          animation: ticker-scroll 22s linear infinite;
          will-change: transform;
        }
        .ticker-root:hover .ticker-strip {
          animation-play-state: paused;
        }
      `}</style>

      <div
        className="ticker-root fixed bottom-0 left-0 w-full z-50 flex items-center"
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
          className="flex-1 flex items-center overflow-hidden"
          style={{
            height: 28,
            background: '#0d0d08',
            borderTop: '1px solid #5a5a52',
            borderBottom: '1px solid #111',
          }}
        >
          {/* 4 copies — translateX(-50%) loops seamlessly */}
          <div className="ticker-strip flex whitespace-nowrap">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  fontFamily: '"Courier New", Courier, monospace',
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#d4c59a',
                  textShadow: '1px 1px 0 #000',
                  paddingRight: 80,
                }}
              >
                {TICKER_TEXT}
              </span>
            ))}
          </div>
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
    </>
  );
}
