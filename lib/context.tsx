'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Player, Team, Bracket } from '@/lib/types';

interface TourneyContext {
  players: Player[];
  roster: string[];
  teamMode: 'leader' | 'random';
  teams: Team[];
  elimMode: 'single' | 'double';
  bracket: Bracket | null;
  maps: string[];
  stageMaps: Record<string, string[]>;
  isAdmin: boolean;
  loading: boolean;

  setIsAdmin: (v: boolean) => void;
  refresh: () => Promise<void>;

  submitPlayer: (name: string, byAdmin?: boolean) => Promise<{ error?: string }>;
  removePlayer: (name: string) => Promise<void>;
  addToRoster: (name: string) => Promise<void>;
  removeFromRoster: (name: string) => Promise<void>;
  setRoster: (names: string[]) => Promise<void>;
  clearQueue: () => Promise<void>;
  clearRoster: () => Promise<void>;

  formTeams: (leaders?: string[]) => Promise<{ error?: string }>;
  resetTeams: () => Promise<void>;
  setTeamMode: (mode: 'leader' | 'random') => Promise<void>;

  generateBracket: () => Promise<{ error?: string }>;
  updateScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  resetBracket: () => Promise<void>;
  setElimMode: (mode: 'single' | 'double') => Promise<void>;

  addMap: (name: string) => Promise<{ error?: string }>;
  removeMap: (name: string) => Promise<void>;
  removeSpunMap: (name: string) => Promise<void>;
  assignStage: (stageKey: string, mapName: string, slot?: number) => Promise<void>;
  clearStage: (stageKey: string, slot?: number) => Promise<void>;
}

const Ctx = createContext<TourneyContext | null>(null);

export function TourneyProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [roster, setRosterState] = useState<string[]>([]);
  const [teamMode, setTeamModeState] = useState<'leader' | 'random'>('leader');
  const [teams, setTeams] = useState<Team[]>([]);
  const [elimMode, setElimModeState] = useState<'single' | 'double'>('single');
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [maps, setMaps] = useState<string[]>([]);
  const [stageMaps, setStageMaps] = useState<Record<string, string[]>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setPlayers(data.players ?? []);
      setRosterState(data.roster ?? []);
      setTeamModeState(data.teamMode ?? 'leader');
      setTeams(data.teams ?? []);
      setElimModeState(data.elimMode ?? 'single');
      setBracket(data.bracket ?? null);
      setMaps(data.maps ?? []);
      setStageMaps(data.stageMaps ?? {});
    } catch {
      // keep existing state on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [refresh]);

  // ── Players ──
  const submitPlayer = async (name: string, byAdmin = false) => {
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, byAdmin }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setPlayers(data.players);
    return {};
  };

  const removePlayer = async (name: string) => {
    const res = await fetch('/api/players', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setPlayers(data.players);
    setRosterState(data.roster);
  };

  const addToRoster = async (name: string) => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addToRoster', name }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const removeFromRoster = async (name: string) => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'removeFromRoster', name }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const setRoster = async (names: string[]) => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setRoster', roster: names }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const clearQueue = async () => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearQueue' }),
    });
    const data = await res.json();
    setPlayers(data.players);
    setRosterState(data.roster);
  };

  const clearRoster = async () => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearRoster' }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  // ── Teams ──
  const formTeams = async (leaders?: string[]) => {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamMode, leaders }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    setBracket(null);
    return {};
  };

  const assignLeader = async (teamId: string, playerName: string) => {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments: { [teamId]: playerName } })
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    // Refresh local state to reflect new leader assignment
    await refresh();
    return {};
  };

  const resetTeams = async () => {
    await fetch('/api/teams', { method: 'DELETE' });
    setTeams([]);
    setBracket(null);
  };

  const setTeamMode = async (mode: 'leader' | 'random') => {
    await fetch('/api/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamMode: mode }),
    });
    setTeamModeState(mode);
  };

  // ── Bracket ──
  const generateBracket = async () => {
    const res = await fetch('/api/bracket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elimMode }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setBracket(data.bracket);
    return {};
  };

  const updateScore = async (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => {
    const res = await fetch('/api/bracket', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, ri, mi, p1wins, p2wins }),
    });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const resetBracket = async () => {
    await fetch('/api/bracket', { method: 'DELETE' });
    setBracket(null);
  };

  const setElimMode = async (mode: 'single' | 'double') => {
    setElimModeState(mode);
  };

  // ── Maps ──
  const addMap = async (name: string) => {
    const res = await fetch('/api/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setMaps(data.maps);
    return {};
  };

  const removeMap = async (name: string) => {
    const res = await fetch('/api/maps', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setMaps(data.maps);
    setStageMaps(data.stageMaps);
  };

  // Remove a map that was just spun (from the pool)
  const removeSpunMap = async (name: string) => {
    await removeMap(name);
  };

  const assignStage = async (stageKey: string, mapName: string, slot = 0) => {
    const res = await fetch('/api/maps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assignStage', stageKey, mapName, slot }),
    });
    const data = await res.json();
    setStageMaps(data.stageMaps);
  };

  const clearStage = async (stageKey: string, slot?: number) => {
    const res = await fetch('/api/maps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearStage', stageKey, slot }),
    });
    const data = await res.json();
    setStageMaps(data.stageMaps);
  };

  return (
    <Ctx.Provider value={{
      players, roster, teamMode, teams, elimMode, bracket, maps, stageMaps,
      isAdmin, loading, setIsAdmin, refresh,
      submitPlayer, removePlayer, addToRoster, removeFromRoster,
      setRoster, clearQueue, clearRoster,
      formTeams, resetTeams, setTeamMode,
      generateBracket, updateScore, resetBracket, setElimMode,
      addMap, removeMap, removeSpunMap, assignStage, clearStage,
      assignLeader,
    }>
      {children}
    </Ctx.Provider>
  );
}

export function useTourney() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTourney must be inside TourneyProvider');
  return ctx;
}
