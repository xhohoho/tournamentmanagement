'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminModal({ open, onClose }: Props) {
  const { setIsAdmin, setAdminToken, setAdminInfo } = useTourney();
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
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
