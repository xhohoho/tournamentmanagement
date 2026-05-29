'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TournamentMeta {
  id: string;
  name: string;
  createdAt: number;
}

// Admin token is stored in localStorage so it persists across the picker
// and gets picked up by the main app after tournament selection.
const ADMIN_TOKEN_KEY = 'adminToken';

interface Props {
  onSelect: (id: string, adminToken?: string) => void;
}

export function TournamentPicker({ onSelect }: Props) {
  const [tournaments, setTournaments] = useState<TournamentMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin state (pre-tournament)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // Create form
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [createErr, setCreateErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Restore cached admin token on mount
  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (stored) setAdminToken(stored);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tournaments');
      const data = await res.json();
      setTournaments(data.tournaments ?? []);
    } catch {
      // silently fail — list stays empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Admin unlock ────────────────────────────────────────────────────────
  const handleUnlock = async () => {
    setPwErr('');
    if (!pw.trim()) { setPwErr('Enter a password.'); return; }
    setUnlocking(true);
    try {
      // Use the first available tournament for auth, or 'default' if none exist.
      // Admin tokens are global (not per-tournament) so any valid tournament works.
      const tid = tournaments[0]?.id ?? 'default';
      const res = await fetch(`/api/admin/auth?t=${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwErr(data.error ?? 'Wrong password.'); return; }
      const token: string = data.token;
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      setAdminToken(token);
      setPw('');
      setShowUnlock(false);
    } catch {
      setPwErr('Network error. Try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleLogout = () => {
    if (adminToken) {
      fetch('/api/admin/auth', {
        method: 'DELETE',
        headers: { 'X-Admin-Token': adminToken },
      }).catch(() => {});
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
    setCreating(false);
  };

  // ── Create tournament ───────────────────────────────────────────────────
  const handleCreate = async () => {
    setCreateErr('');
    const safeId = newId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const safeName = newName.trim();
    if (!safeId) { setCreateErr('ID is required (letters, numbers, hyphens only).'); return; }
    if (!safeName) { setCreateErr('Name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
        },
        body: JSON.stringify({ id: safeId, name: safeName }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          // Token expired — force re-login
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          setAdminToken(null);
          setCreateErr('Session expired. Please unlock again.');
        } else {
          setCreateErr(data.error ?? 'Failed to create tournament.');
        }
        return;
      }
      setTournaments(data.tournaments ?? []);
      setCreating(false);
      setNewId('');
      setNewName('');
      onSelect(data.id, adminToken ?? undefined);
    } catch {
      setCreateErr('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = !!adminToken;

  return (
    <div className="h-screen w-screen flex items-center justify-center t-bg overflow-hidden relative">
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 20% 10%, var(--grad-start) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 80% 90%, var(--grad-end) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo + admin toggle */}
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

          {/* Unlock modal (inline) */}
          {!loading && showUnlock && (
            <div className="space-y-4">
              <div>
                <h3 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text mb-1">🔐 ADMIN UNLOCK</h3>
                <p className="font-['DM_Mono'] text-xs t-muted">Enter the admin password to create tournaments.</p>
              </div>
              <input
                type="password"
                className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent-gold)] transition-colors"
                placeholder="Password…"
                value={pw}
                onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                autoFocus
              />
              {pwErr && <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)]">{pwErr}</p>}
              <div className="flex gap-3">
                <button
                  className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                  onClick={() => { setShowUnlock(false); setPw(''); setPwErr(''); }}
                  disabled={unlocking}
                >Cancel</button>
                <button
                  className="flex-1 py-2.5 rounded-xl font-['DM_Mono'] text-sm font-bold disabled:opacity-40 transition-opacity cursor-pointer"
                  style={{ background: 'var(--accent-gold)', color: '#1a0f00' }}
                  onClick={handleUnlock}
                  disabled={unlocking || !pw.trim()}
                >{unlocking ? 'Checking…' : 'Unlock'}</button>
              </div>
            </div>
          )}

          {/* Tournament list */}
          {!loading && !showUnlock && !creating && (
            <>
              {tournaments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-3">🏆</div>
                  <p className="font-['DM_Mono'] text-sm t-muted mb-1">No tournaments yet.</p>
                  {isAdmin
                    ? <p className="font-['DM_Mono'] text-xs t-muted">Create one below to get started.</p>
                    : <p className="font-['DM_Mono'] text-xs t-muted">Ask an admin to create a tournament.</p>
                  }
                </div>
              ) : (
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
                  {tournaments.map(t => (
                    <button
                      key={t.id}
                      onClick={() => onSelect(t.id, adminToken ?? undefined)}
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

              <div className="flex gap-2 mt-2">
                {/* Admin lock/unlock button */}
                <button
                  onClick={isAdmin ? handleLogout : () => setShowUnlock(true)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border font-['DM_Mono'] text-xs transition-all cursor-pointer ${
                    isAdmin
                      ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[rgba(255,176,32,0.08)] hover:bg-[rgba(255,176,32,0.15)]'
                      : 't-border-mid t-muted t-elevated hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]'
                  }`}
                  title={isAdmin ? 'Logout admin' : 'Admin unlock'}
                >
                  {isAdmin ? '🔓 Admin' : '🔒'}
                </button>

                {/* New tournament — admin only */}
                {isAdmin && (
                  <button
                    onClick={() => { setCreating(true); setCreateErr(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-dashed t-border-mid t-muted hover:border-[var(--accent)] hover:text-[var(--accent)] font-['DM_Mono'] text-xs tracking-widest uppercase transition-all cursor-pointer"
                  >
                    + New Tournament
                  </button>
                )}

                {/* Non-admin spacer message */}
                {!isAdmin && tournaments.length > 0 && (
                  <div className="flex-1 flex items-center justify-center font-['DM_Mono'] text-[10px] t-muted tracking-widest uppercase">
                    Select a tournament above
                  </div>
                )}
              </div>
            </>
          )}

          {/* Create form */}
          {!loading && creating && (
            <div className="space-y-4">
              <div>
                <h3 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text mb-1">+ NEW TOURNAMENT</h3>
              </div>
              <div>
                <label className="block font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">Tournament Name</label>
                <input
                  type="text"
                  className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. Kabut Open 2025"
                  value={newName}
                  onChange={e => {
                    const val = e.target.value;
                    setNewName(val);
                    // Auto-derive slug: keep letters/numbers/spaces/hyphens, collapse spaces to hyphens
                    const derived = val.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64);
                    // Only auto-update ID if it still matches the previous auto-derived value
                    const prevDerived = newName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64);
                    if (!newId || newId === prevDerived) {
                      setNewId(derived);
                    }
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">ID / Slug <span className="normal-case tracking-normal" style={{color:'var(--accent)'}}>· editable</span></label>
                <input
                  type="text"
                  className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. kabut-open-2025"
                  value={newId}
                  onChange={e => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64))}
                />
                <p className="font-['DM_Mono'] text-[10px] t-muted mt-1">Auto-generated from name. You can edit it — letters, numbers, hyphens only.</p>
              </div>
              {createErr && <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)]">{createErr}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                  onClick={() => { setCreating(false); setCreateErr(''); setNewId(''); setNewName(''); }}
                  disabled={saving}
                >Cancel</button>
                <button
                  className="flex-1 py-2.5 rounded-xl text-white font-['DM_Mono'] text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                  onClick={handleCreate}
                  disabled={saving || !newId || !newName.trim()}
                >{saving ? 'Creating…' : 'Create'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
