'use client';

import { useState, useCallback } from 'react';
import { useSSE } from './useSSE';

export interface TournamentMeta {
  id: string;
  name: string;
  createdAt: number;
  ownerAdminId?: string;
  collaborators?: string[];
  posterUrl?: string;
  tournamentDate?: number;
  organizer?: string;
}

export function useTournaments() {
  const [tournaments, setTournaments] = useState<TournamentMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useSSE<{ tournaments: TournamentMeta[] }>(
    '/api/tournaments/stream',
    (data) => {
      setTournaments(data.tournaments ?? []);
      setLoading(false);
    },
    10_000,
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/tournaments');
      const data = await res.json();
      setTournaments(data.tournaments ?? []);
    } catch { /* ignore */ }
  }, []);

  return { tournaments, setTournaments, loading, refresh };
}
