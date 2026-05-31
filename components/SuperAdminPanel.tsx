'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTourney } from '@/lib/context';

interface AdminAccount {
  adminId: string;
  name: string;
  isSuperAdmin?: boolean;
  createdAt: number;
}

interface TournamentMeta {
  id: string;
  name: string;
  ownerAdminId: string;
  collaborators: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SuperAdminPanel({ open, onClose }: Props) {
  const { adminToken, adminId: myId, adminName: myName, isSuperAdmin } = useTourney();

  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [tournaments, setTournaments] = useState<TournamentMeta[]>([]);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'accounts' | 'access'>('accounts');

  // Create form
  const [newName, setNewName] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newIsSuperAdmin, setNewIsSuperAdmin] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [creating, setCreating] = useState(false);

  // Per-account password change
  const [changingPwId, setChangingPwId] = useState<string | null>(null);
  const [changePwVal, setChangePwVal] = useState('');
  const [changePwErr, setChangePwErr] = useState('');
  const [changePwOk, setChangePwOk] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  // Access management
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessErr, setAccessErr] = useState('');
  const [accessOk, setAccessOk] = useState('');

  const fetchAccounts = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    setLoadErr('');
    try {
      const [accRes, tourRes] = await Promise.all([
        fetch('/api/admin/auth', { headers: { 'X-Admin-Token': adminToken } }),
        fetch('/api/tournaments'),
      ]);
      const accData = await accRes.json();
      const tourData = await tourRes.json();
      if (!accRes.ok) { setLoadErr(accData.error ?? 'Failed to load accounts.'); return; }
      setAccounts(accData.accounts ?? []);
      setTournaments(tourData.tournaments ?? []);
    } catch {
      setLoadErr('Network error.');
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    if (open && isSuperAdmin) fetchAccounts();
  }, [open, isSuperAdmin, fetchAccounts]);

  if (!open) return null;
  if (!isSuperAdmin) return null;

  const handleCreate = async () => {
    setCreateErr('');
    if (!newName.trim()) { setCreateErr('Name is required.'); return; }
    if (!newPw.trim()) { setCreateErr('Password is required.'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken! },
        body: JSON.stringify({ action: 'create', name: newName.trim(), password: newPw.trim(), isSuperAdmin: newIsSuperAdmin }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateErr(data.error ?? 'Failed to create account.'); return; }
      setAccounts(data.accounts ?? []);
      setNewName(''); setNewPw(''); setNewIsSuperAdmin(false);
    } catch {
      setCreateErr('Network error.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (targetId: string) => {
    setDeleting(true);
    setDeleteErr('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken! },
        body: JSON.stringify({ action: 'delete', adminId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) { setDeleteErr(data.error ?? 'Failed to delete.'); return; }
      setAccounts(data.accounts ?? []);
      setConfirmDeleteId(null);
    } catch {
      setDeleteErr('Network error.');
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePw = async (targetId: string) => {
    setChangePwErr(''); setChangePwOk('');
    if (!changePwVal.trim()) { setChangePwErr('Enter a new password.'); return; }
    setSavingPw(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken! },
        body: JSON.stringify({ action: 'changePassword', adminId: targetId, newPassword: changePwVal.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setChangePwErr(data.error ?? 'Failed to change password.'); return; }
      setChangePwOk('Password updated!');
      setChangePwVal('');
      setTimeout(() => { setChangingPwId(null); setChangePwOk(''); }, 1500);
    } catch {
      setChangePwErr('Network error.');
    } finally {
      setSavingPw(false);
    }
  };

  // ── Access management ─────────────────────────────────────────────────────
  const selectedTournament = tournaments.find(t => t.id === selectedTournamentId);

  const toggleCollaborator = async (adminId: string) => {
    if (!selectedTournament) return;
    const current = selectedTournament.collaborators ?? [];
    const isOwner = selectedTournament.ownerAdminId === adminId;
    if (isOwner) return; // can't toggle owner

    const next = current.includes(adminId)
      ? current.filter(id => id !== adminId)
      : [...current, adminId];

    setSavingAccess(true);
    setAccessErr('');
    setAccessOk('');
    try {
      const res = await fetch(`/api/tournaments?t=${selectedTournament.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken! },
        body: JSON.stringify({ collaborators: next }),
      });
      const data = await res.json();
      if (!res.ok) { setAccessErr(data.error ?? 'Failed to update access.'); return; }
      setTournaments(data.tournaments ?? []);
      setAccessOk('Access updated!');
      setTimeout(() => setAccessOk(''), 1500);
    } catch {
      setAccessErr('Network error.');
    } finally {
      setSavingAccess(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="t-surface border t-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b t-border shrink-0">
          <div>
            <h2 className="font-['Bebas_Neue'] text-3xl tracking-widest t-text">⚙ ADMIN ACCOUNTS</h2>
            <p className="font-['DM_Mono'] text-[10px] t-muted tracking-widest mt-0.5">
              Logged in as <span style={{ color: 'var(--accent-gold)' }}>{myName}</span> · Super Admin
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full t-elevated border t-border-mid t-muted hover:t-text transition-colors cursor-pointer font-bold text-sm"
          >✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b t-border shrink-0">
          {([['accounts', '👤 Accounts'], ['access', '🔑 Tournament Access']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 font-['DM_Mono'] text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'border-b-2 border-[var(--accent-gold)] text-[var(--accent-gold)]'
                  : 't-muted hover:t-text'
              }`}
            >{label}</button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">
          {loading && <p className="font-['DM_Mono'] text-xs t-muted animate-pulse">Loading…</p>}
          {loadErr && <p className="font-['DM_Mono'] text-xs" style={{ color: 'var(--accent-red)' }}>{loadErr}</p>}

          {/* ── ACCOUNTS TAB ── */}
          {activeTab === 'accounts' && (
            <>
              <div>
                <p className="font-['DM_Mono'] text-[10px] t-dim tracking-widest uppercase mb-3">Current Accounts</p>
                {!loading && accounts.length === 0 && !loadErr && (
                  <p className="font-['DM_Mono'] text-xs t-muted">No accounts found.</p>
                )}
                <div className="space-y-2">
                  {accounts.map(acc => (
                    <div key={acc.adminId} className="t-elevated border t-border-mid rounded-xl p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-['DM_Mono'] text-sm t-text font-bold truncate">{acc.name}</span>
                          {acc.isSuperAdmin && (
                            <span
                              className="shrink-0 text-[9px] font-['DM_Mono'] font-bold px-1.5 py-0.5 rounded tracking-widest uppercase"
                              style={{ background: 'rgba(255,176,32,0.15)', color: 'var(--accent-gold)', border: '1px solid rgba(255,176,32,0.3)' }}
                            >Super</span>
                          )}
                          {acc.adminId === myId && (
                            <span className="shrink-0 text-[9px] font-['DM_Mono'] px-1.5 py-0.5 rounded t-dim border t-border-mid tracking-widest uppercase">You</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              if (changingPwId === acc.adminId) { setChangingPwId(null); setChangePwVal(''); setChangePwErr(''); setChangePwOk(''); }
                              else { setChangingPwId(acc.adminId); setChangePwVal(''); setChangePwErr(''); setChangePwOk(''); setConfirmDeleteId(null); }
                            }}
                            className="px-2 py-1 rounded-lg t-surface border t-border-mid font-['DM_Mono'] text-[10px] t-muted hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
                          >
                            🔑 Password
                          </button>
                          {acc.adminId !== myId && (
                            <button
                              onClick={() => { setConfirmDeleteId(acc.adminId); setDeleteErr(''); setChangingPwId(null); }}
                              className="px-2 py-1 rounded-lg t-surface border t-border-mid font-['DM_Mono'] text-[10px] t-muted hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] transition-colors cursor-pointer"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="font-['DM_Mono'] text-[9px] t-dim mt-1">
                        Created {new Date(acc.createdAt).toLocaleDateString()} · ID: {acc.adminId}
                      </p>

                      {/* Inline password change */}
                      {changingPwId === acc.adminId && (
                        <div className="mt-3 pt-3 border-t t-border">
                          <div className="flex gap-2">
                            <input
                              type="password"
                              className="flex-1 t-surface border t-border-mid rounded-lg px-3 py-2 t-text font-['DM_Mono'] text-xs outline-none focus:border-[var(--accent)] transition-colors"
                              placeholder="New password…"
                              value={changePwVal}
                              onChange={e => { setChangePwVal(e.target.value); setChangePwErr(''); setChangePwOk(''); }}
                              onKeyDown={e => e.key === 'Enter' && handleChangePw(acc.adminId)}
                              autoFocus
                            />
                            <button
                              onClick={() => handleChangePw(acc.adminId)}
                              disabled={savingPw || !changePwVal.trim()}
                              className="px-3 py-2 rounded-lg font-['DM_Mono'] text-[10px] font-bold text-white disabled:opacity-40 cursor-pointer transition-opacity hover:opacity-90"
                              style={{ background: 'var(--accent)' }}
                            >
                              {savingPw ? '…' : 'Save'}
                            </button>
                          </div>
                          {changePwErr && <p className="font-['DM_Mono'] text-[10px] mt-1.5" style={{ color: 'var(--accent-red)' }}>{changePwErr}</p>}
                          {changePwOk && <p className="font-['DM_Mono'] text-[10px] mt-1.5" style={{ color: 'var(--accent-green)' }}>{changePwOk}</p>}
                        </div>
                      )}

                      {/* Inline delete confirm */}
                      {confirmDeleteId === acc.adminId && (
                        <div className="mt-3 pt-3 border-t border-red-500/20">
                          <p className="font-['DM_Mono'] text-[10px] text-red-400 mb-2">Delete <strong>{acc.name}</strong>? This cannot be undone.</p>
                          {deleteErr && <p className="font-['DM_Mono'] text-[10px] text-red-400 mb-2">{deleteErr}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="flex-1 py-1.5 rounded-lg t-surface border t-border-mid font-['DM_Mono'] text-[10px] t-muted hover:t-text transition-colors cursor-pointer"
                              disabled={deleting}
                            >Cancel</button>
                            <button
                              onClick={() => handleDelete(acc.adminId)}
                              disabled={deleting}
                              className="flex-1 py-1.5 rounded-lg font-['DM_Mono'] text-[10px] font-bold text-white disabled:opacity-40 cursor-pointer hover:opacity-90"
                              style={{ background: 'var(--accent-red)' }}
                            >{deleting ? 'Deleting…' : 'Confirm Delete'}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Create new account */}
              <div className="border-t t-border pt-5">
                <p className="font-['DM_Mono'] text-[10px] t-dim tracking-widest uppercase mb-3">Create New Admin</p>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                    placeholder="Name (e.g. Alice)…"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && newPw && handleCreate()}
                  />
                  <input
                    type="password"
                    className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
                    placeholder="Password…"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && newName.trim() && handleCreate()}
                  />
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <div
                      onClick={() => setNewIsSuperAdmin(v => !v)}
                      className={`w-9 h-5 rounded-full border transition-all cursor-pointer relative ${
                        newIsSuperAdmin
                          ? 'border-[var(--accent-gold)] bg-[rgba(255,176,32,0.2)]'
                          : 'border-[var(--border-mid)] t-elevated'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                        newIsSuperAdmin
                          ? 'left-4 bg-[var(--accent-gold)]'
                          : 'left-0.5 bg-[var(--text-dim)]'
                      }`} />
                    </div>
                    <span className="font-['DM_Mono'] text-xs t-muted group-hover:t-text transition-colors">
                      Super Admin <span className="t-dim">(can manage other admins)</span>
                    </span>
                  </label>
                  {createErr && <p className="font-['DM_Mono'] text-xs" style={{ color: 'var(--accent-red)' }}>{createErr}</p>}
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim() || !newPw.trim()}
                    className="w-full py-2.5 rounded-xl font-['DM_Mono'] text-sm font-bold text-white disabled:opacity-40 transition-opacity hover:opacity-90 cursor-pointer"
                    style={{ background: 'var(--accent)' }}
                  >
                    {creating ? 'Creating…' : '+ Create Admin'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── ACCESS TAB ── */}
          {activeTab === 'access' && (
            <div className="space-y-4">
              <div>
                <p className="font-['DM_Mono'] text-[10px] t-dim tracking-widest uppercase mb-3">Select Tournament</p>
                {tournaments.length === 0 && !loading && (
                  <p className="font-['DM_Mono'] text-xs t-muted">No tournaments found.</p>
                )}
                <div className="space-y-1.5">
                  {tournaments.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTournamentId(t.id); setAccessErr(''); setAccessOk(''); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border font-['DM_Mono'] text-xs transition-colors cursor-pointer ${
                        selectedTournamentId === t.id
                          ? 'border-[var(--accent-gold)] bg-[rgba(255,176,32,0.07)] text-[var(--accent-gold)]'
                          : 't-elevated t-border-mid t-muted hover:t-text hover:border-[var(--border)]'
                      }`}
                    >
                      <span className="font-bold">{t.name}</span>
                      <span className="t-dim ml-2">/{t.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedTournament && (
                <div className="border-t t-border pt-4">
                  <p className="font-['DM_Mono'] text-[10px] t-dim tracking-widest uppercase mb-3">
                    Admin Access — <span style={{ color: 'var(--accent-gold)' }}>{selectedTournament.name}</span>
                  </p>
                  <p className="font-['DM_Mono'] text-[10px] t-dim mb-3">Toggle which admins can manage this tournament. Owner always has access.</p>
                  <div className="space-y-2">
                    {accounts.filter(a => !a.isSuperAdmin).map(acc => {
                      const isOwner = selectedTournament.ownerAdminId === acc.adminId;
                      const isCollaborator = selectedTournament.collaborators?.includes(acc.adminId);
                      const hasAccess = isOwner || isCollaborator;
                      return (
                        <div
                          key={acc.adminId}
                          className="flex items-center justify-between t-elevated border t-border-mid rounded-xl px-3.5 py-2.5"
                        >
                          <div>
                            <span className="font-['DM_Mono'] text-sm t-text font-bold">{acc.name}</span>
                            {isOwner && (
                              <span className="ml-2 text-[9px] font-['DM_Mono'] px-1.5 py-0.5 rounded tracking-widest uppercase t-dim border t-border-mid">Owner</span>
                            )}
                          </div>
                          <div
                            onClick={() => !isOwner && !savingAccess && toggleCollaborator(acc.adminId)}
                            className={`w-10 h-5 rounded-full border transition-all relative ${
                              isOwner
                                ? 'opacity-40 cursor-not-allowed'
                                : 'cursor-pointer'
                            } ${
                              hasAccess
                                ? 'border-[var(--accent)] bg-[rgba(77,124,255,0.2)]'
                                : 'border-[var(--border-mid)] t-surface'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                              hasAccess
                                ? 'left-5 bg-[var(--accent)]'
                                : 'left-0.5 bg-[var(--text-dim)]'
                            }`} />
                          </div>
                        </div>
                      );
                    })}
                    {accounts.filter(a => !a.isSuperAdmin).length === 0 && (
                      <p className="font-['DM_Mono'] text-xs t-muted">No non-super admins to assign.</p>
                    )}
                  </div>
                  {accessErr && <p className="font-['DM_Mono'] text-xs mt-3" style={{ color: 'var(--accent-red)' }}>{accessErr}</p>}
                  {accessOk && <p className="font-['DM_Mono'] text-xs mt-3" style={{ color: 'var(--accent-green)' }}>{accessOk}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
