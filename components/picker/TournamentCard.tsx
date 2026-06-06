'use client';

import { TournamentMeta } from '@/hooks/useTournaments';

interface Props {
  t: TournamentMeta;
  isAdmin: boolean;
  canManage: boolean;
  editingPosterId: string | null;
  posterSaving: boolean;
  visitorCount?: number;
  activeAdminCount?: number;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDeleteClick: () => void;
  onPosterChange: (file: File) => void;
  onPosterClick: (url: string) => void;
}

export function TournamentCard({
  t,
  isAdmin,
  canManage,
  editingPosterId,
  posterSaving,
  visitorCount = 0,
  activeAdminCount = 0,
  onSelect,
  onEdit,
  onDeleteClick,
  onPosterChange,
  onPosterClick,
}: Props) {
  return (
    <div
      className={`group relative flex flex-col rounded-2xl border t-surface overflow-hidden shadow-lg transition-all ${
        isAdmin && !canManage
          ? 'opacity-50 cursor-not-allowed border-[var(--border-mid)]'
          : 'cursor-pointer t-border-mid hover:border-[var(--accent)] hover:shadow-[0_0_24px_rgba(77,124,255,0.12)]'
      }`}
      onClick={() => { if (isAdmin && !canManage) return; onSelect(); }}
    >
      {/* Lock overlay */}
      {isAdmin && !canManage && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span className="font-['DM_Mono'] text-xs text-white/80 tracking-widest uppercase">No Access</span>
          </div>
        </div>
      )}

      {/* Poster */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {t.posterUrl ? (
          <img
            src={t.posterUrl}
            alt={`${t.name} poster`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onClick={e => { e.stopPropagation(); onPosterClick(t.posterUrl!); }}
            title="Click to view poster"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center t-elevated">
            <span className="text-4xl mb-2">🏆</span>
            <span className="font-['DM_Mono'] text-[10px] t-dim uppercase tracking-widest">No poster</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

        {/* Edit poster button */}
        {isAdmin && canManage && (
          <label
            onClick={e => e.stopPropagation()}
            className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 font-['DM_Mono'] text-[10px] text-white/80 hover:bg-black/80 hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            {posterSaving && editingPosterId === t.id ? '⏳ Uploading…' : '🖼 Edit Poster'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={posterSaving}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                onPosterChange(file);
                e.target.value = '';
              }}
            />
          </label>
        )}

        {/* Edit / Delete buttons */}
        {isAdmin && canManage && (
          <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={onEdit}
              className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 font-['DM_Mono'] text-[10px] text-blue-300 hover:bg-blue-900/70 hover:text-blue-200 hover:border-blue-500/50 transition-all cursor-pointer"
            >
              ✏️ Edit
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDeleteClick(); }}
              className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 font-['DM_Mono'] text-[10px] text-red-400 hover:bg-red-900/70 hover:text-red-300 hover:border-red-500/50 transition-all cursor-pointer"
            >
              🗑 Delete
            </button>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4">
        <div className="font-['Bebas_Neue'] text-xl tracking-wider t-text leading-tight mb-0.5 group-hover:text-[var(--accent)] transition-colors">
          {t.name}
        </div>
        <div className="font-['DM_Mono'] text-[10px] t-muted mb-1">
          /{t.id} · Created {new Date(t.createdAt).toLocaleDateString()}
        </div>
        {t.tournamentDate && (
          <div className="font-['DM_Mono'] text-[10px] mb-0.5" style={{ color: 'var(--accent-gold)' }}>
            📅 {new Date(t.tournamentDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
        {t.organizer && (
          <div className="font-['DM_Mono'] text-[10px] t-muted mb-3">
            <span className="t-dim">Organizer: </span>{t.organizer}
          </div>
        )}
        {!t.tournamentDate && !t.organizer && <div className="mb-3" />}
        <div className="font-['DM_Mono'] text-[10px] t-muted mb-2 flex items-center gap-2">
          <span>👁 {visitorCount}</span>
          <span>·</span>
          <span>🛡 {activeAdminCount}</span>
        </div>
        <div
          className="mt-auto w-full py-2.5 rounded-xl font-['DM_Mono'] text-xs font-bold uppercase tracking-widest text-white text-center transition-all group-hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, var(--accent-red), var(--accent))' }}
        >
          Enter Tournament →
        </div>
      </div>

      {/* Upload overlay */}
      {editingPosterId === t.id && posterSaving && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-10">
          <div className="font-['DM_Mono'] text-xs text-white/70 animate-pulse">Uploading poster…</div>
        </div>
      )}
    </div>
  );
}
