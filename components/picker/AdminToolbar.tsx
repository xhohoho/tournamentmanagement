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
  // Ticker — only shown to super admins
  tickerText: string;
  onSaveTicker: (text: string) => Promise<{ error?: string }>;
}

export function AdminToolbar({
  isAdmin,
  adminInfo,
  onLogin,
  onLogout,
  onNewTournament,
  onManageAdmins,
  onChangePw,
  tickerText,
  onSaveTicker,
}: Props) {
  // Change password panel
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPwVal, setNewPwVal]         = useState('');
  const [pwErr, setPwErr]               = useState('');
  const [pwOk, setPwOk]                 = useState('');
  const [savingPw, setSavingPw]         = useState(false);

  // Ticker edit panel
  const [showTicker, setShowTicker]     = useState(false);
  const [tickerDraft, setTickerDraft]   = useState('');
  const [tickerErr, setTickerErr]       = useState('');
  const [tickerOk, setTickerOk]         = useState('');
  const [savingTicker, setSavingTicker] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChangePw = async () => {
    setPwErr(''); setPwOk('');
    setSavingPw(true);
    const result = await onChangePw(newPwVal);
    setSavingPw(false);
    if (result.error) { setPwErr(result.error); return; }
    setPwOk(result.ok ?? 'Password updated!');
    setNewPwVal('');
    setTimeout(() => { setShowChangePw(false); setPwOk(''); }, 1500);
  };

  const toggleChangePw = () => {
    setShowChangePw(v => !v);
    if (showTicker) setShowTicker(false);
    setPwErr(''); setPwOk(''); setNewPwVal('');
  };

  const openTicker = () => {
    setTickerDraft(tickerText);
    setTickerErr(''); setTickerOk('');
    setShowTicker(true);
    if (showChangePw) setShowChangePw(false);
  };

  const handleSaveTicker = async () => {
    setTickerErr(''); setTickerOk('');
    if (!tickerDraft.trim()) { setTickerErr('Ticker text cannot be empty.'); return; }
    setSavingTicker(true);
    const result = await onSaveTicker(tickerDraft);
    setSavingTicker(false);
    if (result.error) { setTickerErr(result.error); return; }
    setTickerOk('Saved!');
    setTimeout(() => { setShowTicker(false); setTickerOk(''); }, 1200);
  };

  return (
    <div className="mb-8">
      {/* ── Button row ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {/* Login / Logout */}
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
            {/* New Tournament */}
            <button
              onClick={onNewTournament}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed t-border-mid t-muted hover:border-[var(--accent)] hover:text-[var(--accent)] font-['DM_Mono'] text-xs tracking-widest uppercase transition-all cursor-pointer"
            >
              + New Tournament
            </button>

            {/* Super admin only buttons */}
            {adminInfo?.isSuperAdmin && (
              <>
                <button
                  onClick={onManageAdmins}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border font-['DM_Mono'] text-xs transition-all cursor-pointer"
                  style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', background: 'rgba(255,176,32,0.07)' }}
                >
                  ★ Manage Admins
                </button>

                <button
                  onClick={openTicker}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-['DM_Mono'] text-xs transition-all cursor-pointer ${
                    showTicker
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(77,124,255,0.08)]'
                      : 't-border-mid t-muted t-elevated hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
                >
                  📢 Ticker
                </button>
              </>
            )}

            {/* Change Password */}
            <button
              onClick={toggleChangePw}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border t-border-mid t-muted t-elevated hover:border-[var(--accent)] hover:text-[var(--accent)] font-['DM_Mono'] text-xs tracking-widest uppercase transition-all cursor-pointer"
            >
              🔑 Change Password
            </button>
          </>
        )}
      </div>

      {/* ── Ticker edit panel (super admin only) ───────────────────────── */}
      {isAdmin && adminInfo?.isSuperAdmin && showTicker && (
        <div className="max-w-lg mx-auto t-surface border t-border rounded-2xl p-5 shadow-xl mt-4">
          <h3 className="font-['Bebas_Neue'] text-lg tracking-widest t-text mb-1">📢 PICKER TICKER</h3>
          <p className="font-['DM_Mono'] text-[10px] t-muted mb-3">
            Edit the scrolling message shown at the bottom of the tournament picker page.
          </p>
          <textarea
            className="w-full t-elevated border t-border-mid rounded-xl px-4 py-3 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none"
            rows={2}
            placeholder="Enter ticker text…"
            value={tickerDraft}
            onChange={e => { setTickerDraft(e.target.value); setTickerErr(''); setTickerOk(''); }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveTicker(); }}
          />
          <p className="font-['DM_Mono'] text-[10px] t-dim mt-1 mb-3">Tip: Ctrl/Cmd+Enter to save quickly.</p>
          {tickerErr && <p className="font-['DM_Mono'] text-xs mb-2" style={{ color: 'var(--accent-red)' }}>{tickerErr}</p>}
          {tickerOk  && <p className="font-['DM_Mono'] text-xs mb-2" style={{ color: 'var(--accent-green)' }}>{tickerOk}</p>}
          <div className="flex gap-2">
            <button
              className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              onClick={() => { setShowTicker(false); setTickerErr(''); setTickerOk(''); }}
              disabled={savingTicker}
            >
              Cancel
            </button>
            <button
              className="flex-1 py-2.5 rounded-xl text-white font-['DM_Mono'] text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
              style={{ background: 'var(--accent)' }}
              onClick={handleSaveTicker}
              disabled={savingTicker || !tickerDraft.trim()}
            >
              {savingTicker ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Change password panel ───────────────────────────────────────── */}
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
              disabled={savingPw || !newPwVal.trim()}
              className="px-4 py-2.5 rounded-xl font-['DM_Mono'] text-sm font-bold text-white disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer"
              style={{ background: 'var(--accent)' }}
            >
              {savingPw ? '…' : 'Save'}
            </button>
          </div>
          {pwErr && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-red)' }}>{pwErr}</p>}
          {pwOk  && <p className="font-['DM_Mono'] text-xs mt-2" style={{ color: 'var(--accent-green)' }}>{pwOk}</p>}
        </div>
      )}
    </div>
  );
}
