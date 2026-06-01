'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Player, Team, Bracket, ChatMessage, FFAState, FFAMapInfo, FFAPlayerScore, FFAWinner } from '@/lib/types';

interface TourneyContext {
  players: Player[];
  roster: string[];
  teamMode: 'leader' | 'random' | 'manual';
  teams: Team[];
  elimMode: 'single' | 'double';
  bracket: Bracket | null;
  maps: string[];
  usedMaps: string[];
  stageMaps: Record<string, string[]>;
  spinState: import('@/lib/types').SpinState | null;
  shuffleState: import('@/lib/types').ShuffleState | null;
  spinQueue: string[];
  spinCategories: string[];
  spinItemCategory: Record<number, string>;
  defaultMaps: string[];
  stageFormats: import('@/lib/types').StageFormats;
  ffa: FFAState;
  isAdmin: boolean;
  previewAsUser: boolean;
  adminToken: string | null;
  adminId: string | null;
  adminName: string | null;
  isSuperAdmin: boolean;
  loading: boolean;
  tickerText: string;

  tournamentId: string;
  joinKey: string;
  chatMessages: ChatMessage[];

  setIsAdmin: (v: boolean) => void;
  setPreviewAsUser: (v: boolean) => void;
  setAdminToken: (token: string | null) => void;
  setAdminInfo: (info: { adminId: string; name: string; isSuperAdmin: boolean } | null) => void;
  setStageFormats: (sf: import('@/lib/types').StageFormats) => Promise<void>;
  refresh: () => Promise<void>;
  setTickerText: (text: string) => Promise<void>;

  submitPlayer: (name: string, joinKey?: string) => Promise<{ error?: string }>;
  removePlayer: (name: string) => Promise<void>;
  renamePlayer: (oldName: string, newName: string) => Promise<{ error?: string }>;
  addToRoster: (name: string) => Promise<void>;
  removeFromRoster: (name: string) => Promise<void>;
  setRoster: (names: string[]) => Promise<void>;
  clearQueue: () => Promise<void>;
  clearRoster: () => Promise<void>;

  setJoinKey: (key: string) => Promise<{ error?: string }>;

  sendChat: (name: string, text: string) => Promise<{ error?: string }>;
  clearChat: () => Promise<void>;

  formTeams: (leaders?: string[], manualTeams?: import('@/lib/types').ManualTeamAssignment[]) => Promise<{ error?: string; teams?: Team[] }>;
  resetTeams: () => Promise<void>;
  setTeamMode: (mode: 'leader' | 'random' | 'manual') => Promise<void>;
  renameTeam: (teamId: string, customName: string) => Promise<{ error?: string }>;
  setTeamNameFromLeader: (teamId: string) => Promise<{ error?: string }>;
  addReplacement: (teamId: string, originalName: string, replacementName: string) => Promise<{ error?: string }>;
  removeReplacement: (teamId: string, originalName: string) => Promise<{ error?: string }>;
  swapPlayer: (playerName: string, fromTeamId: string, toTeamId: string) => Promise<{ error?: string }>;

  generateBracket: (sf?: import('@/lib/types').StageFormats) => Promise<{ error?: string }>;
  seedBracket: (sf?: import('@/lib/types').StageFormats) => Promise<{ error?: string; shuffleState?: import('@/lib/types').ShuffleState | null }>;
  updateScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  undoMatch: (section: string, ri: number, mi: number) => Promise<void>;
  updateThirdPlace: (p1wins: number, p2wins: number) => Promise<void>;
  resetBracket: () => Promise<void>;
  setElimMode: (mode: 'single' | 'double') => Promise<void>;

  addMap: (name: string) => Promise<{ error?: string }>;
  removeMap: (name: string) => Promise<void>;
  moveMapToUsed: (name: string) => Promise<void>;
  restoreUsedMap: (name?: string) => Promise<void>;
  appendSpinQueue: (map: string) => Promise<void>;
  clearSpinQueue: () => Promise<void>;
  removeSpinQueueItem: (idx: number) => Promise<void>;
  saveSpinCategories: (cats: string[], itemCat: Record<number, string>) => Promise<void>;
  saveDefaultMaps: (starred: string[]) => Promise<void>;
  assignStage: (stageKey: string, mapName: string, slot?: number) => Promise<void>;
  clearStage: (stageKey: string, slot?: number) => Promise<void>;
  assignLeader: (teamId: string, playerName: string) => Promise<{ error?: string }>;

  // FFA actions
  createFFAMatch: (mapInfo: FFAMapInfo) => Promise<{ error?: string }>;
  updateFFAScore: (matchId: string, playerName: string, score: number, imageUrl?: string) => Promise<void>;
  removeFFAScore: (matchId: string, playerName: string) => Promise<void>;
  setFFAScores: (matchId: string, scores: FFAPlayerScore[]) => Promise<void>;
  setFFAPlayers: (players: string[]) => Promise<void>;
  deleteFFAMatch: (matchId: string) => Promise<void>;
  lockFFAMatch: (matchId: string, locked: boolean) => Promise<void>;
  updateFFAMapInfo: (matchId: string, mapInfo: FFAMapInfo) => Promise<void>;
  setFFAMatchImage: (matchId: string, imageUrl: string) => Promise<void>;
  /** Upload/replace the score-tab screenshot for a FFA match. Pass empty string to remove. */
  setFFAMatchScoreImage: (matchId: string, scoreImageUrl: string) => Promise<void>;
  /** Set/replace the winners list for a FFA match. */
  setFFAMatchWinners: (matchId: string, winners: FFAWinner[]) => Promise<void>;

  resetAll: () => Promise<void>;
}

const Ctx = createContext<TourneyContext | null>(null);

// ─── shuffleState merge ───────────────────────────────────────────────────────
function applyShuffleState(
  prev: import('@/lib/types').ShuffleState | null,
  next: import('@/lib/types').ShuffleState | null,
  localRef: React.MutableRefObject<number | null>,
): import('@/lib/types').ShuffleState | null {
  if (!next) {
    if (localRef.current !== null) {
      if (!prev) { localRef.current = null; return null; }
      const totalMs = prev.reveals.length * prev.delayMs + 1200;
      if (Date.now() - prev.startTime >= totalMs) {
        localRef.current = null;
        return null;
      }
      return prev;
    }
    return null;
  }
  if (localRef.current === next.startTime) return prev ?? next;
  if (!prev) return next;
  return prev.startTime === next.startTime ? prev : next;
}

// ─── SSE guard ────────────────────────────────────────────────────────────────
const GUARD_MS = 1500;

function makeGuard() {
  const stamps: Record<string, number> = {};
  return {
    touch(field: string) { stamps[field] = Date.now(); },
    guarded(field: string) { return Date.now() - (stamps[field] ?? 0) < GUARD_MS; },
    clear(field: string) { stamps[field] = 0; },
  };
}

export function TourneyProvider({ children, tournamentId = 'default', initialAdminToken, initialAdminInfo }: { children: React.ReactNode; tournamentId?: string; initialAdminToken?: string; initialAdminInfo?: { adminId: string; name: string; isSuperAdmin: boolean } | null }) {
  const t = encodeURIComponent(tournamentId);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roster, setRosterState] = useState<string[]>([]);
  const [teamMode, setTeamModeState] = useState<'leader' | 'random' | 'manual'>('leader');
  const [teams, setTeams] = useState<Team[]>([]);
  const [stageFormats, setStageFormatsState] = useState<import('@/lib/types').StageFormats>({ groupStage: 'bo1', semiFinal: 'bo3', grandFinal: 'bo3' });
  const [elimMode, setElimModeState] = useState<'single' | 'double'>('single');
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [maps, setMaps] = useState<string[]>([]);
  const [usedMaps, setUsedMaps] = useState<string[]>([]);
  const [stageMaps, setStageMaps] = useState<Record<string, string[]>>({});
  const [spinState, setSpinState] = useState<import('@/lib/types').SpinState | null>(null);
  const [shuffleState, setShuffleState] = useState<import('@/lib/types').ShuffleState | null>(null);
  const [spinQueue, setSpinQueue] = useState<string[]>([]);
  const [spinCategories, setSpinCategories] = useState<string[]>([]);
  const [spinItemCategory, setSpinItemCategory] = useState<Record<number, string>>({});
  const [defaultMaps, setDefaultMaps] = useState<string[]>([]);
  const [joinKey, setJoinKeyState] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [ffa, setFFA] = useState<FFAState>({ matches: [], players: [] });
  const [isAdmin, setIsAdminState] = useState(!!initialAdminToken);
  const [previewAsUser, setPreviewAsUserState] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(initialAdminToken ?? null);
  const [adminId, setAdminId] = useState<string | null>(initialAdminInfo?.adminId ?? null);
  const [adminName, setAdminName] = useState<string | null>(initialAdminInfo?.name ?? null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(initialAdminInfo?.isSuperAdmin ?? false);
  const [loading, setLoading] = useState(true);
  const [tickerText, setTickerTextState] = useState('');

  const guard = useRef(makeGuard()).current;
  const localShuffleStartTimeRef = useRef<number | null>(null);

  const adminHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
  }), [adminToken]);

  /**
   * Thin fetch wrapper: injects adminHeaders + JSON-serialises body.
   * Use for all admin-authenticated API calls within TourneyProvider.
   */
  const apiFetch = useCallback(
    (url: string, method: string, body?: unknown): Promise<Response> =>
      fetch(url, {
        method,
        headers: adminHeaders,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    [adminHeaders],
  );

  const setIsAdmin = (v: boolean) => {
    setIsAdminState(v);
    if (!v) {
      setPreviewAsUserState(false);
      if (adminToken) {
        fetch('/api/admin/auth', {
          method: 'DELETE',
          headers: { 'X-Admin-Token': adminToken },
        }).catch(() => {});
      }
      setAdminToken(null);
      setAdminId(null);
      setAdminName(null);
      setIsSuperAdmin(false);
    }
  };

  const setAdminTokenPublic = (token: string | null) => setAdminToken(token);

  const setAdminInfo = (info: { adminId: string; name: string; isSuperAdmin: boolean } | null) => {
    setAdminId(info?.adminId ?? null);
    setAdminName(info?.name ?? null);
    setIsSuperAdmin(info?.isSuperAdmin ?? false);
  };

  const applySnapshot = useCallback((data: Record<string, unknown>, fromSSE = false) => {
    if (!fromSSE || !guard.guarded('players'))   setPlayers(data.players as Player[] ?? []);
    if (!fromSSE || !guard.guarded('roster'))    setRosterState(data.roster as string[] ?? []);
    if (!fromSSE || !guard.guarded('teamMode'))  setTeamModeState((data.teamMode as 'leader' | 'random' | 'manual') ?? 'leader');
    if (!fromSSE) setStageFormatsState((data.stageFormats as import('@/lib/types').StageFormats) ?? { groupStage: 'bo1', semiFinal: 'bo3', grandFinal: 'bo3' });
    if (!fromSSE) setElimModeState((data.elimMode as 'single' | 'double') ?? 'single');
    if (!fromSSE || !guard.guarded('teams'))     setTeams(data.teams as Team[] ?? []);
    if (!fromSSE || !guard.guarded('bracket'))   setBracket((data.bracket as Bracket | null) ?? null);
    if (!fromSSE || !guard.guarded('maps'))      setMaps(data.maps as string[] ?? []);
    if (!fromSSE || !guard.guarded('usedMaps'))  setUsedMaps(data.usedMaps as string[] ?? []);
    if (!fromSSE || !guard.guarded('stageMaps')) setStageMaps(data.stageMaps as Record<string, string[]> ?? {});
    if (!fromSSE || !guard.guarded('spinQueue')) setSpinQueue(data.spinQueue as string[] ?? []);
    if (!fromSSE || !guard.guarded('spinCategories')) {
      setSpinCategories(data.spinCategories as string[] ?? []);
      setSpinItemCategory(data.spinItemCategory as Record<number, string> ?? {});
    }
    if (!fromSSE || !guard.guarded('defaultMaps')) setDefaultMaps(data.defaultMaps as string[] ?? []);
    if (!fromSSE || !guard.guarded('joinKey'))   setJoinKeyState(data.joinKey as string ?? '');
    if (!fromSSE || !guard.guarded('chat'))      setChatMessages(data.chatMessages as ChatMessage[] ?? []);
    if (!fromSSE || !guard.guarded('tickerText')) setTickerTextState(data.tickerText as string ?? '');
    if (!fromSSE || !guard.guarded('ffa'))       setFFA((data.ffa as FFAState) ?? { matches: [], players: [] });

    setSpinState(data.spinState as import('@/lib/types').SpinState | null ?? null);
    setShuffleState(prev =>
      applyShuffleState(prev, data.shuffleState as import('@/lib/types').ShuffleState | null ?? null, localShuffleStartTimeRef)
    );
  }, [guard]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?t=${t}`);
      const data = await res.json();
      applySnapshot(data, false);
    } catch {
      // keep existing state on network error
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    refresh();

    let es: EventSource | null = null;
    let pollFallback: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (typeof EventSource === 'undefined') {
        pollFallback = setInterval(refresh, 4000);
        return;
      }
      es = new EventSource(`/api/state/stream?t=${t}`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          applySnapshot(data, true);
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
  }, [refresh, applySnapshot]);

  // ── Players ───────────────────────────────────────────────────────────────
  const submitPlayer = async (name: string, joinKey?: string) => {
    const res = await fetch(`/api/players?t=${t}`, {
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
    guard.touch('players'); guard.touch('roster');
    const res = await apiFetch(`/api/players?t=${t}`, 'DELETE', { name });
    const data = await res.json();
    setPlayers(data.players);
    setRosterState(data.roster);
  };

  const renamePlayer = async (oldName: string, newName: string) => {
    guard.touch('players'); guard.touch('roster'); guard.touch('teams');
    const res = await apiFetch(`/api/players?t=${t}`, 'PATCH', { action: 'renamePlayer', oldName, newName });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setPlayers(data.players);
    setRosterState(data.roster);
    if (data.teams) setTeams(data.teams);
    return {};
  };

  const addToRoster = async (name: string) => {
    guard.touch('roster');
    const res = await apiFetch(`/api/players?t=${t}`, 'PATCH', { action: 'addToRoster', name });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const removeFromRoster = async (name: string) => {
    guard.touch('roster');
    const res = await apiFetch(`/api/players?t=${t}`, 'PATCH', { action: 'removeFromRoster', name });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const setRoster = async (names: string[]) => {
    guard.touch('roster');
    const res = await apiFetch(`/api/players?t=${t}`, 'PATCH', { action: 'setRoster', roster: names });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const clearQueue = async () => {
    guard.touch('players'); guard.touch('roster');
    const res = await apiFetch(`/api/players?t=${t}`, 'PATCH', { action: 'clearQueue' });
    const data = await res.json();
    setPlayers(data.players);
    setRosterState(data.roster);
  };

  const clearRoster = async () => {
    guard.touch('roster');
    const res = await apiFetch(`/api/players?t=${t}`, 'PATCH', { action: 'clearRoster' });
    const data = await res.json();
    setRosterState(data.roster);
  };

  // ── Join Key ──────────────────────────────────────────────────────────────
  const setJoinKey = async (key: string) => {
    guard.touch('joinKey');
    const res = await apiFetch(`/api/players/joinkey?t=${t}`, 'PATCH', { joinKey: key });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setJoinKeyState(data.joinKey ?? '');
    return {};
  };

  // ── Chat ──────────────────────────────────────────────────────────────────
  const sendChat = async (name: string, text: string) => {
    const res = await fetch(`/api/chat?t=${t}`, {
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
    guard.touch('chat');
    const res = await apiFetch(`/api/chat?t=${t}`, 'DELETE');
    const data = await res.json();
    setChatMessages(data.messages);
  };

  // ── Teams ─────────────────────────────────────────────────────────────────
  const formTeams = async (leaders?: string[], manualTeams?: import('@/lib/types').ManualTeamAssignment[]) => {
    guard.touch('teams'); guard.touch('bracket');
    const res = await apiFetch(`/api/teams?t=${t}`, 'POST', { teamMode, leaders, manualTeams });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    setBracket(null);
    return { teams: data.teams };
  };

  const assignLeader = async (teamId: string, playerName: string) => {
    guard.touch('teams');
    try {
      const res = await apiFetch(`/api/teams?t=${t}`, 'POST', { assignments: { [teamId]: playerName } });
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
    guard.touch('teams'); guard.touch('bracket');
    await apiFetch(`/api/teams?t=${t}`, 'DELETE');
    setTeams([]);
    setBracket(null);
  };

  const setTeamMode = async (mode: 'leader' | 'random' | 'manual') => {
    guard.touch('teamMode');
    setTeamModeState(mode);
    await apiFetch(`/api/teams?t=${t}`, 'PATCH', { teamMode: mode });
  };

  const renameTeam = async (teamId: string, customName: string) => {
    guard.touch('teams');
    const res = await apiFetch(`/api/teams?t=${t}`, 'PATCH', { action: 'renameTeam', teamId, customName });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    return {};
  };

  const setTeamNameFromLeader = async (teamId: string) => {
    guard.touch('teams');
    const res = await apiFetch(`/api/teams?t=${t}`, 'PATCH', { action: 'setTeamNameFromLeader', teamId });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    return {};
  };

  const addReplacement = async (teamId: string, originalName: string, replacementName: string) => {
    guard.touch('teams');
    const res = await apiFetch(`/api/teams?t=${t}`, 'PATCH', { action: 'addReplacement', teamId, originalName, replacementName });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    return {};
  };

  const removeReplacement = async (teamId: string, originalName: string) => {
    guard.touch('teams');
    const res = await apiFetch(`/api/teams?t=${t}`, 'PATCH', { action: 'removeReplacement', teamId, originalName });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    return {};
  };

  const swapPlayer = async (playerName: string, fromTeamId: string, toTeamId: string) => {
    guard.touch('teams');
    const res = await apiFetch(`/api/teams?t=${t}`, 'PATCH', { action: 'swapPlayer', playerName, fromTeamId, toTeamId });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    return {};
  };

  // ── Bracket ───────────────────────────────────────────────────────────────
  const setStageFormats = async (sf: import('@/lib/types').StageFormats) => {
    setStageFormatsState(sf);
    await apiFetch(`/api/bracket?t=${t}`, 'POST', { elimMode, action: 'saveFormats', stageFormats: sf });
  };

  const generateBracket = async (sf?: import('@/lib/types').StageFormats) => {
    guard.touch('bracket');
    const res = await apiFetch(`/api/bracket?t=${t}`, 'POST', { elimMode, matchFormat: 'bo1', action: 'generate', stageFormats: sf ?? stageFormats });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setBracket(data.bracket);
    return {};
  };

  const seedBracket = async (sf?: import('@/lib/types').StageFormats) => {
    guard.touch('bracket');
    const res = await apiFetch(`/api/bracket?t=${t}`, 'POST', { elimMode, matchFormat: 'bo1', action: 'seed', stageFormats: sf ?? stageFormats });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setBracket(data.bracket);
    if (data.shuffleState?.startTime) {
      localShuffleStartTimeRef.current = data.shuffleState.startTime;
    }
    return { shuffleState: data.shuffleState ?? null };
  };

  const updateScore = async (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => {
    guard.touch('bracket');
    const res = await apiFetch(`/api/bracket?t=${t}`, 'PATCH', { section, ri, mi, p1wins, p2wins });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const undoMatch = async (section: string, ri: number, mi: number) => {
    guard.touch('bracket');
    const res = await apiFetch(`/api/bracket?t=${t}`, 'PATCH', { action: 'undoMatch', section, ri, mi });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const updateThirdPlace = async (p1wins: number, p2wins: number) => {
    guard.touch('bracket');
    const res = await apiFetch(`/api/bracket?t=${t}`, 'PUT', { p1wins, p2wins });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const resetBracket = async () => {
    guard.touch('bracket'); guard.touch('stageMaps');
    await apiFetch(`/api/bracket?t=${t}`, 'DELETE');
    setBracket(null);
    setStageMaps({});
  };

  const setElimMode = async (mode: 'single' | 'double') => {
    setElimModeState(mode);
    await apiFetch(`/api/bracket?t=${t}`, 'PATCH', { action: 'setElimMode', elimMode: mode });
  };

  // ── Maps ──────────────────────────────────────────────────────────────────
  const addMap = async (name: string) => {
    guard.touch('maps');
    const res = await apiFetch(`/api/maps?t=${t}`, 'POST', { name });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setMaps(data.maps);
    return {};
  };

  const removeMap = async (name: string) => {
    guard.touch('maps'); guard.touch('stageMaps');
    const res = await apiFetch(`/api/maps?t=${t}`, 'DELETE', { name });
    const data = await res.json();
    setMaps(data.maps);
    setStageMaps(data.stageMaps);
  };

  const moveMapToUsed = async (name: string) => {
    guard.touch('usedMaps');
    setUsedMaps(prev => prev.includes(name) ? prev : [...prev, name]);
    try {
      const res = await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'moveToUsed', map: name });
      if (res.ok) {
        const data = await res.json();
        guard.touch('usedMaps');
        setUsedMaps(data.usedMaps ?? []);
      } else {
        setUsedMaps(prev => prev.filter(m => m !== name));
      }
    } catch {
      setUsedMaps(prev => prev.filter(m => m !== name));
    }
  };

  const restoreUsedMap = async (name?: string) => {
    guard.touch('usedMaps');
    setUsedMaps(name ? (prev => prev.filter(m => m !== name)) : []);
    try {
      const res = await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'restoreUsed', ...(name ? { map: name } : {}) });
      if (res.ok) {
        const data = await res.json();
        guard.touch('usedMaps');
        setUsedMaps(data.usedMaps ?? []);
      }
    } catch { /* keep optimistic update */ }
  };

  const appendSpinQueue = async (map: string) => {
    guard.touch('spinQueue');
    setSpinQueue(prev => [...prev, map]);
    try {
      const res = await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'appendSpinQueue', map });
      if (res.ok) {
        const data = await res.json();
        guard.touch('spinQueue');
        setSpinQueue(data.spinQueue);
      } else {
        setSpinQueue(prev => prev.slice(0, -1));
      }
    } catch {
      setSpinQueue(prev => prev.slice(0, -1));
    }
  };

  const removeSpinQueueItem = async (idx: number) => {
    guard.touch('spinQueue');
    setSpinQueue(prev => {
      const newQ = prev.filter((_, i) => i !== idx);
      apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'updateSpinQueue', spinQueue: newQ });
      return newQ;
    });
  };

  const clearSpinQueue = async () => {
    guard.touch('spinQueue'); guard.touch('usedMaps');
    setSpinQueue([]);
    setUsedMaps([]);
    const res = await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'clearAll' });
    if (res.ok) {
      const data = await res.json();
      guard.touch('usedMaps');
      setUsedMaps(data.usedMaps ?? []);
      guard.touch('spinQueue');
      setSpinQueue(data.spinQueue ?? []);
    }
  };

  const saveDefaultMaps = async (starred: string[]) => {
    guard.touch('defaultMaps');
    setDefaultMaps(starred);
    await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'updateDefaultMaps', defaultMaps: starred });
  };

  const saveSpinCategories = async (cats: string[], itemCat: Record<number, string>) => {
    guard.touch('spinCategories');
    setSpinCategories(cats);
    setSpinItemCategory(itemCat);
    await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'updateSpinCategories', spinCategories: cats, spinItemCategory: itemCat });
  };

  const assignStage = async (stageKey: string, mapName: string, slot = 0) => {
    guard.touch('stageMaps');
    const res = await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'assignStage', stageKey, mapName, slot });
    const data = await res.json();
    setStageMaps(data.stageMaps);
  };

  const clearStage = async (stageKey: string, slot?: number) => {
    guard.touch('stageMaps');
    const res = await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'clearStage', stageKey, slot });
    const data = await res.json();
    setStageMaps(data.stageMaps);
  };

  const setTickerText = async (text: string) => {
    guard.touch('tickerText');
    setTickerTextState(text);
    await apiFetch(`/api/ticker?t=${t}`, 'PATCH', { tickerText: text });
  };

  // ── FFA ───────────────────────────────────────────────────────────────────
  const ffaPatch = async (body: Record<string, unknown>) => {
    guard.touch('ffa');
    const res = await apiFetch(`/api/ffa?t=${t}`, 'PATCH', body);
    const data = await res.json();
    if (data.ffa) setFFA(data.ffa);
  };

  const createFFAMatch = async (mapInfo: FFAMapInfo) => {
    guard.touch('ffa');
    const res = await apiFetch(`/api/ffa?t=${t}`, 'POST', { mapInfo });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    if (data.ffa) setFFA(data.ffa);
    return {};
  };

  const updateFFAScore = async (matchId: string, playerName: string, score: number, imageUrl?: string) => {
    await ffaPatch({ action: 'updateScore', matchId, playerName, score, ...(imageUrl !== undefined ? { imageUrl } : {}) });
  };

  const removeFFAScore = async (matchId: string, playerName: string) => {
    await ffaPatch({ action: 'removeScore', matchId, playerName });
  };

  const setFFAScores = async (matchId: string, scores: FFAPlayerScore[]) => {
    await ffaPatch({ action: 'setScores', matchId, scores });
  };

  const setFFAPlayers = async (players: string[]) => {
    await ffaPatch({ action: 'setPlayers', players });
  };

  const deleteFFAMatch = async (matchId: string) => {
    await ffaPatch({ action: 'deleteMatch', matchId });
  };

  const lockFFAMatch = async (matchId: string, locked: boolean) => {
    await ffaPatch({ action: 'lockMatch', matchId, locked });
  };

  const updateFFAMapInfo = async (matchId: string, mapInfo: FFAMapInfo) => {
    await ffaPatch({ action: 'updateMapInfo', matchId, mapInfo });
  };

  const setFFAMatchImage = async (matchId: string, imageUrl: string) => {
    await ffaPatch({ action: 'setMatchImage', matchId, imageUrl });
  };

  const setFFAMatchScoreImage = async (matchId: string, scoreImageUrl: string) => {
    await ffaPatch({ action: 'setScoreImage', matchId, scoreImageUrl });
  };

  const setFFAMatchWinners = async (matchId: string, winners: FFAWinner[]) => {
    await ffaPatch({ action: 'setWinners', matchId, winners });
  };

  const resetAll = async () => {
    ['players','roster','teams','bracket','maps','usedMaps','stageMaps','joinKey','chat','spinQueue','spinCategories','defaultMaps','ffa'].forEach(f => guard.touch(f));
    await apiFetch(`/api/reset?t=${t}`, 'DELETE');
    setPlayers([]);
    setRosterState([]);
    setTeams([]);
    setBracket(null);
    // Maps and usedMaps are preserved across reset (tournament-level config).
    setStageMaps({});
    setJoinKeyState('');
    setChatMessages([]);
    setSpinQueue([]);
    setSpinCategories([]);
    setSpinItemCategory({});
    setSpinState(null);
    setShuffleState(null);
    setFFA({ matches: [], players: [] });
  };

  return (
    <Ctx.Provider value={{
      players, roster, teamMode, teams, elimMode, bracket, maps, usedMaps, stageMaps, spinState, shuffleState, spinQueue,
      spinCategories, spinItemCategory, defaultMaps, stageFormats, ffa,
      tournamentId,
      joinKey, chatMessages,
      isAdmin: isAdmin && !previewAsUser, previewAsUser, adminToken, adminId, adminName, isSuperAdmin, loading, tickerText,
      setIsAdmin, setPreviewAsUser: setPreviewAsUserState, setAdminToken: setAdminTokenPublic, setAdminInfo, refresh, setTickerText, setStageFormats,
      submitPlayer, removePlayer, renamePlayer, addToRoster, removeFromRoster,
      setRoster, clearQueue, clearRoster,
      setJoinKey,
      sendChat, clearChat,
      formTeams, resetTeams, setTeamMode, renameTeam, setTeamNameFromLeader, addReplacement, removeReplacement, swapPlayer,
      generateBracket, seedBracket, updateScore, undoMatch, updateThirdPlace, resetBracket, setElimMode,
      addMap, removeMap, moveMapToUsed, restoreUsedMap, appendSpinQueue, clearSpinQueue, removeSpinQueueItem, saveDefaultMaps, saveSpinCategories, assignStage, clearStage,
      assignLeader,
      createFFAMatch, updateFFAScore, removeFFAScore, setFFAScores, setFFAPlayers,
      deleteFFAMatch, lockFFAMatch, updateFFAMapInfo, setFFAMatchImage, setFFAMatchScoreImage,
      setFFAMatchWinners,
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
