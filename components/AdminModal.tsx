'use client';

import { useState } from 'react';
import { useTourney } from '@/lib/context';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminModal({ open, onClose }: Props) {
  const { isAdmin, setIsAdmin } = useTourney();
  const [pw, setPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [err, setErr] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    setLoading(false);
    if (res.ok) {
      setIsAdmin(true);
      setPw('');
      setErr('');
      onClose();
    } else {
      setErr('Wrong password.');
    }
  };

  const changePw = async () => {
    if (!isAdmin) { setPwErr('Unlock first.'); return; }
    if (!newPw.trim()) { setPwErr('Enter a password.'); return; }
    const res = await fetch('/api/admin/auth', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pw || '__bypass__already_admin__', newPassword: newPw }),
    });
    // For already-authed admin we send a special flow
    // Actually re-verify with stored session — simplified: require re-entering current pw
    if (!res.ok) { setPwErr('Failed — re-enter current password above first.'); return; }
    setNewPw('');
    setPwErr('');
    alert('Password updated!');
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
            className="flex-1 py-2.5 rounded-xl bg-[#161625] border border-[#32324a] text-[#dde0f0] font-bold text-sm hover:border-[#4d7cff] hover:text-[#4d7cff] transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl bg-[#ffb020] text-[#1a0f00] font-bold text-sm hover:bg-[#ffa000] transition-colors disabled:opacity-40"
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
              className="px-3 py-2 rounded-xl bg-[#161625] border border-[#32324a] text-[#dde0f0] font-bold text-xs hover:border-[#4d7cff] hover:text-[#4d7cff] transition-colors"
              onClick={changePw}
            >
              Set
            </button>
          </div>
          {pwErr && <p className="text-[#ff3d5a] font-['DM_Mono'] text-xs mt-2">{pwErr}</p>}
        </div>
      </div>
    </div>
  );
}
