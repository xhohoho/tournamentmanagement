'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminModal({ open, onClose }: Props) {
  const { setIsAdmin, setAdminToken, setAdminInfo, adminToken, adminId, adminName } = useTourney();
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [err, setErr] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwOk, setPwOk] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setErr('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), password: pw }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setAdminToken(data.token ?? null);
      setAdminInfo({ adminId: data.adminId, name: data.name, isSuperAdmin: data.isSuperAdmin });
      setIsAdmin(true);
      setName(''); setPw('');
      onClose();
    } else {
      const data = await res.json();
      setErr(data.error ?? 'Wrong name or password.');
    }
  };

  const changePw = async () => {
    setPwErr('');
    setPwOk('');
    if (!adminToken || !adminId) { setPwErr('Unlock admin first.'); return; }
    if (!newPw.trim()) { setPwErr('Enter a new password.'); return; }
    const res = await fetch('/api/admin/auth', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
      body: JSON.stringify({ action: 'changePassword', adminId, newPassword: newPw }),
    });
    if (!res.ok) { setPwErr('Failed to update password.'); return; }
    setNewPw('');
    setPwOk('Password updated!');
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

        {adminToken && adminId && (
          <div className="mt-5 border-t t-border pt-4">
            <p className="font-['DM_Mono'] text-[10px] t-dim mb-2 tracking-widest">CHANGE YOUR PASSWORD</p>
            {adminName && <p className="font-['DM_Mono'] text-xs t-muted mb-2">Logged in as: <span className="t-text">{adminName}</span></p>}
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 t-elevated border t-border-mid rounded-xl px-3 py-2 t-text font-['DM_Mono'] text-xs outline-none focus:border-[var(--accent)] transition-colors"
                placeholder="New password…"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
              />
              <button
                className="px-3 py-2 rounded-xl t-elevated border t-border-mid t-text font-bold text-xs hover:border-[var(--accent)] hover:t-accent transition-colors cursor-pointer"
                onClick={changePw}
              >
                Set
              </button>
            </div>
            {pwErr && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-red)' }}>{pwErr}</p>}
            {pwOk && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-green)' }}>{pwOk}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
