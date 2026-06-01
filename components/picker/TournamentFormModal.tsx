'use client';

import { useState } from 'react';

export interface TournamentFormValues {
  name: string;
  id?: string;           // only used in create mode
  organizer: string;
  tournamentDate: string;
  posterFile: File | null;
  posterPreview: string;
}

interface Props {
  mode: 'create' | 'edit';
  initial: TournamentFormValues;
  saving: boolean;
  error: string;
  onSubmit: (values: TournamentFormValues) => void;
  onCancel: () => void;
}

const inputCls =
  'w-full t-elevated border t-border-mid rounded-xl px-4 py-2.5 t-text font-[\'DM_Mono\'] text-sm outline-none focus:border-[var(--accent)] transition-colors';
const labelCls =
  'block font-[\'DM_Mono\'] text-[10px] t-muted uppercase tracking-widest mb-1.5';

export function TournamentFormModal({ mode, initial, saving, error, onSubmit, onCancel }: Props) {
  const [name, setName]                   = useState(initial.name);
  const [id, setId]                       = useState(initial.id ?? '');
  const [organizer, setOrganizer]         = useState(initial.organizer);
  const [tournamentDate, setTournamentDate] = useState(initial.tournamentDate);
  const [posterFile, setPosterFile]       = useState<File | null>(initial.posterFile);
  const [posterPreview, setPosterPreview] = useState(initial.posterPreview);

  const handleNameChange = (val: string) => {
    setName(val);
    if (mode === 'create') {
      const derived     = val.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64);
      const prevDerived = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 64);
      if (!id || id === prevDerived) setId(derived);
    }
  };

  const handleFileChange = (file: File | null) => {
    setPosterFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => setPosterPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPosterPreview('');
    }
  };

  const handleSubmit = () => {
    onSubmit({ name, id, organizer, tournamentDate, posterFile, posterPreview });
  };

  return (
    <div className="space-y-4">
      {/* Tournament Name */}
      <div>
        <label className={labelCls}>Tournament Name</label>
        <input
          type="text"
          className={inputCls}
          placeholder="e.g. Kabut Open 2025"
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          autoFocus
        />
      </div>

      {/* ID / Slug — create only */}
      {mode === 'create' && (
        <div>
          <label className={labelCls}>ID / Slug</label>
          <input
            type="text"
            className={inputCls}
            placeholder="e.g. kabut-open-2025"
            value={id}
            onChange={e => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64))}
          />
          <p className="font-['DM_Mono'] text-[10px] t-muted mt-1">Letters, numbers, hyphens only.</p>
        </div>
      )}

      {/* Date & Time */}
      <div>
        <label className={labelCls}>
          Tournament Date &amp; Time{' '}
          <span className="normal-case tracking-normal t-dim">(optional)</span>
        </label>
        <input
          type="datetime-local"
          className={inputCls}
          value={tournamentDate}
          onChange={e => setTournamentDate(e.target.value)}
        />
      </div>

      {/* Organizer */}
      <div>
        <label className={labelCls}>
          Organizer{' '}
          <span className="normal-case tracking-normal t-dim">(optional)</span>
        </label>
        <input
          type="text"
          className={inputCls}
          placeholder="e.g. Kabut Esports"
          value={organizer}
          onChange={e => setOrganizer(e.target.value.slice(0, 100))}
        />
      </div>

      {/* Poster Image */}
      <div>
        <label className={labelCls}>
          Poster Image{' '}
          <span className="normal-case tracking-normal t-dim">
            {mode === 'edit' ? '(optional — replaces current)' : '(optional)'}
          </span>
        </label>
        <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed t-border-mid t-muted hover:border-[var(--accent)] hover:text-[var(--accent)] font-['DM_Mono'] text-xs tracking-widest uppercase transition-all cursor-pointer">
          📁 {posterFile ? posterFile.name : 'Choose image…'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </label>
        {posterPreview && (
          <div className="mt-2 rounded-lg overflow-hidden border t-border-mid h-28">
            <img src={posterPreview} alt="poster preview" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="font-['DM_Mono'] text-xs text-[var(--accent-red)]">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          className="flex-1 py-2.5 rounded-xl t-elevated border t-border-mid t-text font-['DM_Mono'] text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          className="flex-1 py-2.5 rounded-xl text-white font-['DM_Mono'] text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
          style={{ background: 'var(--accent)' }}
          onClick={handleSubmit}
          disabled={saving || !name.trim() || (mode === 'create' && !id.trim())}
        >
          {saving
            ? mode === 'create' ? 'Creating…' : 'Saving…'
            : mode === 'create' ? 'Create' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
