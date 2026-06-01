'use client';

interface Props {
  adminNameInput: string;
  pw: string;
  pwErr: string;
  unlocking: boolean;
  onNameChange: (v: string) => void;
  onPwChange: (v: string) => void;
  onUnlock: () => void;
  onCancel: () => void;
}

export function AdminUnlockPanel({
  adminNameInput, pw, pwErr, unlocking,
  onNameChange, onPwChange, onUnlock, onCancel,
}: Props) {
  return (
    <div className="max-w-sm mx-auto t-surface border t-border rounded-2xl p-6 shadow-xl">
      <h3 className="font-['Bebas_Neue'] text-2xl tracking-widest t-text mb-1">🔐 ADMIN UNLOCK</h3>
      <p className="font-['DM_Mono'] text-xs t-muted mb-4">
        Enter your admin name and password to manage tournaments.
      </p>
      <input
        type="text"
        className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent-gold)] transition-colors mb-2"
        placeholder="Admin name…"
        value={adminNameInput}
        onChange={e => onNameChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && pw && onUnlock()}
        autoFocus
        autoComplete="username"
      />
      <input
        type="password"
        className="w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-['DM_Mono'] text-sm outline-none focus:border-[var(--accent-gold)] transition-colors mb-3"
        placeholder="Password…"
        value={pw}
        onChange={e => onPwChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && adminNameInput.trim() && onUnlock()}
        autoComplete="current-password"
      />
      {pwErr && (
        <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)] mb-3">{pwErr}</p>
      )}
      <div className="flex gap-3">
        <button
          className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          onClick={onCancel}
          disabled={unlocking}
        >
          Cancel
        </button>
        <button
          className="flex-1 py-2.5 rounded-xl font-['DM_Mono'] text-sm font-bold disabled:opacity-40 cursor-pointer"
          style={{ background: 'var(--accent-gold)', color: '#1a0f00' }}
          onClick={onUnlock}
          disabled={unlocking || !adminNameInput.trim() || !pw.trim()}
        >
          {unlocking ? 'Checking…' : 'Unlock'}
        </button>
      </div>
    </div>
  );
}
