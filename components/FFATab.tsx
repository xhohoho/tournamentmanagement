'use client';

import { useState, useRef } from 'react';
import { useTourney } from '@/lib/context';
import type { FFAMapInfo, FFAMatch, FFAWinner } from '@/lib/types';

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
  rules: '',
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
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Map Name</span>
          <input
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.mapName}
            onChange={e => set('mapName', e.target.value)}
            placeholder="e.g. London"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Title / Mode</span>
          <input
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Tour"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Score Limit (kills)</span>
          <input
            type="number"
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.scoreLimit}
            onChange={e => set('scoreLimit', Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Time Limit (min)</span>
          <input
            type="number"
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.timeLimit}
            onChange={e => set('timeLimit', Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Max Players</span>
          <input
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.maxPlayers}
            onChange={e => set('maxPlayers', e.target.value)}
            placeholder="e.g. 8 vs 8"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Server</span>
          <input
            className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
            value={form.server}
            onChange={e => set('server', e.target.value)}
            placeholder="e.g. SG"
          />
        </label>
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

      <label className="flex flex-col gap-1">
        <span className="font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">Rules (optional)</span>
        <textarea
          rows={4}
          className="t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none"
          value={form.rules ?? ''}
          onChange={e => set('rules', e.target.value)}
          placeholder="e.g. No camping. No explosives. Top 3 players win points."
        />
      </label>

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

// ─── Score Tab Image section ──────────────────────────────────────────────────
function ScoreTabSection({ match, isAdmin }: { match: FFAMatch; isAdmin: boolean }) {
  const { setFFAMatchScoreImage, adminToken, tournamentId } = useTourney();
  const imgRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const scoreImageUrl = match.scoreImageUrl;

  const handleFile = async (file: File) => {
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
        await setFFAMatchScoreImage(match.id, data.url ?? '');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-['Bebas_Neue'] text-base tracking-widest t-text">🏆 Score Tab</span>
        {match.locked && (
          <span className="font-['DM_Mono'] text-[10px] text-[var(--accent-gold)]">Locked</span>
        )}
      </div>

      {scoreImageUrl ? (
        <div className="relative group cursor-pointer" onClick={() => setLightbox(true)}>
          <img
            src={scoreImageUrl}
            alt="Score tab"
            className="w-full rounded-xl border t-border object-cover max-h-64 hover:opacity-90 transition-opacity"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="bg-black/60 text-white font-['DM_Mono'] text-xs px-3 py-1.5 rounded-lg">🔍 View full</span>
          </div>
        </div>
      ) : (
        <div
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed t-border-mid py-8 ${isAdmin && !match.locked ? 'cursor-pointer hover:border-[var(--accent)] transition-colors' : 'opacity-50'}`}
          onClick={() => { if (isAdmin && !match.locked) imgRef.current?.click(); }}
        >
          <span className="text-3xl">📋</span>
          <p className="font-['DM_Mono'] text-xs t-dim text-center">
            {isAdmin && !match.locked
              ? 'Click to upload score tab screenshot'
              : 'No score tab uploaded yet'}
          </p>
        </div>
      )}

      {isAdmin && !match.locked && (
        <div className="flex gap-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={imgRef}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl t-elevated border t-border-mid font-['DM_Mono'] text-xs t-text hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer disabled:opacity-40"
            onClick={() => imgRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <>⏳ Uploading…</> : scoreImageUrl ? <>🔄 Replace image</> : <>📷 Upload score tab</>}
          </button>
          {scoreImageUrl && (
            <button
              className="px-3 py-2 rounded-xl t-elevated border t-border-mid font-['DM_Mono'] text-xs t-dim hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] transition-colors cursor-pointer"
              title="Remove score image"
              onClick={() => setFFAMatchScoreImage(match.id, '')}
            >✕</button>
          )}
        </div>
      )}

      {lightbox && scoreImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center gap-3">
            <img
              src={scoreImageUrl}
              alt="Score tab full view"
              className="rounded-xl max-h-[80vh] object-contain w-full"
              onClick={e => e.stopPropagation()}
            />
            <button
              className="font-['DM_Mono'] text-xs text-white/60 hover:text-white transition-colors"
              onClick={() => setLightbox(false)}
            >✕ Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Winners Section ──────────────────────────────────────────────────────────
// Each draft row carries an extra `custom` flag: when true the admin types a
// free-form name instead of picking from the roster dropdown.  This lets
// players who joined mid-match (not in the roster) be declared as winners.
type DraftWinner = FFAWinner & { custom: boolean };

function WinnersSection({ match, isAdmin }: { match: FFAMatch; isAdmin: boolean }) {
  const { setFFAMatchWinners, roster, players } = useTourney();

  // Prefer roster; fall back to the queue if roster is empty
  const playerList = roster.length > 0 ? roster : players.map(p => p.name);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftWinner[]>([]);
  const [saving, setSaving] = useState(false);

  const winners = match.winners ?? [];
  const hasWinners = winners.length > 0;

  const openEdit = () => {
    // When reopening, preserve existing winners; detect custom names (not in playerList)
    const initial: DraftWinner[] =
      winners.length > 0
        ? winners.map(w => ({ ...w, custom: !playerList.includes(w.playerName) }))
        : [{ playerName: '', prize: '', custom: playerList.length === 0 }];
    setDraft(initial);
    setEditing(true);
  };

  const addRow = () =>
    setDraft(prev => [...prev, { playerName: '', prize: '', custom: playerList.length === 0 }]);
  const removeRow = (i: number) => setDraft(prev => prev.filter((_, idx) => idx !== i));
  const setField = (i: number, field: keyof FFAWinner, val: string) =>
    setDraft(prev => prev.map((w, idx) => idx === i ? { ...w, [field]: val } : w));
  const toggleCustom = (i: number) =>
    setDraft(prev => prev.map((w, idx) =>
      idx === i ? { ...w, custom: !w.custom, playerName: '' } : w
    ));

  const handleSave = async () => {
    const cleaned: FFAWinner[] = draft
      .filter(w => w.playerName.trim())
      .map(({ playerName, prize }) => ({ playerName: playerName.trim(), prize }));
    setSaving(true);
    await setFFAMatchWinners(match.id, cleaned);
    setSaving(false);
    setEditing(false);
  };

  const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`;

  // Names already picked in other rows (used to disable options in dropdowns)
  const pickedNames = draft.map(r => r.playerName).filter(Boolean);

  return (
    <div className="px-4 pb-4 flex flex-col gap-3 border-t t-border pt-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="font-['Bebas_Neue'] text-base tracking-widest t-text">🎖 Winners</span>
        {isAdmin && !editing && (
          <button
            className="px-2.5 py-1 rounded-lg t-elevated border t-border-mid font-['DM_Mono'] text-[10px] t-muted hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] transition-colors cursor-pointer"
            onClick={openEdit}
          >
            {hasWinners ? '✏️ Edit' : '+ Add Winners'}
          </button>
        )}
      </div>

      {/* ── Saved winners display ────────────────────────────────────────── */}
      {!editing && (
        hasWinners ? (
          <div className="flex flex-col gap-2">
            {winners.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: i === 0
                    ? 'linear-gradient(135deg, rgba(255,176,32,0.12), rgba(255,176,32,0.04))'
                    : i === 1
                    ? 'linear-gradient(135deg, rgba(180,190,200,0.10), rgba(180,190,200,0.03))'
                    : i === 2
                    ? 'linear-gradient(135deg, rgba(180,100,40,0.12), rgba(180,100,40,0.04))'
                    : 'var(--bg-elevated)',
                  border: i === 0
                    ? '1px solid rgba(255,176,32,0.25)'
                    : i === 1
                    ? '1px solid rgba(180,190,200,0.20)'
                    : i === 2
                    ? '1px solid rgba(180,100,40,0.22)'
                    : '1px solid var(--border-mid)',
                }}
              >
                <span className="text-lg leading-none w-6 text-center flex-shrink-0">{medal(i)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-['Bebas_Neue'] text-base tracking-wider t-text leading-tight truncate">{w.playerName}</p>
                  {w.prize && (
                    <p className="font-['DM_Mono'] text-[10px] tracking-wide truncate" style={{ color: 'var(--accent-gold)' }}>{w.prize}</p>
                  )}
                  {!playerList.includes(w.playerName) && (
                    <p className="font-['DM_Mono'] text-[9px] t-dim">guest / mid-match join</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl border-2 border-dashed t-border-mid opacity-50">
            <span className="text-2xl">🎖</span>
            <p className="font-['DM_Mono'] text-[10px] t-dim">
              {isAdmin ? 'No winners set yet' : 'No winners declared yet'}
            </p>
          </div>
        )
      )}

      {/* ── Edit form (admin only) ───────────────────────────────────────── */}
      {editing && (
        <div className="flex flex-col gap-3">
          {/* Hint when roster is empty */}
          {playerList.length === 0 && (
            <p className="font-['DM_Mono'] text-[10px] text-[var(--accent-gold)] bg-[rgba(255,176,32,0.08)] border border-[rgba(255,176,32,0.2)] rounded-xl px-3 py-2">
              ⚠ No players in roster — using free-text name entry. Add players in the Players tab to enable the roster dropdown.
            </p>
          )}

          {draft.map((row, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base w-6 text-center flex-shrink-0">{medal(i)}</span>

                {/* Player name: dropdown OR free-text depending on row.custom */}
                {row.custom || playerList.length === 0 ? (
                  <input
                    className="flex-1 t-elevated border border-[rgba(255,176,32,0.35)] rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-xs outline-none focus:border-[var(--accent-gold)] transition-colors"
                    placeholder="Type player name…"
                    value={row.playerName}
                    onChange={e => setField(i, 'playerName', e.target.value)}
                    autoFocus={row.playerName === ''}
                  />
                ) : (
                  <select
                    className="flex-1 t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-xs outline-none focus:border-[var(--accent-gold)] transition-colors cursor-pointer"
                    value={row.playerName}
                    onChange={e => setField(i, 'playerName', e.target.value)}
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <option value="">— Select player —</option>
                    {playerList.map(name => (
                      <option
                        key={name}
                        value={name}
                        disabled={name !== row.playerName && pickedNames.includes(name)}
                      >
                        {name}{name !== row.playerName && pickedNames.includes(name) ? ' (taken)' : ''}
                      </option>
                    ))}
                  </select>
                )}

                {/* Prize input */}
                <input
                  className="flex-1 t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-xs outline-none focus:border-[var(--accent-gold)] transition-colors"
                  placeholder="Prize (e.g. RP 50,000)"
                  value={row.prize}
                  onChange={e => setField(i, 'prize', e.target.value)}
                />

                {draft.length > 1 && (
                  <button
                    className="px-2 py-2 rounded-lg t-elevated border t-border-mid font-['DM_Mono'] text-[10px] t-dim hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] transition-colors cursor-pointer flex-shrink-0"
                    onClick={() => removeRow(i)}
                    title="Remove row"
                  >✕</button>
                )}
              </div>

              {/* Toggle between roster dropdown and custom name input */}
              {playerList.length > 0 && (
                <button
                  className="self-start ml-8 flex items-center gap-1 font-['DM_Mono'] text-[9px] transition-colors cursor-pointer"
                  style={{ color: row.custom ? 'var(--accent-gold)' : 'var(--text-dim)' }}
                  onClick={() => toggleCustom(i)}
                  title={row.custom ? 'Switch back to roster dropdown' : 'Type a custom name (guest / mid-match join)'}
                >
                  {row.custom
                    ? '📋 Pick from roster instead'
                    : '✏️ Guest / joined mid-match? Type name'}
                </button>
              )}
            </div>
          ))}

          <button
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl t-elevated border border-dashed t-border-mid font-['DM_Mono'] text-[10px] t-muted hover:border-[var(--accent)] hover:t-text transition-colors cursor-pointer"
            onClick={addRow}
          >
            + Add row
          </button>

          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 py-2 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-xs hover:border-[var(--accent)] transition-colors cursor-pointer"
              onClick={() => setEditing(false)}
              disabled={saving}
            >Cancel</button>
            <button
              className="flex-1 py-2 rounded-xl font-['DM_Mono'] text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
              style={{ background: 'var(--accent-gold)', color: '#1a0f00' }}
              onClick={handleSave}
              disabled={saving || draft.every(r => !r.playerName.trim())}
            >{saving ? 'Saving…' : '💾 Save Winners'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({ match, isAdmin }: { match: FFAMatch; isAdmin: boolean }) {
  const { deleteFFAMatch, lockFFAMatch, updateFFAMapInfo } = useTourney();
  const [editingInfo, setEditingInfo] = useState(false);
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

      {/* Rules */}
      {m.rules && (
        <div className="px-4 py-3 border-b t-border">
          <span className="font-['DM_Mono'] text-[9px] t-dim tracking-widest uppercase block mb-1">📜 Rules</span>
          <p className="font-['DM_Mono'] text-xs t-text whitespace-pre-wrap leading-relaxed">{m.rules}</p>
        </div>
      )}

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

      {/* Score Tab Image */}
      <ScoreTabSection match={match} isAdmin={isAdmin} />

      {/* Winners Block */}
      <WinnersSection match={match} isAdmin={isAdmin} />
    </div>
  );
}

// ─── Main FFA Tab ─────────────────────────────────────────────────────────────
export function FFATab() {
  const { ffa, isAdmin, loading, createFFAMatch } = useTourney();
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden py-4 gap-4">
      {/* Header */}
      <div className="shrink-0 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text mb-0.5">Free For All</h1>
          <p className="font-['DM_Mono'] text-xs t-muted">
            {isAdmin
              ? 'Create matches, upload score tab screenshots, and declare winners.'
              : 'Live scoreboard — scores update in real time'}
          </p>
        </div>
        {isAdmin && (
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-['DM_Mono'] text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
            style={{ background: 'var(--accent-red)' }}
            onClick={() => setShowNewMatch(true)}
            disabled={busy}
          >
            + New Match
          </button>
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
                ? 'Click "+ New Match" to create a Free For All round, then upload the score tab screenshot.'
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
    </div>
  );
}
