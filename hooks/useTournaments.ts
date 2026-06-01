'use client';

import { useState, useEffect, useCallback } from 'react';

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
  const [loading, setLoading]         = useState(true);

  // ── SSE sync with polling fallback ───────────────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const applyData = (data: { tournaments: TournamentMeta[] }) => {
      setTournaments(data.tournaments ?? []);
      setLoading(false);
    };

    const fetchOnce = async () => {
      try {
        const res  = await fetch('/api/tournaments');
        const data = await res.json();
        applyData(data);
      } catch { /* silently ignore network blip */ }
    };

    const connect = () => {
      if (typeof EventSource === 'undefined') {
        fetchOnce();
        pollInterval = setInterval(fetchOnce, 10_000);
        return;
      }
      es = new EventSource('/api/tournaments/stream');
      es.onmessage = (e) => {
        try { applyData(JSON.parse(e.data)); } catch { /* ignore malformed frame */ }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (!pollInterval) {
          fetchOnce();
          pollInterval = setInterval(fetchOnce, 10_000);
        }
      };
    };

    connect();
    return () => {
      es?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // ── Refresh (used after SuperAdmin changes) ──────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res  = await fetch('/api/tournaments');
      const data = await res.json();
      setTournaments(data.tournaments ?? []);
    } catch { /* ignore */ }
  }, []);

  return { tournaments, setTournaments, loading, refresh };
}
