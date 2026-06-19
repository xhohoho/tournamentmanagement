'use client';

import { useEffect, useRef } from 'react';
import { useTourney } from '@/lib/context';
import { listBracketSlots } from '@/lib/bracket';

// ─── Inject glow keyframe once ────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('match-info-glow-style')) {
  const s = document.createElement('style');
  s.id = 'match-info-glow-style';
  s.textContent = `
    @keyframes info-card-highlight {
      0%   { box-shadow: 0 0 0 0   rgba(77,124,255,0),    border-color: var(--border-mid); }
      15%  { box-shadow: 0 0 0 6px rgba(77,124,255,0.45), 0 0 28px rgba(77,124,255,0.30); border-color: rgba(77,124,255,0.9); }
      60%  { box-shadow: 0 0 0 4px rgba(77,124,255,0.22), 0 0 16px rgba(77,124,255,0.15); border-color: rgba(77,124,255,0.65); }
      100% { box-shadow: 0 0 0 0   rgba(77,124,255,0),    border-color: var(--border-mid); }
    }
    .match-info-glow { animation: info-card-highlight 2.2s cubic-bezier(0.22,1,0.36,1) forwards; }
  `;
  document.head.appendChild(s);
}

// ─── Single match info card (read-only, bracket-driven) ───────────────────────
function MatchInfoCard({ slot, highlighted, cardRef }: {
  slot: ReturnType<typeof listBracketSlots>[number];
  highlighted: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const isDone = slot.isDone;
  const isTbd = slot.p1 === 'TBD' || slot.p2 === 'TBD';

  const statusColor = isDone ? 'var(--accent-green)' : isTbd ? 'var(--text-dim)' : 'var(--accent)';
  const statusBg    = isDone ? 'rgba(34,184,98,0.07)'  : isTbd ? 'rgba(120,120,180,0.05)' : 'rgba(58,107,255,0.07)';
  const statusBorder = isDone ? 'rgba(34,184,98,0.2)'  : isTbd ? 'rgba(120,120,180,0.15)' : 'rgba(58,107,255,0.2)';

  return (
    <div
      ref={cardRef}
      className={`t-elevated border rounded-xl flex flex-col overflow-hidden${highlighted ? ' match-info-glow' : ''}`}
      style={{ borderColor: 'var(--border-mid)', borderWidth: 1.5 }}
    >
      {/* Match number + label */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b t-border"
        style={{ background: 'var(--bg-surface)' }}
      >
        <span
          className="font-['Bebas_Neue'] text-base tracking-widest shrink-0"
          style={{ color: 'var(--accent)', opacity: 0.85 }}
        >
          #{slot.number}
        </span>
        <span className="font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest truncate ml-2">
          {slot.label}
        </span>
      </div>

      {/* Teams */}
      <div className="flex items-center gap-2 px-3 py-3">
        <div
          className="flex-1 text-right font-['Bebas_Neue'] text-lg tracking-wide truncate"
          style={{
            color: slot.p1 === 'TBD' ? 'var(--text-dim)' : 'var(--text)',
            fontStyle: slot.p1 === 'TBD' ? 'italic' : undefined,
          }}
        >
          {slot.p1}
        </div>
        <span className="font-['DM_Mono'] text-[10px] t-muted shrink-0">vs</span>
        <div
          className="flex-1 font-['Bebas_Neue'] text-lg tracking-wide truncate"
          style={{
            color: slot.p2 === 'TBD' ? 'var(--text-dim)' : 'var(--text)',
            fontStyle: slot.p2 === 'TBD' ? 'italic' : undefined,
          }}
        >
          {slot.p2}
        </div>
      </div>

      {/* Status pill */}
      <div className="px-3 pb-3">
        <div
          className="rounded-lg px-3 py-1.5 text-center font-['DM_Mono'] text-[10px] font-bold uppercase tracking-widest"
          style={{ background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}
        >
          {isDone ? '✓ Done' : isTbd ? '⏳ TBD' : '🎮 Upcoming'}
        </div>
      </div>
    </div>
  );
}

// ─── Match Info tab ────────────────────────────────────────────────────────────
export function CasterSheetTab({ highlightMatchKey, onHighlightHandled }: {
  highlightMatchKey?: string | null;
  onHighlightHandled?: () => void;
} = {}) {
  const { bracket } = useTourney();
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const slots = bracket ? listBracketSlots(bracket) : [];

  // Scroll highlighted card into view whenever highlightMatchKey changes
  useEffect(() => {
    if (highlightMatchKey && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => onHighlightHandled?.(), 2400);
      return () => clearTimeout(t);
    }
  }, [highlightMatchKey, onHighlightHandled]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text">Match Info</h2>
        {slots.length > 0 && (
          <span className="font-['DM_Mono'] text-[10px] t-muted">
            {slots.length} match{slots.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="t-muted text-sm italic py-10 text-center">
          Generate a bracket to see match info here.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {slots.map(slot => (
            <MatchInfoCard
              key={slot.key}
              slot={slot}
              highlighted={slot.key === highlightMatchKey}
              cardRef={slot.key === highlightMatchKey ? highlightRef : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
CasterSheetTab.displayName = 'CasterSheetTab';
