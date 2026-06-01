'use client';

interface Props {
  tournamentName: string;
  tournamentId: string;
  deleting: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ tournamentName, tournamentId, deleting, error, onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget && !deleting) onCancel(); }}
    >
      <div className="t-surface border border-red-500/40 rounded-2xl p-7 w-[360px] max-w-[95vw] shadow-2xl">
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="font-['Bebas_Neue'] text-2xl tracking-widest text-red-400 mb-1">DELETE TOURNAMENT</h3>
        <p className="font-['DM_Mono'] text-xs t-muted mb-1">You are about to permanently delete:</p>
        <p className="font-['DM_Mono'] text-sm t-text font-bold mb-1">
          {tournamentName || tournamentId}
        </p>
        <p className="font-['DM_Mono'] text-[10px] text-red-400/80 mb-5">
          This will delete all tournament data including teams, players, brackets, chat, and maps. This action cannot be undone.
        </p>
        {error && (
          <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)] mb-3">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer disabled:opacity-40"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl font-['DM_Mono'] text-sm font-bold text-white transition-all cursor-pointer hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--accent-red)' }}
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : '🗑 Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
