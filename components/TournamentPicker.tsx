'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

import { useAdminSession }  from '@/hooks/useAdminSession';
import { useTournaments }   from '@/hooks/useTournaments';
import { usePosterUpload }  from '@/hooks/usePosterUpload';
import { usePickerTicker }  from '@/hooks/usePickerTicker';

import { AdminToolbar }        from '@/components/picker/AdminToolbar';
import { TournamentCard }      from '@/components/picker/TournamentCard';
import { TournamentFormModal, TournamentFormValues } from '@/components/picker/TournamentFormModal';
import { AdminUnlockPanel }    from '@/components/picker/modals/AdminUnlockPanel';
import { DeleteConfirmModal }  from '@/components/picker/modals/DeleteConfirmModal';
import { PosterLightbox }      from '@/components/picker/modals/PosterLightbox';
import { SuperAdminPanel }     from '@/components/SuperAdminPanel';
import BottomTicker            from '@/components/BottomTicker';

// Re-export so existing callers that import TournamentMeta from here still work
export type { TournamentMeta } from '@/hooks/useTournaments';


interface Props {
  onSelect: (
    id: string,
    adminToken?: string,
    adminInfo?: { adminId: string; name: string; isSuperAdmin: boolean },
  ) => void;
}

export function TournamentPicker({ onSelect }: Props) {
  // ── Hooks ────────────────────────────────────────────────────────────────
  const { adminToken, adminInfo, isAdmin, login, logout, changePassword, expireSession } = useAdminSession();
  const { tournaments, setTournaments, loading, refresh } = useTournaments();
  const { uploadPoster } = usePosterUpload(adminToken);
  const { tickerText, saveTickerText } = usePickerTicker(adminToken);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showUnlock, setShowUnlock]     = useState(false);
  const [adminNameInput, setAdminNameInput] = useState('');
  const [pw, setPw]                     = useState('');
  const [pwErr, setPwErr]               = useState('');
  const [unlocking, setUnlocking]       = useState(false);

  const [showCreate, setShowCreate]     = useState(false);
  const [createErr, setCreateErr]       = useState('');
  const [creating, setCreating]         = useState(false);

  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [editErr, setEditErr]           = useState('');
  const [editSaving, setEditSaving]     = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteErr, setDeleteErr]       = useState('');

  const [editingPosterId, setEditingPosterId] = useState<string | null>(null);
  const [posterSaving, setPosterSaving] = useState(false);

  const [superAdminOpen, setSuperAdminOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl]   = useState<string | null>(null);

  // ── Dark / light mode ───────────────────────────────────────────────────
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored === 'true') setDark(true);
  }, []);

  const toggleDark = () => setDark(prev => {
    localStorage.setItem('darkMode', String(!prev));
    return !prev;
  });

  // ── Live visitor / admin counts via SSE ─────────────────────────────────────
  const [totalVisitors, setTotalVisitors] = useState(0);
  const [activeAdminCount, setActiveAdminCount] = useState(0);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      es = new EventSource('/api/picker/stream?t=picker');
      es.onopen = () => {};
      es.onmessage = (e) => {
        if (closed) return;
        try {
          const data = JSON.parse(e.data);
          if (data.visitorCount !== undefined) setTotalVisitors(data.visitorCount);
          if (data.activeAdminCount !== undefined) setActiveAdminCount(data.activeAdminCount);
        } catch { /* ignore malformed */ }
      };
      es.onerror = () => {
        if (closed) return;
        es?.close();
        es = null;
        setTimeout(() => { if (!closed) connect(); }, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      es?.close();
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const canManage = useCallback((t: { ownerAdminId?: string; collaborators?: string[] }): boolean => {
    if (!adminInfo) return false;
    if (adminInfo.isSuperAdmin) return true;
    if (t.ownerAdminId === adminInfo.adminId) return true;
    if (t.collaborators?.includes(adminInfo.adminId)) return true;
    return false;
  }, [adminInfo]);

  const authHeaders = useCallback(
    (extra?: Record<string, string>) => ({
      'Content-Type': 'application/json',
      ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
      ...extra,
    }),
    [adminToken],
  );

  // ── Admin unlock ─────────────────────────────────────────────────────────
  const handleUnlock = async () => {
    setPwErr('');
    if (!adminNameInput.trim()) { setPwErr('Enter your admin name.'); return; }
    if (!pw.trim())             { setPwErr('Enter a password.'); return; }
    setUnlocking(true);
    try {
      const result = await login(adminNameInput, pw);
      if (result.error) { setPwErr(result.error); return; }
      setAdminNameInput(''); setPw('');
      setShowUnlock(false);
    } catch {
      setPwErr('Network error. Try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleLogout = () => {
    logout();
    setShowCreate(false);
  };

  // ── Create tournament ─────────────────────────────────────────────────────
  const handleCreate = async (values: TournamentFormValues) => {
    setCreateErr('');
    const safeId   = (values.id ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const safeName = values.name.trim();
    if (!safeId)   { setCreateErr('ID is required.'); return; }
    if (!safeName) { setCreateErr('Name is required.'); return; }
    setCreating(true);
    try {
      let posterUrl: string | undefined;
      if (values.posterFile) {
        posterUrl = (await uploadPoster(values.posterFile)) ?? undefined;
      }
      const res  = await fetch('/api/tournaments', {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({
          id:             safeId,
          name:           safeName,
          posterUrl,
          organizer:      values.organizer.trim() || undefined,
          tournamentDate: values.tournamentDate ? new Date(values.tournamentDate).getTime() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) { expireSession(); setCreateErr('Session expired. Please unlock again.'); }
        else setCreateErr(data.error ?? 'Failed to create tournament.');
        return;
      }
      setTournaments(data.tournaments ?? []);
      setShowCreate(false);
      onSelect(data.id, adminToken ?? undefined, adminInfo ?? undefined);
    } catch {
      setCreateErr('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // ── Edit tournament ───────────────────────────────────────────────────────
  const handleSaveEdit = async (values: TournamentFormValues) => {
    if (!editingTournamentId) return;
    setEditErr('');
    const safeName = values.name.trim();
    if (!safeName) { setEditErr('Name is required.'); return; }
    setEditSaving(true);
    const existing = tournaments.find(t => t.id === editingTournamentId);
    try {
      let posterUrl: string | undefined = existing?.posterUrl;
      if (values.posterFile) {
        posterUrl = (await uploadPoster(values.posterFile)) ?? posterUrl;
      }
      const res  = await fetch(`/api/tournaments?t=${editingTournamentId}`, {
        method:  'PATCH',
        headers: authHeaders(),
        body:    JSON.stringify({
          name:           safeName,
          organizer:      values.organizer.trim() || undefined,
          tournamentDate: values.tournamentDate ? new Date(values.tournamentDate).getTime() : undefined,
          posterUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditErr(data.error ?? 'Failed to update tournament.'); return; }
      setTournaments(data.tournaments ?? []);
      setEditingTournamentId(null);
    } catch {
      setEditErr('Network error. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Poster quick-update ───────────────────────────────────────────────────
  const handleSavePoster = async (id: string, file: File) => {
    setEditingPosterId(id);
    setPosterSaving(true);
    try {
      const url = await uploadPoster(file);
      if (!url) return;
      const res  = await fetch(`/api/tournaments?t=${id}`, {
        method:  'PATCH',
        headers: authHeaders(),
        body:    JSON.stringify({ posterUrl: url }),
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
      const res  = await fetch(`/api/tournaments?t=${id}`, {
        method:  'DELETE',
        headers: adminToken ? { 'X-Admin-Token': adminToken } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) { expireSession(); setDeleteErr('Session expired. Please unlock again.'); }
        else setDeleteErr(data.error ?? 'Failed to delete tournament.');
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

  // ── Edit form initial values ──────────────────────────────────────────────
  const editingTournament = tournaments.find(t => t.id === editingTournamentId) ?? null;
  const editInitial: TournamentFormValues | null = editingTournament
    ? {
        name:           editingTournament.name,
        organizer:      editingTournament.organizer ?? '',
        tournamentDate: editingTournament.tournamentDate
          ? new Date(editingTournament.tournamentDate - new Date().getTimezoneOffset() * 60000)
              .toISOString().slice(0, 16)
          : '',
        posterFile:    null,
        posterPreview: editingTournament.posterUrl ?? '',
      }
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`${dark ? 'dark' : ''} min-h-screen w-screen t-bg overflow-auto relative flex flex-col`}>
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 20% 10%, var(--grad-start) 0%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 80% 90%, var(--grad-end) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-12 flex-1">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 font-['Bebas_Neue'] text-6xl tracking-widest bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent)] bg-clip-text text-transparent mb-2">
            <img src="/launcher-icon.png" alt="" className="w-14 h-14 object-contain" />
            TOURNEY
          </div>
          <p className="font-['DM_Mono'] text-xs t-muted tracking-widest uppercase">Select a tournament to continue</p>
          {/* Overall visitor / admin count */}
          <div className="mt-3 inline-flex items-center gap-2 font-['DM_Mono'] text-[10px] t-muted border t-border-mid rounded px-3 py-1.5">
            <span>👁 {totalVisitors} visitor{totalVisitors !== 1 ? 's' : ''}</span>
            <span className="opacity-30">|</span>
            <span>🛡 {activeAdminCount} admin{activeAdminCount !== 1 ? 's' : ''}</span>
          </div>
          {/* Dark / light toggle */}
          <div className="mt-3 flex items-center justify-center">
            <button
              onClick={toggleDark}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border t-border-mid t-muted t-elevated font-['DM_Mono'] text-xs transition-all hover:border-[var(--border)] hover:t-text cursor-pointer"
            >
              {dark ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>

        {/* Admin toolbar */}
        <AdminToolbar
          isAdmin={isAdmin}
          adminInfo={adminInfo}
          onLogin={() => setShowUnlock(true)}
          onLogout={handleLogout}
          onNewTournament={() => { setShowCreate(true); setCreateErr(''); }}
          onManageAdmins={() => setSuperAdminOpen(true)}
          onChangePw={changePassword}
          tickerText={tickerText}
          onSaveTicker={saveTickerText}
        />

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="font-['DM_Mono'] text-xs t-muted animate-pulse">Loading tournaments…</div>
          </div>
        )}

        {/* Admin unlock */}
        {!loading && showUnlock && (
          <AdminUnlockPanel
            adminNameInput={adminNameInput}
            pw={pw}
            pwErr={pwErr}
            unlocking={unlocking}
            onNameChange={setAdminNameInput}
            onPwChange={setPw}
            onUnlock={handleUnlock}
            onCancel={() => { setShowUnlock(false); setAdminNameInput(''); setPw(''); setPwErr(''); }}
          />
        )}

        {/* Create form */}
        {!loading && showCreate && (
          <div className="max-w-sm mx-auto t-surface border t-border rounded-2xl p-6 shadow-xl">
            <h3 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text mb-4">+ NEW TOURNAMENT</h3>
            <TournamentFormModal
              mode="create"
              initial={{ name: '', id: '', organizer: '', tournamentDate: '', posterFile: null, posterPreview: '' }}
              saving={creating}
              error={createErr}
              onSubmit={handleCreate}
              onCancel={() => { setShowCreate(false); setCreateErr(''); }}
            />
          </div>
        )}

        {/* Card grid */}
        {!loading && !showUnlock && !showCreate && (
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
                  <TournamentCard
                    key={t.id}
                    t={t}
                    isAdmin={isAdmin}
                    canManage={canManage(t)}
                    editingPosterId={editingPosterId}
                    posterSaving={posterSaving}
                    onSelect={() => onSelect(t.id, adminToken ?? undefined, adminInfo ?? undefined)}
                    onEdit={e => {
                      e.stopPropagation();
                      setEditingTournamentId(t.id);
                      setEditErr('');
                    }}
                    onDeleteClick={() => { setConfirmDeleteId(t.id); setDeleteErr(''); }}
                    onPosterChange={file => handleSavePoster(t.id, file)}
                    onPosterClick={url => setLightboxUrl(url)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom ticker */}
      <div className="relative z-10 w-full sticky bottom-0">
        <BottomTicker text={tickerText} />
      </div>

      {/* Edit modal */}
      {editingTournament && editInitial && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget && !editSaving) setEditingTournamentId(null); }}
        >
          <div className="t-surface border t-border rounded-2xl p-6 w-[420px] max-w-[95vw] shadow-2xl">
            <h3 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text mb-4">✏️ EDIT TOURNAMENT</h3>
            <TournamentFormModal
              mode="edit"
              initial={editInitial}
              saving={editSaving}
              error={editErr}
              onSubmit={handleSaveEdit}
              onCancel={() => setEditingTournamentId(null)}
            />
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <PosterLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      {/* Delete confirm */}
      {confirmDeleteId && (
        <DeleteConfirmModal
          tournamentName={tournaments.find(t => t.id === confirmDeleteId)?.name ?? ''}
          tournamentId={confirmDeleteId}
          deleting={deleting}
          error={deleteErr}
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => { setConfirmDeleteId(null); setDeleteErr(''); }}
        />
      )}

      {/* Super Admin panel */}
      <SuperAdminPanel
        open={superAdminOpen}
        onClose={() => setSuperAdminOpen(false)}
        adminToken={adminToken}
        adminId={adminInfo?.adminId ?? null}
        adminName={adminInfo?.name ?? null}
        isSuperAdmin={adminInfo?.isSuperAdmin ?? false}
        onTournamentsChanged={refresh}
        onSessionExpired={() => { expireSession(); setSuperAdminOpen(false); }}
      />
    </div>
  );
}
