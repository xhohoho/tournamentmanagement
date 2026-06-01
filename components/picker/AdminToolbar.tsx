'use client';

import { useState } from 'react';
import { AdminInfo } from '@/hooks/useAdminSession';

interface Props {
  isAdmin: boolean;
  adminInfo: AdminInfo | null;
  onLogin: () => void;
  onLogout: () => void;
  onNewTournament: () => void;
  onManageAdmins: () => void;
  onChangePw: (newPw: string) => Promise<{ error?: string; ok?: string }>;
}

export function AdminToolbar({
  isAdmin,
  adminInfo,
  onLogin,
  onLogout,
  onNewTournament,
  onManageAdmins,
  onChangePw,
}: Props) {
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPwVal, setNewPwVal]         = useState('');
  const [pwErr, setPwErr]               = useState('');
  const [pwOk, setPwOk]                 = useState('');
  const [saving, setSaving]             = useState(false);

  const handleChangePw = async () => {
    setPwErr(''); setPwOk('');
    setSaving(true);
    const result = await onChangePw(newPwVal);
    setSaving(false);
    if (result.error) { setPwErr(result.error); return; }
    setPwOk(result.ok ?? 'Password updated!');
    setNewPwVal('');
    setTimeout(() => { setShowChangePw(false); setPwOk(''); }, 1500);
  };

  const toggleChangePw = () => {
    setShowChangePw(v => !v);
    setPwErr(''); setPwOk(''); setNewPwVal('');
  };

  return (
    <div className="mb-8">
      {/* Button row */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={isAdmin ? onLogout : onLogin}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-['DM_Mono'] text-xs transition-all cursor-pointer ${
            isAdmin
              ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[rgba(255,176,32,0.08)] hover:bg-[rgba(255,176,32,0.15)]'
              : 't-border-mid t-muted t-elevated hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]'
          }`}
        >
          {isAdmin ? `🔓 ${adminInfo?.name ?? 'Admin'} (logout)` : '🔒 Admin Login'}
        </button>

        {isAdmin && (
          <>
            <button
              onClick={onNewTournament}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed t-border-mid t-muted hover:border-[var(--accent)] hover:text-[var(--accent)] font-['DM_Mono'] text-xs tracking-widest uppercase transition-all cursor-pointer"
            >
              + New Tournament
            </button>

            {adminInfo?.isSuperAdmin && (
              <button
                onClick={onManageAdmins}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border font-['DM_Mono'] text-xs transition-all cursor-pointer"
                style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', background: 'rgba(255,176,32,0.07)' }}
              >
                ★ Manage Admins
              </button>
            )}

            <button
              onClick={toggleChangePw}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border t-border-mid t-muted t-elevated hover:border-[var(--accent)] hover:text-[var(--accent)] font-['DM_Mono'] text-xs tracking-widest uppercase transition-all cursor-pointer"
            >
              🔑 Change Password
            </button>
          </>
        )}
      </div>

      {/* Inline change-password panel */}
      {isAdmin && showChangePw && (
        <div className="max-w-sm mx-auto t-surface border t-border rounded-2xl p-5 shadow-xl mt-4">
          <h3 className="font-['Bebas_Neue'] text-lg tracking-widest t-text mb-1">🔑 CHANGE PASSWORD</h3>
          <p className="font-['DM_Mono'] text-[10px] t-muted mb-3">
            Logged in as <span style={{ color: 'var(--accent-gold)' }}>{adminInfo?.name}</span>
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              className="flex-1 t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="New password…"
              value={newPwVal}
              onChange={e => { setNewPwVal(e.target.value); setPwErr(''); setPwOk(''); }}
              onKeyDown={e => e.key === 'Enter' && handleChangePw()}
              autoFocus
            />
            <button
              onClick={handleChangePw}
              disabled={saving || !newPwVal.trim()}
              className="px-4 py-2.5 rounded-xl font-['DM_Mono'] text-sm font-bold text-white disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? '…' : 'Save'}
            </button>
          </div>
          {pwErr && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-red)' }}>{pwErr}</p>}
          {pwOk  && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-green)' }}>{pwOk}</p>}
        </div>
      )}
    </div>
  );
}
