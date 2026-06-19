'use client';

import { useEffect, useRef, useState } from 'react';
import { useTourney } from '@/lib/context';
import type { CasterMatch } from '@/lib/types';

function makeId() {
  return `caster_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyMatch(): CasterMatch {
  return {
    id: makeId(),
    matchNo: '',
    team1: '',
    team2: '',
    maps: '',
    side: '',
    notes: '',
    result: '',
    createdAt: Date.now(),
  };
}

// ─── Single editable/read-only match card ─────────────────────────────────────
function MatchCard({ match, isAdmin, onChange, onDelete, highlighted, cardRef }: {
  match: CasterMatch;
  isAdmin: boolean;
  onChange: (patch: Partial<CasterMatch>) => void;
  onDelete: () => void;
  highlighted?: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const field = (key: keyof CasterMatch, placeholder: string, mono = false) => (
    isAdmin ? (
      <input
        className={`w-full bg-transparent outline-none t-text placeholder:t-muted ${mono ? "font-['DM_Mono']" : ''}`}
        placeholder={placeholder}
        value={match[key] as string}
        onChange={e => onChange({ [key]: e.target.value } as Partial<CasterMatch>)}
      />
    ) : (
      <span className={`t-text ${!match[key] ? 't-muted italic' : ''}`}>
        {(match[key] as string) || placeholder}
      </span>
    )
  );

  return (
    <div
      ref={cardRef}
      className="t-surface border rounded-xl p-4 flex flex-col gap-3 relative transition-colors"
      style={{ borderColor: highlighted ? 'var(--accent)' : 'var(--border-mid)', borderWidth: highlighted ? 2 : 1, boxShadow: highlighted ? '0 0 0 3px rgba(77,124,255,0.15)' : undefined }}
    >
      {isAdmin && (
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 t-muted hover:text-[var(--accent-red)] text-xs cursor-pointer"
          title="Delete match"
        >✕</button>
      )}

      {match.linkedMatchKey && (
        <span className="font-['DM_Mono'] text-[9px] t-muted absolute top-2 left-2" title="Linked to a bracket match">🔗</span>
      )}

      <div className="flex items-center gap-2">
        <span className="font-['DM_Mono'] text-[10px] uppercase tracking-widest t-muted shrink-0">Match No</span>
        <div className="font-['Bebas_Neue'] text-lg tracking-wide flex-1">
          {field('matchNo', 'e.g. UB R1 M2')}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 text-right font-['Bebas_Neue'] text-xl tracking-wide">
          {field('team1', 'TEAM 1')}
        </div>
        <span className="t-muted font-['DM_Mono'] text-xs">VS</span>
        <div className="flex-1 font-['Bebas_Neue'] text-xl tracking-wide">
          {field('team2', 'TEAM 2')}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="font-['DM_Mono'] text-[10px] uppercase tracking-widest t-muted mb-1">🗺 Map</div>
          {field('maps', 'DR, CC, OT')}
        </div>
        <div>
          <div className="font-['DM_Mono'] text-[10px] uppercase tracking-widest t-muted mb-1">🪙 Side</div>
          {field('side', 'Coin spin — winner picks side')}
        </div>
      </div>

      <div className="text-sm">
        <div className="font-['DM_Mono'] text-[10px] uppercase tracking-widest t-muted mb-1">📝 Notes</div>
        {field('notes', 'Any caster notes…')}
      </div>

      <div className="text-sm border-t t-border-mid pt-2">
        <div className="font-['DM_Mono'] text-[10px] uppercase tracking-widest t-muted mb-1">✅ Result</div>
        {field('result', 'e.g. LMKY 2-1', true)}
      </div>
    </div>
  );
}
MatchCard.displayName = 'MatchCard';

// ─── Main tab ───────────────────────────────────────────────────────────────────
export function CasterSheetTab({ highlightId, onHighlightHandled }: {
  highlightId?: string | null;
  onHighlightHandled?: () => void;
} = {}) {
  const { casterSheet, setCasterSheet, isAdmin } = useTourney();
  const serverMatches = casterSheet?.matches ?? [];
  const [localMatches, setLocalMatches] = useState<CasterMatch[]>(serverMatches);
  const [saving, setSaving] = useState(false);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Debounce machinery: while a field is mid-edit, ignore incoming server snapshots
  // (avoids the input value jumping/reverting) and only flush to the server after
  // the person pauses typing for DEBOUNCE_MS.
  const DEBOUNCE_MS = 500;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const latestRef = useRef<CasterMatch[]>(serverMatches);

  useEffect(() => {
    if (!pendingRef.current) {
      setLocalMatches(serverMatches);
      latestRef.current = serverMatches;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casterSheet]);

  useEffect(() => () => {
    // Flush any pending edit if the tab unmounts mid-debounce.
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      if (pendingRef.current) setCasterSheet(latestRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll the linked/just-created match into view when navigated here from the bracket.
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => onHighlightHandled?.(), 2500);
      return () => clearTimeout(t);
    }
  }, [highlightId, onHighlightHandled]);

  const persistNow = async (next: CasterMatch[]) => {
    pendingRef.current = false;
    setSaving(true);
    await setCasterSheet(next);
    setSaving(false);
  };

  const persistDebounced = (next: CasterMatch[]) => {
    latestRef.current = next;
    pendingRef.current = true;
    setSaving(true);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      persistNow(latestRef.current);
    }, DEBOUNCE_MS);
  };

  const addMatch = () => {
    const next = [...localMatches, emptyMatch()];
    setLocalMatches(next);
    persistNow(next);
  };

  const updateMatch = (id: string, patch: Partial<CasterMatch>) => {
    const next = localMatches.map(m => m.id === id ? { ...m, ...patch } : m);
    setLocalMatches(next);
    persistDebounced(next);
  };

  const deleteMatch = (id: string) => {
    const next = localMatches.filter(m => m.id !== id);
    setLocalMatches(next);
    persistNow(next);
  };

  const matches = localMatches;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text">🎙 CASTER SHEET</h2>
        <div className="flex items-center gap-3">
          {saving && <span className="font-['DM_Mono'] text-[10px] t-muted">Saving…</span>}
          {isAdmin && (
            <button
              onClick={addMatch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border t-border-mid t-muted t-elevated font-['DM_Mono'] text-xs transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
            >
              ➕ Add Match
            </button>
          )}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="t-muted text-sm italic py-10 text-center">
          {isAdmin ? 'No matches yet — tap "Add Match" to start, or click 🎙 on a bracket match.' : 'No match details posted yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map(m => (
            <MatchCard
              key={m.id}
              match={m}
              isAdmin={isAdmin}
              onChange={(patch) => updateMatch(m.id, patch)}
              onDelete={() => deleteMatch(m.id)}
              highlighted={m.id === highlightId}
              cardRef={m.id === highlightId ? highlightRef : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
CasterSheetTab.displayName = 'CasterSheetTab';
