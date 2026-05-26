const TICKER_TEXT =
  'Sama-sama la kita bersedekah, bukan mintak toke barang free je haha';

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
          display: flex;
          white-space: nowrap;
          min-width: 200%;
        }
        .ticker-root:hover .ticker-strip {
          animation-play-state: paused;
        }
      `}</style>

      <div
        className="ticker-root w-full flex items-center shrink-0"
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
          {/* 2 copies — translateX(-50%) shifts exactly one copy, loops seamlessly */}
          <div className="ticker-strip">
            {[0, 1].map((i) => (
              <span
                key={i}
                style={{
                  fontFamily: '"Courier New", Courier, monospace',
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#d4c59a',
                  textShadow: '1px 1px 0 #000',
                  paddingRight: 120,
                  display: 'inline-block',
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
