'use client';

import { useState, useRef } from 'react';
import { useTourney } from '@/lib/context';
import type { FFAMapInfo, FFAMatch, FFAPlayerScore } from '@/lib/types';

// ─── default map info pre-filled from the screenshot ─────────────────────────
const DEFAULT_MAP_INFO: FFAMapInfo = {
  title: 'Tour',
  mapName: 'London',
  scoreLimit: 50,
  timeLimit: 20,
  maxPlayers: '8 vs 8',
  password: '',
  server: 'SG',
  imageUrl: '',
};

function MapInfoForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: FFAMapInfo;
  onSave: (info: FFAMapInfo) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FFAMapInfo>(initial);
  const imgRef = useRef<HTMLInputElement>(null);
  const { adminToken, tournamentId } = useTourney();
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof FFAMapInfo, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleImageFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('t', tournamentId);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: adminToken ? { 'X-Admin-Token': adminToken } : {},
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        set('imageUrl', data.url ?? '');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Map Name */}
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Map Name</span>
          <input
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.mapName}
            onChange={e => set('mapName', e.target.value)}
            placeholder="e.g. London"
          />
        </label>
        {/* Title / Mode */}
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Title / Mode</span>
          <input
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Tour"
          />
        </label>
        {/* Score Limit */}
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Score Limit (kills)</span>
          <input
            type="number"
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.scoreLimit}
            onChange={e => set('scoreLimit', Number(e.target.value))}
          />
        </label>
        {/* Time Limit */}
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Time Limit (min)</span>
          <input
            type="number"
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.timeLimit}
            onChange={e => set('timeLimit', Number(e.target.value))}
          />
        </label>
        {/* Max Players */}
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Max Players</span>
          <input
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.maxPlayers}
            onChange={e => set('maxPlayers', e.target.value)}
            placeholder="e.g. 8 vs 8"
          />
        </label>
        {/* Server */}
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Server</span>
          <input
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.server}
            onChange={e => set('server', e.target.value)}
            placeholder="e.g. SG"
          />
        </label>
        {/* Password */}
        <label className="flex flex-col gap-1 col-span-2">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Password</span>
          <input
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder="Room password"
          />
        </label>
      </div>

      {/* Map screenshot */}
      <div className="flex flex-col gap-1">
        <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Map Screenshot (optional)</span>
        <div className="flex gap-2 items-center">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={imgRef}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
          />
          <button
            className="px-3 py-2 rounded-xl t-elevated border t-border-mid font-['DM_Mono'] text-xs t-text hover:border-[var(--accent)] transition-colors cursor-pointer disabled:opacity-40"
            onClick={() => imgRef.current?.click()}
            disabled={uploading}
          >{uploading ? 'Uploading…' : '📷 Upload Image'}</button>
          {form.imageUrl && (
            <span className="font-['DM_Mono'] text-[10px] t-muted truncate max-w-[200px]">✓ image set</span>
          )}
        </div>
        {form.imageUrl && (
          <img src={form.imageUrl} alt="map preview" className="mt-2 rounded-xl max-h-32 object-cover border t-border" />
        )}
      </div>

      <div className="flex gap-2 justify-end mt-1">
        <button
          className="px-4 py-2 rounded-xl t-elevated border t-border-mid t-text font-bold text-sm hover:border-[var(--accent)] transition-colors cursor-pointer"
          onClick={onCancel}
        >Cancel</button>
        <button
          className="px-4 py-2 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer"
          style={{ background: 'var(--accent)' }}
          onClick={() => onSave(form)}
        >Save Match</button>
      </div>
    </div>
  );
}

// ─── Score row ────────────────────────────────────────────────────────────────
function ScoreRow({
  player,
  score,
  rank,
  isAdmin,
  locked,
  onScoreChange,
  onRemove,
  onImageUpload,
}: {
  player: string;
  score?: FFAPlayerScore;
  rank?: number;
  isAdmin: boolean;
  locked: boolean;
  onScoreChange: (playerName: string, score: number) => void;
  onRemove: (playerName: string) => void;
  onImageUpload: (playerName: string, file: File) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(score?.score?.toString() ?? '');
  const imgRef = useRef<HTMLInputElement>(null);

  const rankColors = ['text-[var(--accent-gold)]', 'text-slate-300', 'text-amber-600'];
  const rankIcons = ['🥇', '🥈', '🥉'];

  const handleSave = () => {
    const val = parseInt(draft, 10);
    if (!isNaN(val) && val >= 0) {
      onScoreChange(player, val);
    }
    setEditing(false);
  };

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
      score !== undefined
        ? 'border-[var(--border)] t-elevated'
        : 'border-dashed border-[var(--border-mid)] opacity-60'
    }`}>
      {/* Rank */}
      <div className="w-8 shrink-0 text-center">
        {rank !== undefined && rank <= 3
          ? <span className="text-lg">{rankIcons[rank - 1]}</span>
          : rank !== undefined
            ? <span className={`font-['Bebas_Neue'] text-base t-dim`}>#{rank}</span>
            : <span className="font-['DM_Mono'] text-xs t-dim">—</span>
        }
      </div>

      {/* Player name */}
      <span className="flex-1 font-['DM_Mono'] text-sm t-text truncate">{player}</span>

      {/* Score */}
      {editing && isAdmin && !locked ? (
        <input
          autoFocus
          type="number"
          min={0}
          className="w-20 t-elevated border border-[var(--accent)] rounded-lg px-2 py-1 t-text font-['Bebas_Neue'] text-lg outline-none text-center"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={handleSave}
        />
      ) : (
        <span
          className={`font-['Bebas_Neue'] text-xl w-16 text-center shrink-0 ${
            rank === 1 ? 'text-[var(--accent-gold)]' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 't-text'
          } ${isAdmin && !locked ? 'cursor-pointer hover:text-[var(--accent)] transition-colors' : ''}`}
          title={isAdmin && !locked ? 'Click to edit score' : undefined}
          onClick={() => { if (isAdmin && !locked) { setDraft(score?.score?.toString() ?? '0'); setEditing(true); } }}
        >
          {score?.score ?? '—'}
        </span>
      )}

      {/* Score image */}
      {score?.imageUrl && (
        <a href={score.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm" title="View score screenshot">🖼</a>
      )}
      {isAdmin && !locked && (
        <>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={imgRef}
            onChange={e => { const f = e.target.files?.[0]; if (f) onImageUpload(player, f); }}
          />
          <button
            className="shrink-0 font-['DM_Mono'] text-[10px] t-dim hover:text-[var(--accent)] transition-colors cursor-pointer"
            title="Upload score screenshot"
            onClick={() => imgRef.current?.click()}
          >📎</button>
          <button
            className="shrink-0 font-['DM_Mono'] text-[10px] t-dim hover:text-[var(--accent-red)] transition-colors cursor-pointer"
            onClick={() => onRemove(player)}
          >✕</button>
        </>
      )}
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({ match, isAdmin }: { match: FFAMatch; isAdmin: boolean }) {
  const {
    updateFFAScore, removeFFAScore, deleteFFAMatch, lockFFAMatch,
    updateFFAMapInfo, setFFAMatchImage, ffa, adminToken, tournamentId,
  } = useTourney();

  const [editingInfo, setEditingInfo] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Build sorted scores — players with scores sorted desc, then unscored players
  const scoredMap = new Map(match.scores.map(s => [s.playerName, s]));
  const sortedScored = [...match.scores].sort((a, b) => b.score - a.score);
  const unscoredPlayers = ffa.players.filter(p => !scoredMap.has(p));

  const handleScoreImageUpload = async (playerName: string, file: File) => {
    setUploading(playerName);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('t', tournamentId);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: adminToken ? { 'X-Admin-Token': adminToken } : {},
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        await updateFFAScore(match.id, playerName, scoredMap.get(playerName)?.score ?? 0, data.url);
      }
    } finally {
      setUploading(null);
    }
  };

  const m = match.mapInfo;

  return (
    <div className="t-surface border t-border rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="relative">
        {m.imageUrl ? (
          <div className="relative h-28 overflow-hidden">
            <img src={m.imageUrl} alt={m.mapName} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-0 left-0 p-3">
              <p className="font-['Bebas_Neue'] text-2xl text-white tracking-widest leading-none">{m.mapName}</p>
              <p className="font-['DM_Mono'] text-[10px] text-white/70">Free For All</p>
            </div>
          </div>
        ) : (
          <div className="px-4 pt-4 pb-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-['Bebas_Neue'] text-xl t-text tracking-widest leading-none">{m.mapName}</p>
              <p className="font-['DM_Mono'] text-[10px] t-muted">Free For All</p>
            </div>
          </div>
        )}

        {/* Lock / delete controls */}
        {isAdmin && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              className={`px-2 py-1 rounded-lg font-['DM_Mono'] text-[10px] border cursor-pointer transition-colors ${
                match.locked
                  ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[rgba(255,176,32,0.1)]'
                  : 'border-[var(--border-mid)] t-muted t-elevated hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]'
              }`}
              title={match.locked ? 'Unlock match' : 'Lock match'}
              onClick={() => lockFFAMatch(match.id, !match.locked)}
            >{match.locked ? '🔒 Locked' : '🔓 Lock'}</button>
            {!match.locked && (
              <button
                className="px-2 py-1 rounded-lg font-['DM_Mono'] text-[10px] border t-border-mid t-muted t-elevated hover:border-[var(--accent)] hover:t-text cursor-pointer transition-colors"
                onClick={() => setEditingInfo(true)}
              >✏️</button>
            )}
            <button
              className="px-2 py-1 rounded-lg font-['DM_Mono'] text-[10px] border t-border-mid t-muted t-elevated hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] cursor-pointer transition-colors"
              onClick={() => deleteFFAMatch(match.id)}
            >🗑</button>
          </div>
        )}
      </div>

      {/* Map info table */}
      <div className="px-4 py-2 grid grid-cols-3 gap-x-4 gap-y-1 border-b t-border shrink-0">
        {[
          { label: 'Title', value: m.title },
          { label: 'Score Limit', value: `${m.scoreLimit} Kills` },
          { label: 'Time Limit', value: `${m.timeLimit} min` },
          { label: 'Max Players', value: m.maxPlayers },
          { label: 'Server', value: m.server },
          { label: 'Password', value: m.password || '—' },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col">
            <span className="font-['DM_Mono'] text-[9px] t-dim tracking-widest uppercase">{label}</span>
            <span className="font-['DM_Mono'] text-xs t-text font-medium">{value}</span>
          </div>
        ))}
      </div>

      {/* Edit map info modal */}
      {editingInfo && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditingInfo(false); }}
        >
          <div className="t-surface border t-border rounded-2xl p-6 w-full max-w-lg animate-scale-in shadow-xl overflow-y-auto max-h-[90vh]">
            <h2 className="font-['Bebas_Neue'] text-2xl tracking-widest mb-4 t-text">✏️ EDIT MATCH INFO</h2>
            <MapInfoForm
              initial={m}
              onSave={info => { updateFFAMapInfo(match.id, info); setEditingInfo(false); }}
              onCancel={() => setEditingInfo(false)}
            />
          </div>
        </div>
      )}

      {/* Score list */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-['Bebas_Neue'] text-base tracking-widest t-text">🏆 Scoreboard</span>
          {match.locked && <span className="font-['DM_Mono'] text-[10px] text-[var(--accent-gold)]">Locked</span>}
        </div>

        {sortedScored.length === 0 && unscoredPlayers.length === 0 && (
          <p className="font-['DM_Mono'] text-xs t-dim text-center py-4">
            {isAdmin ? 'Add players in the Players panel, then enter scores here.' : 'No scores yet.'}
          </p>
        )}

        {/* Scored */}
        {sortedScored.map((s, i) => (
          <ScoreRow
            key={s.playerName}
            player={s.playerName}
            score={s}
            rank={i + 1}
            isAdmin={isAdmin}
            locked={match.locked}
            onScoreChange={(name, score) => updateFFAScore(match.id, name, score)}
            onRemove={name => removeFFAScore(match.id, name)}
            onImageUpload={handleScoreImageUpload}
          />
        ))}

        {/* Unscored */}
        {!match.locked && unscoredPlayers.map(p => (
          <ScoreRow
            key={p}
            player={p}
            rank={undefined}
            isAdmin={isAdmin}
            locked={match.locked}
            onScoreChange={(name, score) => updateFFAScore(match.id, name, score)}
            onRemove={name => removeFFAScore(match.id, name)}
            onImageUpload={handleScoreImageUpload}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main FFA Tab ─────────────────────────────────────────────────────────────
export function FFATab() {
  const {
    ffa, isAdmin, loading,
    createFFAMatch, setFFAPlayers,
    players: queuePlayers, roster,
  } = useTourney();

  const [showNewMatch, setShowNewMatch] = useState(false);
  const [showPlayerMgr, setShowPlayerMgr] = useState(false);
  const [busy, setBusy] = useState(false);

  // All available player names from the players tab
  const availablePlayers = roster.length > 0 ? roster : queuePlayers.map(p => p.name);

  if (loading) return (
    <div className="flex-1 flex flex-col w-full py-6 gap-4 animate-pulse">
      <div className="h-8 w-48 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {[0, 1].map(i => <div key={i} className="rounded-2xl" style={{ background: 'var(--bg-elevated)', opacity: 1 - i * 0.3 }} />)}
      </div>
    </div>
  );

  const handleCreateMatch = async (mapInfo: FFAMapInfo) => {
    setBusy(true);
    await createFFAMatch(mapInfo);
    setBusy(false);
    setShowNewMatch(false);
  };

  const toggleFFAPlayer = async (name: string) => {
    const current = ffa.players ?? [];
    const next = current.includes(name)
      ? current.filter(p => p !== name)
      : [...current, name];
    await setFFAPlayers(next);
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden py-4 gap-4">
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Free For All</h1>
          <p className="font-['DM_Mono'] text-xs t-muted">
            {isAdmin
              ? 'Create matches, assign players, and enter scores after each round.'
              : 'Live scoreboard — scores update in real time'}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border t-border-mid t-muted t-elevated font-['DM_Mono'] text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer"
              onClick={() => setShowPlayerMgr(true)}
            >
              👥 Players ({ffa.players?.length ?? 0})
            </button>
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-['DM_Mono'] text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
              style={{ background: 'var(--accent-red)' }}
              onClick={() => setShowNewMatch(true)}
              disabled={busy}
            >
              + New Match
            </button>
          </div>
        )}
      </div>

      {/* Match grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {ffa.matches?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-60">
            <span className="text-5xl">🎮</span>
            <p className="font-['Bebas_Neue'] text-2xl tracking-widest t-dim">NO MATCHES YET</p>
            <p className="font-['DM_Mono'] text-xs t-dim text-center max-w-xs">
              {isAdmin
                ? 'Click "+ New Match" to create a Free For All round with map details and scores.'
                : 'Waiting for admin to create a match.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
            {ffa.matches.map(match => (
              <MatchCard key={match.id} match={match} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>

      {/* New Match Modal */}
      {showNewMatch && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowNewMatch(false); }}
        >
          <div className="t-surface border t-border rounded-2xl p-6 w-full max-w-lg animate-scale-in shadow-xl overflow-y-auto max-h-[90vh]">
            <h2 className="font-['Bebas_Neue'] text-2xl tracking-widest mb-1 t-text">🎮 NEW FFA MATCH</h2>
            <p className="t-muted text-xs font-['DM_Mono'] mb-5">Fill in the map details from the game lobby screenshot.</p>
            <MapInfoForm
              initial={DEFAULT_MAP_INFO}
              onSave={handleCreateMatch}
              onCancel={() => setShowNewMatch(false)}
            />
          </div>
        </div>
      )}

      {/* Player Manager Modal */}
      {showPlayerMgr && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowPlayerMgr(false); }}
        >
          <div className="t-surface border t-border rounded-2xl p-6 w-full max-w-md animate-scale-in shadow-xl overflow-y-auto max-h-[90vh]">
            <h2 className="font-['Bebas_Neue'] text-2xl tracking-widest mb-1 t-text">👥 FFA PLAYERS</h2>
            <p className="font-['DM_Mono'] text-xs t-muted mb-4">
              Select which players are participating in FFA rounds. These names appear in every match&apos;s scoreboard.
            </p>

            {availablePlayers.length === 0 && (
              <p className="font-['DM_Mono'] text-xs t-dim py-3 text-center">
                No players in the queue yet. Add players in the Players tab first.
              </p>
            )}

            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto mb-4">
              {availablePlayers.map(name => {
                const selected = ffa.players?.includes(name) ?? false;
                return (
                  <button
                    key={name}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer font-['DM_Mono'] text-sm ${
                      selected
                        ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(77,124,255,0.06)]'
                        : 't-elevated border-[var(--border)] t-text hover:border-[var(--accent-mid)] hover:bg-[rgba(128,128,255,0.04)]'
                    }`}
                    onClick={() => toggleFFAPlayer(name)}
                  >
                    <span className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        background: selected ? 'var(--accent)' : 'transparent',
                        borderColor: selected ? 'var(--accent)' : 'var(--border-mid)',
                      }}
                    >
                      {selected && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    {name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <span className="font-['DM_Mono'] text-xs t-muted">{ffa.players?.length ?? 0} selected</span>
              <button
                className="px-4 py-2 rounded-xl text-white font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: 'var(--accent)' }}
                onClick={() => setShowPlayerMgr(false)}
              >Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
