'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TournamentMeta {
  id: string;
  name: string;
  createdAt: number;
}

interface Props {
  onSelect: (id: string) => void;
}

export function TournamentPicker({ onSelect }: Props) {
  const [tournaments, setTournaments] = useState<TournamentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tournaments');
      const data = await res.json();
      setTournaments(data.tournaments ?? []);
    } catch {
      setError('Failed to load tournaments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setError('');
    const safeId = newId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const safeName = newName.trim();
    if (!safeId) { setError('ID is required (letters, numbers, hyphens only).'); return; }
    if (!safeName) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: safeId, name: safeName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to create tournament.'); return; }
      setTournaments(data.tournaments ?? []);
      setCreating(false);
      setNewId('');
      setNewName('');
      onSelect(data.id);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center t-bg overflow-hidden relative">
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 20% 10%, var(--grad-start) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 80% 90%, var(--grad-end) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="font-['Bebas_Neue'] text-5xl tracking-widest bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent)] bg-clip-text text-transparent mb-1">
            ⚔ TOURNEY
          </div>
          <p className="font-['DM_Mono'] text-xs t-muted tracking-widest uppercase">Select a tournament to continue</p>
        </div>

        <div className="t-surface border t-border rounded-2xl p-6 shadow-xl">

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="font-['DM_Mono'] text-xs t-muted animate-pulse">Loading tournaments…</div>
            </div>
          )}

          {/* Tournament list */}
          {!loading && !creating && (
            <>
              {tournaments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-3">🏆</div>
                  <p className="font-['DM_Mono'] text-sm t-muted mb-1">No tournaments yet.</p>
                  <p className="font-['DM_Mono'] text-xs t-muted">Create one below to get started.</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
                  {tournaments.map(t => (
                    <button
                      key={t.id}
                      onClick={() => onSelect(t.id)}
                      className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border t-border-mid t-elevated hover:border-[var(--accent)] hover:bg-[rgba(77,124,255,0.06)] group transition-all cursor-pointer"
                    >
                      <div>
                        <div className="font-['DM_Mono'] text-sm t-text font-medium group-hover:text-[var(--accent)] transition-colors">{t.name}</div>
                        <div className="font-['DM_Mono'] text-[10px] t-muted mt-0.5">/{t.id} · {new Date(t.createdAt).toLocaleDateString()}</div>
                      </div>
                      <span className="t-muted group-hover:text-[var(--accent)] transition-colors text-lg">→</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setCreating(true); setError(''); }}
                className="w-full py-2.5 rounded-xl border border-dashed t-border-mid t-muted hover:border-[var(--accent)] hover:text-[var(--accent)] font-['DM_Mono'] text-xs tracking-widest uppercase transition-all cursor-pointer"
              >
                + New Tournament
              </button>
            </>
          )}

          {/* Create form */}
          {!loading && creating && (
            <div className="space-y-4">
              <div>
                <label className="block font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">Tournament Name</label>
                <input
                  type="text"
                  className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. Kabut Open 2025"
                  value={newName}
                  onChange={e => {
                    setNewName(e.target.value);
                    // auto-derive id from name
                    if (!newId || newId === newName.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-')) {
                      setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 64));
                    }
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">ID / Slug</label>
                <input
                  type="text"
                  className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. kabut-open-2025"
                  value={newId}
                  onChange={e => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64))}
                />
                <p className="font-['DM_Mono'] text-[10px] t-muted mt-1">Letters, numbers and hyphens only.</p>
              </div>

              {error && (
                <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)]">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                  onClick={() => { setCreating(false); setError(''); setNewId(''); setNewName(''); }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 py-2.5 rounded-xl text-white font-['DM_Mono'] text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                  onClick={handleCreate}
                  disabled={saving || !newId || !newName.trim()}
                >
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* Error (list view) */}
          {!loading && !creating && error && (
            <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)] mt-3 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
