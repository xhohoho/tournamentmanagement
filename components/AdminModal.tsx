'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminModal({ open, onClose }: Props) {
  const { setIsAdmin, setAdminToken } = useTourney();
  const [pw, setPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [err, setErr] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwOk, setPwOk] = useState('');
  const [loading, setLoading] = useState(false);
  // Store token locally so we can send it with the change-password request
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setErr('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      const token = data.token ?? null;
      setSessionToken(token);
      setAdminToken(token);  // persist token in context so adminHeaders include it
      setIsAdmin(true);
      setPw('');
      onClose();
    } else {
      setErr('Wrong password.');
    }
  };

  const changePw = async () => {
    setPwErr('');
    setPwOk('');
    if (!sessionToken) { setPwErr('Unlock admin first.'); return; }
    if (!newPw.trim()) { setPwErr('Enter a new password.'); return; }
    const res = await fetch('/api/admin/auth', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': sessionToken },
      body: JSON.stringify({ newPassword: newPw }),
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
      <div className="bg-[#0f0f1a] border border-[#32324a] rounded-2xl p-7 w-[360px] max-w-[95vw] animate-scale-in">
        <h2 className="font-['Bebas_Neue'] text-3xl tracking-widest mb-1">🔐 ADMIN</h2>
        <p className="text-[#7878a0] text-sm mb-5">Enter password to unlock edit mode.</p>

        <input
          type="password"
          className="w-full bg-[#161625] border border-[#32324a] rounded-xl px-4 py-3 text-[#dde0f0] font-['DM_Mono'] text-sm outline-none focus:border-[#4d7cff] transition-colors"
          placeholder="Password…"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        {err && <p className="text-[#ff3d5a] font-['DM_Mono'] text-xs mt-2">{err}</p>}

        <div className="flex gap-3 mt-4">
          <button
            className="flex-1 py-2.5 rounded-xl bg-[#161625] border border-[#32324a] text-[#dde0f0] font-bold text-sm hover:border-[#4d7cff] hover:text-[#4d7cff] transition-colors cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl bg-[#ffb020] text-[#1a0f00] font-bold text-sm hover:bg-[#ffa000] transition-colors disabled:opacity-40 cursor-pointer"
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'Checking…' : 'Unlock'}
          </button>
        </div>

        <div className="mt-5 border-t border-[#252538] pt-4">
          <p className="font-['DM_Mono'] text-[10px] text-[#4a4a6a] mb-2 tracking-widest">CHANGE PASSWORD (must be unlocked)</p>
          <div className="flex gap-2">
            <input
              type="password"
              className="flex-1 bg-[#161625] border border-[#32324a] rounded-xl px-3 py-2 text-[#dde0f0] font-['DM_Mono'] text-xs outline-none focus:border-[#4d7cff] transition-colors"
              placeholder="New password…"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
            />
            <button
              className="px-3 py-2 rounded-xl bg-[#161625] border border-[#32324a] text-[#dde0f0] font-bold text-xs hover:border-[#4d7cff] hover:text-[#4d7cff] transition-colors cursor-pointer"
              onClick={changePw}
            >
              Set
            </button>
          </div>
          {pwErr && <p className="text-[#ff3d5a] font-['DM_Mono'] text-xs mt-2">{pwErr}</p>}
          {pwOk && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-green)' }}>{pwOk}</p>}
        </div>
      </div>
    </div>
  );
}
