'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';
import { useAdminSession } from '@/hooks/useAdminSession';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminModal({ open, onClose }: Props) {
  const { setIsAdmin, setAdminToken, setAdminInfo, tournamentId } = useTourney();
  const { login } = useAdminSession();
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setErr('');
    try {
      const result = await login(name, pw);
      if (result.error) {
        // Distinguish session-expiry / auth failures from generic errors.
        const is403 = result.status === 403 || result.error?.toLowerCase().includes('expired') || result.error?.toLowerCase().includes('session');
        setErr(is403 ? '⚠️ Session expired — please log in again.' : result.error);
        return;
      }

      const { token, info } = result;

      // ── Access check ─────────────────────────────────────────────────────────
      // Super admins always have access. For regular admins, verify they are the
      // owner or a collaborator of this specific tournament before granting
      // isAdmin: true. This prevents any-admin-can-edit-any-tournament.
      if (info && !info.isSuperAdmin) {
        const tRes = await fetch('/api/tournaments');
        const tData = await tRes.json();
        const tournament = (tData.tournaments ?? []).find(
          (t: { id: string; ownerAdminId?: string; collaborators?: string[] }) => t.id === tournamentId
        );
        const hasAccess =
          tournament &&
          (tournament.ownerAdminId === info.adminId ||
           (tournament.collaborators ?? []).includes(info.adminId));
        if (!hasAccess) {
          setErr('You do not have access to manage this tournament.');
          return;
        }
      }

      setAdminToken(token ?? null);
      setAdminInfo(info ?? null);
      setIsAdmin(true);
      setName(''); setPw('');
      onClose();
    } catch {
      setErr('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="t-surface border t-border rounded-2xl p-7 w-[360px] max-w-[95vw] animate-scale-in shadow-xl">
        <h2 className="font-['Bebas_Neue'] text-3xl tracking-widest mb-1 t-text">🔐 ADMIN</h2>
        <p className="t-muted text-sm mb-5">Enter your admin name and password to unlock edit mode.</p>

        <input
          type="text"
          className="w-full t-elevated border t-border-mid rounded-xl px-4 py-3 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors mb-2"
          placeholder="Admin name…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && pw && submit()}
          autoComplete="username"
        />
        <input
          type="password"
          className="w-full t-elevated border t-border-mid rounded-xl px-4 py-3 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
          placeholder="Password…"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && submit()}
          autoComplete="current-password"
        />
        {err && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-red)' }}>{err}</p>}

        <div className="flex gap-3 mt-4">
          <button
            className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-bold text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-40 cursor-pointer"
            style={{ background: 'var(--accent-gold)', color: '#1a0f00' }}
            onClick={submit}
            disabled={loading || !name.trim() || !pw}
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}
