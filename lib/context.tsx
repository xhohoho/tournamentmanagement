'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Player, Team, Bracket, ChatMessage } from '@/lib/types';

interface TourneyContext {
  players: Player[];
  roster: string[];
  teamMode: 'leader' | 'random';
  teams: Team[];
  elimMode: 'single' | 'double';
  bracket: Bracket | null;
  maps: string[];
  stageMaps: Record<string, string[]>;
  spinState: import('@/lib/types').SpinState | null;
  shuffleState: import('@/lib/types').ShuffleState | null;
  spinQueue: string[];
  spinCategories: string[];
  spinItemCategory: Record<number, string>;
  defaultMaps: string[];
  isAdmin: boolean;
  adminToken: string | null;
  loading: boolean;

  joinKey: string;          // empty = no key required; non-empty = key active
  chatMessages: ChatMessage[];

  setIsAdmin: (v: boolean) => void;
  setAdminToken: (token: string | null) => void;
  refresh: () => Promise<void>;

  submitPlayer: (name: string, joinKey?: string) => Promise<{ error?: string }>;
  removePlayer: (name: string) => Promise<void>;
  addToRoster: (name: string) => Promise<void>;
  removeFromRoster: (name: string) => Promise<void>;
  setRoster: (names: string[]) => Promise<void>;
  clearQueue: () => Promise<void>;
  clearRoster: () => Promise<void>;

  setJoinKey: (key: string) => Promise<{ error?: string }>;

  sendChat: (name: string, text: string) => Promise<{ error?: string }>;
  clearChat: () => Promise<void>;

  formTeams: (leaders?: string[]) => Promise<{ error?: string; teams?: Team[] }>;
  resetTeams: () => Promise<void>;
  setTeamMode: (mode: 'leader' | 'random') => Promise<void>;

  generateBracket: (matchFormat?: 'bo1' | 'bo3') => Promise<{ error?: string }>;
  seedBracket: (matchFormat?: 'bo1' | 'bo3') => Promise<{ error?: string }>;
  updateScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  undoMatch: (section: string, ri: number, mi: number) => Promise<void>;
  updateThirdPlace: (p1wins: number, p2wins: number) => Promise<void>;
  resetBracket: () => Promise<void>;
  setElimMode: (mode: 'single' | 'double') => Promise<void>;

  addMap: (name: string) => Promise<{ error?: string }>;
  removeMap: (name: string) => Promise<void>;
  appendSpinQueue: (map: string) => Promise<void>;
  clearSpinQueue: () => Promise<void>;
  removeSpinQueueItem: (idx: number) => Promise<void>;
  saveSpinCategories: (cats: string[], itemCat: Record<number, string>) => Promise<void>;
  saveDefaultMaps: (starred: string[]) => Promise<void>;
  assignStage: (stageKey: string, mapName: string, slot?: number) => Promise<void>;
  clearStage: (stageKey: string, slot?: number) => Promise<void>;
  assignLeader: (teamId: string, playerName: string) => Promise<{ error?: string }>;

  resetAll: () => Promise<void>;
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
  const [spinState, setSpinState] = useState<import('@/lib/types').SpinState | null>(null);
  const [shuffleState, setShuffleState] = useState<import('@/lib/types').ShuffleState | null>(null);
  const [spinQueue, setSpinQueue] = useState<string[]>([]);
  const [spinCategories, setSpinCategories] = useState<string[]>([]);
  const [spinItemCategory, setSpinItemCategory] = useState<Record<number, string>>({});
  const [defaultMaps, setDefaultMaps] = useState<string[]>([]);
  const [joinKey, setJoinKeyState] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAdmin, setIsAdminState] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pendingSpinAppend = useRef(false);
  const pendingElimChange = useRef(false);

  const adminHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
  }), [adminToken]);

  const setIsAdmin = (v: boolean) => {
    setIsAdminState(v);
    if (!v) {
      if (adminToken) {
        fetch('/api/admin/auth', {
          method: 'DELETE',
          headers: { 'X-Admin-Token': adminToken },
        }).catch(() => {/* best-effort */});
      }
      setAdminToken(null);
    }
  };

  const setAdminTokenPublic = (token: string | null) => {
    setAdminToken(token);
  };

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
      setSpinState(data.spinState ?? null);
      setShuffleState(data.shuffleState ?? null);
      setSpinQueue(data.spinQueue ?? []);
      setSpinCategories(data.spinCategories ?? []);
      setSpinItemCategory(data.spinItemCategory ?? {});
      setDefaultMaps(data.defaultMaps ?? []);
      setJoinKeyState(data.joinKey ?? '');
      setChatMessages(data.chatMessages ?? []);
    } catch {
      // keep existing state on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    let es: EventSource | null = null;
    let pollFallback: NodeJS.Timeout | null = null;

    const connect = () => {
      if (typeof EventSource === 'undefined') {
        pollFallback = setInterval(refresh, 4000);
        return;
      }
      es = new EventSource('/api/state/stream');
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setPlayers(data.players ?? []);
          setRosterState(data.roster ?? []);
          setTeamModeState(data.teamMode ?? 'leader');
          setTeams(data.teams ?? []);
          if (!pendingElimChange.current) setElimModeState(data.elimMode ?? 'single');
          setBracket(data.bracket ?? null);
          setMaps(data.maps ?? []);
          setStageMaps(data.stageMaps ?? {});
          setSpinState(data.spinState ?? null);
          setShuffleState(data.shuffleState ?? null);
          if (!pendingSpinAppend.current) {
            setSpinQueue(data.spinQueue ?? []);
            setSpinCategories(data.spinCategories ?? []);
            setSpinItemCategory(data.spinItemCategory ?? {});
            setDefaultMaps(data.defaultMaps ?? []);
          }
          setJoinKeyState(data.joinKey ?? '');
          setChatMessages(data.chatMessages ?? []);
        } catch { /* ignore malformed frames */ }
        setLoading(false);
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (!pollFallback) pollFallback = setInterval(refresh, 4000);
      };
    };

    connect();
    return () => {
      es?.close();
      if (pollFallback) clearInterval(pollFallback);
    };
  }, [refresh]);

  // —— Players ——
  const submitPlayer = async (name: string, joinKey?: string) => {
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, joinKey }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setPlayers(data.players);
    return {};
  };

  const removePlayer = async (name: string) => {
    const res = await fetch('/api/players', {
      method: 'DELETE',
      headers: adminHeaders,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setPlayers(data.players);
    setRosterState(data.roster);
  };

  const addToRoster = async (name: string) => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'addToRoster', name }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const removeFromRoster = async (name: string) => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'removeFromRoster', name }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const setRoster = async (names: string[]) => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'setRoster', roster: names }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const clearQueue = async () => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'clearQueue' }),
    });
    const data = await res.json();
    setPlayers(data.players);
    setRosterState(data.roster);
  };

  const clearRoster = async () => {
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'clearRoster' }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  // —— Join Key ——
  const setJoinKey = async (key: string) => {
    const res = await fetch('/api/players/joinkey', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ joinKey: key }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setJoinKeyState(data.joinKey ?? '');
    return {};
  };

  // —— Chat ——
  const sendChat = async (name: string, text: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, text }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setChatMessages(data.messages);
    return {};
  };

  const clearChat = async () => {
    const res = await fetch('/api/chat', { method: 'DELETE', headers: adminHeaders });
    const data = await res.json();
    setChatMessages(data.messages);
  };

  // —— Teams ——
  const formTeams = async (leaders?: string[]) => {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ teamMode, leaders }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    setBracket(null);
    return { teams: data.teams };
  };

  const assignLeader = async (teamId: string, playerName: string) => {
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ assignments: { [teamId]: playerName } }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Server rejected leader assignment.' };
      setTeams(data.teams);
      return {};
    } catch {
      setTeams(prevTeams =>
        prevTeams.map(t => t.name === teamId ? { ...t, leader: playerName } : t)
      );
      return { error: 'Network failure. Leader assigned locally, but not saved to cloud database.' };
    }
  };

  const resetTeams = async () => {
    await fetch('/api/teams', { method: 'DELETE', headers: adminHeaders });
    setTeams([]);
    setBracket(null);
  };

  const setTeamMode = async (mode: 'leader' | 'random') => {
    await fetch('/api/teams', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ teamMode: mode }),
    });
    setTeamModeState(mode);
  };

  // —— Bracket ——
  const generateBracket = async (matchFormat: 'bo1' | 'bo3' = 'bo1') => {
    const res = await fetch('/api/bracket', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ elimMode, matchFormat, action: 'generate' }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setBracket(data.bracket);
    return {};
  };

  const seedBracket = async (matchFormat: 'bo1' | 'bo3' = 'bo1') => {
    const res = await fetch('/api/bracket', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ elimMode, matchFormat, action: 'seed' }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setBracket(data.bracket);
    if (data.shuffleState) setShuffleState(data.shuffleState);
    return {};
  };

  const updateScore = async (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => {
    const res = await fetch('/api/bracket', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ section, ri, mi, p1wins, p2wins }),
    });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const undoMatch = async (section: string, ri: number, mi: number) => {
    const res = await fetch('/api/bracket', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'undoMatch', section, ri, mi }),
    });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const updateThirdPlace = async (p1wins: number, p2wins: number) => {
    const res = await fetch('/api/bracket', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ p1wins, p2wins }),
    });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const resetBracket = async () => {
    await fetch('/api/bracket', { method: 'DELETE', headers: adminHeaders });
    setBracket(null);
    setStageMaps({});
  };

  const setElimMode = async (mode: 'single' | 'double') => {
    setElimModeState(mode);
    pendingElimChange.current = true;
    try {
      await fetch('/api/bracket', {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ action: 'setElimMode', elimMode: mode }),
      });
    } finally {
      pendingElimChange.current = false;
    }
  };

  // —— Maps ——
  const addMap = async (name: string) => {
    const res = await fetch('/api/maps', {
      method: 'POST',
      headers: adminHeaders,
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
      headers: adminHeaders,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setMaps(data.maps);
    setStageMaps(data.stageMaps);
  };

  const appendSpinQueue = async (map: string) => {
    setSpinQueue(prev => [...prev, map]);
    pendingSpinAppend.current = true;
    try {
      const res = await fetch('/api/maps', {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ action: 'appendSpinQueue', map }),
      });
      if (res.ok) {
        const data = await res.json();
        setSpinQueue(data.spinQueue);
      } else {
        setSpinQueue(prev => prev.slice(0, -1));
      }
    } catch {
      setSpinQueue(prev => prev.slice(0, -1));
    } finally {
      pendingSpinAppend.current = false;
    }
  };

  const removeSpinQueueItem = async (idx: number) => {
    setSpinQueue(prev => {
      const newQ = prev.filter((_, i) => i !== idx);
      fetch('/api/maps', {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ action: 'updateSpinQueue', spinQueue: newQ }),
      });
      return newQ;
    });
  };

  const clearSpinQueue = async () => {
    setSpinQueue([]);
    pendingSpinAppend.current = true;
    try {
      await fetch('/api/maps', {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ action: 'updateSpinQueue', spinQueue: [] }),
      });
    } finally {
      pendingSpinAppend.current = false;
    }
  };

  const saveDefaultMaps = async (starred: string[]) => {
    setDefaultMaps(starred);
    await fetch('/api/maps', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'updateDefaultMaps', defaultMaps: starred }),
    });
  };

  const saveSpinCategories = async (cats: string[], itemCat: Record<number, string>) => {
    setSpinCategories(cats);
    setSpinItemCategory(itemCat);
    await fetch('/api/maps', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'updateSpinCategories', spinCategories: cats, spinItemCategory: itemCat }),
    });
  };

  const assignStage = async (stageKey: string, mapName: string, slot = 0) => {
    const res = await fetch('/api/maps', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'assignStage', stageKey, mapName, slot }),
    });
    const data = await res.json();
    setStageMaps(data.stageMaps);
  };

  const clearStage = async (stageKey: string, slot?: number) => {
    const res = await fetch('/api/maps', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'clearStage', stageKey, slot }),
    });
    const data = await res.json();
    setStageMaps(data.stageMaps);
  };

  const resetAll = async () => {
    await fetch('/api/reset', { method: 'DELETE', headers: adminHeaders });
    setPlayers([]);
    setRosterState([]);
    setTeams([]);
    setBracket(null);
    setStageMaps({});
    setJoinKeyState('');
    setChatMessages([]);
    setSpinQueue([]);
    setSpinCategories([]);
    setSpinItemCategory({});
    setSpinState(null);
  };

  return (
    <Ctx.Provider value={{
      players, roster, teamMode, teams, elimMode, bracket, maps, stageMaps, spinState, spinQueue,
      spinCategories, spinItemCategory, defaultMaps,
      joinKey, chatMessages,
      isAdmin, adminToken, loading, setIsAdmin, setAdminToken: setAdminTokenPublic, refresh,
      submitPlayer, removePlayer, addToRoster, removeFromRoster,
      setRoster, clearQueue, clearRoster,
      setJoinKey,
      sendChat, clearChat,
      formTeams, resetTeams, setTeamMode,
      generateBracket, updateScore, undoMatch, updateThirdPlace, resetBracket, setElimMode,
      addMap, removeMap, appendSpinQueue, clearSpinQueue, removeSpinQueueItem, saveDefaultMaps, saveSpinCategories, assignStage, clearStage,
      assignLeader,
      resetAll,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTourney() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTourney must be inside TourneyProvider');
  return ctx;
}
