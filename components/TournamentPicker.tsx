'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TournamentMeta {
  id: string;
  name: string;
  createdAt: number;
  posterUrl?: string;
  tournamentDate?: number;
  organizer?: string;
}

const ADMIN_TOKEN_KEY = 'adminToken';

interface Props {
  onSelect: (id: string, adminToken?: string) => void;
}

export function TournamentPicker({ onSelect }: Props) {
  const [tournaments, setTournaments] = useState<TournamentMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin state
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // Create form
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newOrganizer, setNewOrganizer] = useState('');
  const [newTournamentDate, setNewTournamentDate] = useState('');
  const [newPosterFile, setNewPosterFile] = useState<File | null>(null);
  const [newPosterPreview, setNewPosterPreview] = useState<string>('');
  const [createErr, setCreateErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Poster edit (existing tournament)
  const [editingPosterId, setEditingPosterId] = useState<string | null>(null);
  const [posterSaving, setPosterSaving] = useState(false);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  // Shared upload helper — sends a file to /api/upload, returns the blob URL
  const uploadPoster = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: adminToken ? { 'X-Admin-Token': adminToken } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[uploadPoster] failed', res.status, err);
      return null;
    }
    const data = await res.json();
    console.log('[uploadPoster] success', data.url);
    return data.url ?? null;
  };

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
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 10 seconds so new tournaments created on other devices appear automatically
  useEffect(() => {
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  // ── Admin unlock ──────────────────────────────────────────────────────────
  const handleUnlock = async () => {
    setPwErr('');
    if (!pw.trim()) { setPwErr('Enter a password.'); return; }
    setUnlocking(true);
    try {
      const tid = tournaments[0]?.id ?? 'default';
      const res = await fetch(`/api/admin/auth?t=${tid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwErr(data.error ?? 'Wrong password.'); return; }
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setAdminToken(data.token);
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
      fetch('/api/admin/auth', { method: 'DELETE', headers: { 'X-Admin-Token': adminToken } }).catch(() => {});
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
    setCreating(false);
  };

  // ── Create tournament ─────────────────────────────────────────────────────
  const handleCreate = async () => {
    setCreateErr('');
    const safeId = newId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const safeName = newName.trim();
    if (!safeId) { setCreateErr('ID is required (letters, numbers, hyphens only).'); return; }
    if (!safeName) { setCreateErr('Name is required.'); return; }
    setSaving(true);
    try {
      // Upload the poster first if one was chosen, capture URL in a local var
      let posterUrl: string | undefined = undefined;
      if (newPosterFile) {
        const uploadedUrl = await uploadPoster(newPosterFile);
        if (uploadedUrl) {
          posterUrl = uploadedUrl;
          setNewPosterPreview(uploadedUrl);
        } else {
          // Upload failed — fall back to base64 data URL so poster still shows
          posterUrl = newPosterPreview || undefined;
        }
      }
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(adminToken ? { 'X-Admin-Token': adminToken } : {}) },
        body: JSON.stringify({
          id: safeId,
          name: safeName,
          posterUrl: posterUrl || undefined,
          organizer: newOrganizer.trim() || undefined,
          tournamentDate: newTournamentDate ? new Date(newTournamentDate).getTime() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) { localStorage.removeItem(ADMIN_TOKEN_KEY); setAdminToken(null); setCreateErr('Session expired. Please unlock again.'); }
        else setCreateErr(data.error ?? 'Failed to create tournament.');
        return;
      }
      setTournaments(data.tournaments ?? []);
      setCreating(false); setNewId(''); setNewName(''); setNewOrganizer(''); setNewTournamentDate(''); setNewPosterFile(null); setNewPosterPreview('');
      onSelect(data.id, adminToken ?? undefined);
    } catch {
      setCreateErr('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Update poster ─────────────────────────────────────────────────────────
  const handleSavePoster = async (id: string, file: File) => {
    setPosterSaving(true);
    try {
      const url = await uploadPoster(file);
      if (!url) { setPosterSaving(false); return; }
      const res = await fetch(`/api/tournaments?t=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(adminToken ? { 'X-Admin-Token': adminToken } : {}) },
        body: JSON.stringify({ posterUrl: url }),
      });
      const data = await res.json();
      if (res.ok) setTournaments(data.tournaments ?? []);
    } catch { /* ignore */ } finally {
      setPosterSaving(false);
      setEditingPosterId(null);
    }
  };

  // ── Delete tournament ─────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeleting(true);
    setDeleteErr('');
    try {
      const res = await fetch(`/api/tournaments?t=${id}`, {
        method: 'DELETE',
        headers: adminToken ? { 'X-Admin-Token': adminToken } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          setAdminToken(null);
          setDeleteErr('Session expired. Please unlock again.');
        } else {
          setDeleteErr(data.error ?? 'Failed to delete tournament.');
        }
        return;
      }
      setTournaments(data.tournaments ?? []);
      setConfirmDeleteId(null);
    } catch {
      setDeleteErr('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const isAdmin = !!adminToken;

  // Lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  return (
    <div className="min-h-screen w-screen t-bg overflow-auto relative">
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 20% 10%, var(--grad-start) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 80% 90%, var(--grad-end) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 font-['Bebas_Neue'] text-6xl tracking-widest bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent)] bg-clip-text text-transparent mb-2">
            <img src="/launcher-icon.png" alt="" className="w-14 h-14 object-contain" />
            TOURNEY
          </div>
          <p className="font-['DM_Mono'] text-xs t-muted tracking-widest uppercase">Select a tournament to continue</p>
        </div>

        {/* Admin toolbar */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={isAdmin ? handleLogout : () => setShowUnlock(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-['DM_Mono'] text-xs transition-all cursor-pointer ${
              isAdmin
                ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[rgba(255,176,32,0.08)] hover:bg-[rgba(255,176,32,0.15)]'
                : 't-border-mid t-muted t-elevated hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]'
            }`}
          >
            {isAdmin ? '🔓 Admin (click to logout)' : '🔒 Admin Login'}
          </button>
          {isAdmin && (
            <button
              onClick={() => { setCreating(true); setCreateErr(''); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed t-border-mid t-muted hover:border-[var(--accent)] hover:text-[var(--accent)] font-['DM_Mono'] text-xs tracking-widest uppercase transition-all cursor-pointer"
            >
              + New Tournament
            </button>
          )}
        </div>

        {/* ── Loading ─────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="font-['DM_Mono'] text-xs t-muted animate-pulse">Loading tournaments…</div>
          </div>
        )}

        {/* ── Admin unlock (inline modal) ─────────────────────── */}
        {!loading && showUnlock && (
          <div className="max-w-sm mx-auto t-surface border t-border rounded-2xl p-6 shadow-xl">
            <h3 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text mb-1">🔐 ADMIN UNLOCK</h3>
            <p className="font-['DM_Mono'] text-xs t-muted mb-4">Enter the admin password to manage tournaments.</p>
            <input
              type="password"
              className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent-gold)] transition-colors mb-3"
              placeholder="Password…"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              autoFocus
            />
            {pwErr && <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)] mb-3">{pwErr}</p>}
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                onClick={() => { setShowUnlock(false); setPw(''); setPwErr(''); }}
                disabled={unlocking}
              >Cancel</button>
              <button
                className="flex-1 py-2.5 rounded-xl font-['DM_Mono'] text-sm font-bold disabled:opacity-40 cursor-pointer"
                style={{ background: 'var(--accent-gold)', color: '#1a0f00' }}
                onClick={handleUnlock}
                disabled={unlocking || !pw.trim()}
              >{unlocking ? 'Checking…' : 'Unlock'}</button>
            </div>
          </div>
        )}

        {/* ── Create form ─────────────────────────────────────── */}
        {!loading && creating && (
          <div className="max-w-sm mx-auto t-surface border t-border rounded-2xl p-6 shadow-xl">
            <h3 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text mb-4">+ NEW TOURNAMENT</h3>
            <div className="space-y-4">
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
                    const derived = val.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64);
                    const prevDerived = newName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64);
                    if (!newId || newId === prevDerived) setNewId(derived);
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
                <p className="font-['DM_Mono'] text-[10px] t-muted mt-1">Letters, numbers, hyphens only.</p>
              </div>
              <div>
                <label className="block font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">Tournament Date & Time <span className="normal-case tracking-normal t-dim">(optional)</span></label>
                <input
                  type="datetime-local"
                  className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                  value={newTournamentDate}
                  onChange={e => setNewTournamentDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">Organizer <span className="normal-case tracking-normal t-dim">(optional)</span></label>
                <input
                  type="text"
                  className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. Kabut Esports"
                  value={newOrganizer}
                  onChange={e => setNewOrganizer(e.target.value.slice(0, 100))}
                />
              </div>
              <div>
                <label className="block font-['DM_Mono'] text-[10px] t-muted uppercase tracking-widest mb-1.5">Poster Image <span className="normal-case tracking-normal t-dim">(optional)</span></label>
                <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed t-border-mid t-muted hover:border-[var(--accent)] hover:text-[var(--accent)] font-['DM_Mono'] text-xs tracking-widest uppercase transition-all cursor-pointer">
                  📁 {newPosterFile ? newPosterFile.name : 'Choose image…'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0] ?? null;
                      setNewPosterFile(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => setNewPosterPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setNewPosterPreview('');
                      }
                    }}
                  />
                </label>
                {newPosterPreview && (
                  <div className="mt-2 rounded-lg overflow-hidden border t-border-mid h-28">
                    <img src={newPosterPreview} alt="poster preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              {createErr && <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)]">{createErr}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                  onClick={() => { setCreating(false); setCreateErr(''); setNewId(''); setNewName(''); setNewOrganizer(''); setNewTournamentDate(''); setNewPosterFile(null); setNewPosterPreview(''); }}
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
          </div>
        )}

        {/* ── Card grid ──────────────────────────────────────── */}
        {!loading && !showUnlock && !creating && (
          <>
            {tournaments.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">🏆</div>
                <p className="font-['DM_Mono'] text-sm t-muted mb-1">No tournaments yet.</p>
                {isAdmin
                  ? <p className="font-['DM_Mono'] text-xs t-muted">Create one using the button above.</p>
                  : <p className="font-['DM_Mono'] text-xs t-muted">Ask an admin to create a tournament.</p>
                }
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {tournaments.map(t => (
                  <div
                    key={t.id}
                    className="group relative flex flex-col rounded-2xl border t-border-mid t-surface overflow-hidden shadow-lg transition-all hover:border-[var(--accent)] hover:shadow-[0_0_24px_rgba(77,124,255,0.12)] cursor-pointer"
                    onClick={() => onSelect(t.id, adminToken ?? undefined)}
                  >

                    {/* Poster image */}
                    <div
                      className="relative w-full overflow-hidden"
                      style={{ aspectRatio: '16/9' }}
                    >
                      {t.posterUrl ? (
                        <img
                          src={t.posterUrl}
                          alt={`${t.name} poster`}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onClick={e => { e.stopPropagation(); setLightboxUrl(t.posterUrl!); }}
                          title="Click to view poster"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center t-elevated">
                          <span className="text-4xl mb-2">🏆</span>
                          <span className="font-['DM_Mono'] text-[10px] t-dim uppercase tracking-widest">No poster</span>
                        </div>
                      )}
                      {/* Gradient overlay — pointer-events-none so clicks pass to img */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

                      {/* Admin: edit poster button */}
                      {isAdmin && (
                        <label
                          onClick={e => e.stopPropagation()}
                          className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 font-['DM_Mono'] text-[10px] text-white/80 hover:bg-black/80 hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                          {posterSaving && editingPosterId === t.id ? '⏳ Uploading…' : '🖼 Edit Poster'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={posterSaving}
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setEditingPosterId(t.id);
                              await handleSavePoster(t.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}

                      {/* Admin: delete button (top-left) */}
                      {isAdmin && (
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(t.id); setDeleteErr(''); }}
                          className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 font-['DM_Mono'] text-[10px] text-red-400 hover:bg-red-900/70 hover:text-red-300 hover:border-red-500/50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                          🗑 Delete
                        </button>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="flex flex-col flex-1 p-4">
                      <div className="font-['Bebas_Neue'] text-xl tracking-wider t-text leading-tight mb-0.5 group-hover:text-[var(--accent)] transition-colors">
                        {t.name}
                      </div>
                      <div className="font-['DM_Mono'] text-[10px] t-muted mb-1">
                        /{t.id} · Created {new Date(t.createdAt).toLocaleDateString()}
                      </div>
                      {t.tournamentDate && (
                        <div className="font-['DM_Mono'] text-[10px] mb-0.5" style={{ color: 'var(--accent-gold)' }}>
                          📅 {new Date(t.tournamentDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      )}
                      {t.organizer && (
                        <div className="font-['DM_Mono'] text-[10px] t-muted mb-3">
                          <span className="t-dim">Organizer: </span>{t.organizer}
                        </div>
                      )}
                      {!t.tournamentDate && !t.organizer && <div className="mb-3" />}
                      <div
                        className="mt-auto w-full py-2.5 rounded-xl font-['DM_Mono'] text-xs font-bold uppercase tracking-widest text-white text-center transition-all group-hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg, var(--accent-red), var(--accent))' }}
                      >
                        Enter Tournament →
                      </div>
                    </div>

                    {/* Uploading overlay */}
                    {editingPosterId === t.id && posterSaving && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-10">
                        <div className="font-['DM_Mono'] text-xs text-white/70 animate-pulse">Uploading poster…</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Poster lightbox ─────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <img
              src={lightboxUrl}
              alt="Poster"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/80 hover:bg-black/90 hover:text-white font-bold text-sm transition-all cursor-pointer"
            >✕</button>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget && !deleting) setConfirmDeleteId(null); }}
        >
          <div className="t-surface border border-red-500/40 rounded-2xl p-7 w-[360px] max-w-[95vw] shadow-2xl">
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="font-['Bebas_Neue'] text-2xl tracking-widest text-red-400 mb-1">DELETE TOURNAMENT</h3>
            <p className="font-['DM_Mono'] text-xs t-muted mb-1">
              You are about to permanently delete:
            </p>
            <p className="font-['DM_Mono'] text-sm t-text font-bold mb-1">
              {tournaments.find(t => t.id === confirmDeleteId)?.name ?? confirmDeleteId}
            </p>
            <p className="font-['DM_Mono'] text-[10px] text-red-400/80 mb-5">
              This will delete all tournament data including teams, players, brackets, chat, and maps. This action cannot be undone.
            </p>
            {deleteErr && (
              <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)] mb-3">{deleteErr}</p>
            )}
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer disabled:opacity-40"
                onClick={() => { setConfirmDeleteId(null); setDeleteErr(''); }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl font-['DM_Mono'] text-sm font-bold text-white transition-all cursor-pointer hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--accent-red)' }}
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : '🗑 Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
