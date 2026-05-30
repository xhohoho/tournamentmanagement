'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Player, Team, Bracket, ChatMessage } from '@/lib/types';

interface TourneyContext {
  players: Player[];
  roster: string[];
  teamMode: 'leader' | 'random' | 'manual';
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
  stageFormats: import('@/lib/types').StageFormats;
  isAdmin: boolean;
  previewAsUser: boolean;
  adminToken: string | null;
  loading: boolean;
  tickerText: string;

  joinKey: string;
  chatMessages: ChatMessage[];

  setIsAdmin: (v: boolean) => void;
  setPreviewAsUser: (v: boolean) => void;
  setAdminToken: (token: string | null) => void;
  setStageFormats: (sf: import('@/lib/types').StageFormats) => Promise<void>;
  refresh: () => Promise<void>;
  setTickerText: (text: string) => Promise<void>;

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

  formTeams: (leaders?: string[], manualTeams?: import('@/lib/types').ManualTeamAssignment[]) => Promise<{ error?: string; teams?: Team[] }>;
  resetTeams: () => Promise<void>;
  setTeamMode: (mode: 'leader' | 'random' | 'manual') => Promise<void>;
  renameTeam: (teamId: string, customName: string) => Promise<{ error?: string }>;
  setTeamNameFromLeader: (teamId: string) => Promise<{ error?: string }>;
  addReplacement: (teamId: string, originalName: string, replacementName: string) => Promise<{ error?: string }>;
  removeReplacement: (teamId: string, originalName: string) => Promise<{ error?: string }>;

  generateBracket: (sf?: import('@/lib/types').StageFormats) => Promise<{ error?: string }>;
  seedBracket: (sf?: import('@/lib/types').StageFormats) => Promise<{ error?: string; shuffleState?: import('@/lib/types').ShuffleState | null }>;
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

// ─── shuffleState merge ───────────────────────────────────────────────────────
// Keeps the local animation running while the admin's own client owns it.
// Other clients (viewers) accept SSE immediately.
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
      return prev; // keep running locally
    }
    return null;
  }
  if (localRef.current === next.startTime) return prev ?? next;
  if (!prev) return next;
  return prev.startTime === next.startTime ? prev : next;
}

// ─── SSE guard ────────────────────────────────────────────────────────────────
// After any admin mutation we record a timestamp. SSE events that arrive
// within GUARD_MS of that timestamp for the same field are skipped — the
// local state from the API response is already correct and newer.
// This replaces the fragile boolean-ref flags that could drop events.
const GUARD_MS = 1500;

function makeGuard() {
  const stamps: Record<string, number> = {};
  return {
    /** Call before applying an admin mutation locally. */
    touch(field: string) { stamps[field] = Date.now(); },
    /** Returns true if SSE should be skipped for this field. */
    guarded(field: string) { return Date.now() - (stamps[field] ?? 0) < GUARD_MS; },
    /** Reset a specific field guard early (e.g. on confirmed server round-trip). */
    clear(field: string) { stamps[field] = 0; },
  };
}

export function TourneyProvider({ children, tournamentId = 'default', initialAdminToken }: { children: React.ReactNode; tournamentId?: string; initialAdminToken?: string }) {
  const t = encodeURIComponent(tournamentId);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roster, setRosterState] = useState<string[]>([]);
  const [teamMode, setTeamModeState] = useState<'leader' | 'random' | 'manual'>('leader');
  const [teams, setTeams] = useState<Team[]>([]);
  const [stageFormats, setStageFormatsState] = useState<import('@/lib/types').StageFormats>({ groupStage: 'bo1', semiFinal: 'bo3', grandFinal: 'bo3' });
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
  const [isAdmin, setIsAdminState] = useState(!!initialAdminToken);
  const [previewAsUser, setPreviewAsUserState] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(initialAdminToken ?? null);
  const [loading, setLoading] = useState(true);
  const [tickerText, setTickerTextState] = useState('');

  // Single guard instance shared across all mutations.
  const guard = useRef(makeGuard()).current;

  // Holds the startTime of a shuffle triggered by THIS client.
  const localShuffleStartTimeRef = useRef<number | null>(null);

  const adminHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
  }), [adminToken]);

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
    }
  };

  const setAdminTokenPublic = (token: string | null) => setAdminToken(token);

  // ── Hydrate all state from a server snapshot ──────────────────────────────
  // Used by both initial fetch and SSE onmessage.
  // Each field is gated by the guard so a recent local mutation is not
  // immediately overwritten by a lagging SSE event.
  const applySnapshot = useCallback((data: Record<string, unknown>, fromSSE = false) => {
    if (!fromSSE || !guard.guarded('players'))   setPlayers(data.players as Player[] ?? []);
    if (!fromSSE || !guard.guarded('roster'))    setRosterState(data.roster as string[] ?? []);
    if (!fromSSE || !guard.guarded('teamMode'))  setTeamModeState((data.teamMode as 'leader' | 'random' | 'manual') ?? 'leader');
    // stageFormats and elimMode are admin-only controls — never overwrite from SSE.
    // They are seeded once on initial fetch (fromSSE=false) and owned locally after that.
    if (!fromSSE) setStageFormatsState((data.stageFormats as import('@/lib/types').StageFormats) ?? { groupStage: 'bo1', semiFinal: 'bo3', grandFinal: 'bo3' });
    if (!fromSSE) setElimModeState((data.elimMode as 'single' | 'double') ?? 'single');
    if (!fromSSE || !guard.guarded('teams'))     setTeams(data.teams as Team[] ?? []);
    if (!fromSSE || !guard.guarded('bracket'))   setBracket((data.bracket as Bracket | null) ?? null);
    if (!fromSSE || !guard.guarded('maps'))      setMaps(data.maps as string[] ?? []);
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

    // spinState: always accept (driven by server spin animation)
    setSpinState(data.spinState as import('@/lib/types').SpinState | null ?? null);

    // shuffleState: custom merge to protect local animation
    setShuffleState(prev =>
      applyShuffleState(prev, data.shuffleState as import('@/lib/types').ShuffleState | null ?? null, localShuffleStartTimeRef)
    );
  }, [guard]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?t=${t}`);
      const data = await res.json();
      applySnapshot(data, false); // full refresh ignores guards
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
          applySnapshot(data, true); // SSE path — guards active
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
    // Non-admin action — no guard needed, apply directly
    setPlayers(data.players);
    return {};
  };

  const removePlayer = async (name: string) => {
    guard.touch('players'); guard.touch('roster');
    const res = await fetch(`/api/players?t=${t}`, {
      method: 'DELETE',
      headers: adminHeaders,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setPlayers(data.players);
    setRosterState(data.roster);
  };

  const addToRoster = async (name: string) => {
    guard.touch('roster');
    const res = await fetch(`/api/players?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'addToRoster', name }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const removeFromRoster = async (name: string) => {
    guard.touch('roster');
    const res = await fetch(`/api/players?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'removeFromRoster', name }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const setRoster = async (names: string[]) => {
    guard.touch('roster');
    const res = await fetch(`/api/players?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'setRoster', roster: names }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  const clearQueue = async () => {
    guard.touch('players'); guard.touch('roster');
    const res = await fetch(`/api/players?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'clearQueue' }),
    });
    const data = await res.json();
    setPlayers(data.players);
    setRosterState(data.roster);
  };

  const clearRoster = async () => {
    guard.touch('roster');
    const res = await fetch(`/api/players?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'clearRoster' }),
    });
    const data = await res.json();
    setRosterState(data.roster);
  };

  // ── Join Key ──────────────────────────────────────────────────────────────
  const setJoinKey = async (key: string) => {
    guard.touch('joinKey');
    const res = await fetch(`/api/players/joinkey?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ joinKey: key }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setJoinKeyState(data.joinKey ?? '');
    return {};
  };

  // ── Chat ──────────────────────────────────────────────────────────────────
  const sendChat = async (name: string, text: string) => {
    // No guard — non-admin, apply immediately so sender sees their message
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
    const res = await fetch(`/api/chat?t=${t}`, { method: 'DELETE', headers: adminHeaders });
    const data = await res.json();
    setChatMessages(data.messages);
  };

  // ── Teams ─────────────────────────────────────────────────────────────────
  const formTeams = async (leaders?: string[], manualTeams?: import('@/lib/types').ManualTeamAssignment[]) => {
    guard.touch('teams'); guard.touch('bracket');
    const res = await fetch(`/api/teams?t=${t}`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ teamMode, leaders, manualTeams }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    setBracket(null);
    return { teams: data.teams };
  };

  const assignLeader = async (teamId: string, playerName: string) => {
    guard.touch('teams');
    try {
      const res = await fetch(`/api/teams?t=${t}`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ assignments: { [teamId]: playerName } }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Server rejected leader assignment.' };
      setTeams(data.teams);
      return {};
    } catch {
      // Optimistic fallback on network failure
      setTeams(prevTeams =>
        prevTeams.map(t => t.name === teamId ? { ...t, leader: playerName } : t)
      );
      return { error: 'Network failure. Leader assigned locally, but not saved to cloud database.' };
    }
  };

  const resetTeams = async () => {
    guard.touch('teams'); guard.touch('bracket');
    await fetch(`/api/teams?t=${t}`, { method: 'DELETE', headers: adminHeaders });
    setTeams([]);
    setBracket(null);
  };

  const setTeamMode = async (mode: 'leader' | 'random' | 'manual') => {
    guard.touch('teamMode');
    setTeamModeState(mode); // optimistic — instant UI feedback
    await fetch(`/api/teams?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ teamMode: mode }),
    });
  };

  const renameTeam = async (teamId: string, customName: string) => {
    guard.touch('teams');
    const res = await fetch(`/api/teams?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'renameTeam', teamId, customName }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    return {};
  };

  const setTeamNameFromLeader = async (teamId: string) => {
    guard.touch('teams');
    const res = await fetch(`/api/teams?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'setTeamNameFromLeader', teamId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    return {};
  };

  const addReplacement = async (teamId: string, originalName: string, replacementName: string) => {
    guard.touch('teams');
    const res = await fetch(`/api/teams?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'addReplacement', teamId, originalName, replacementName }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    return {};
  };

  const removeReplacement = async (teamId: string, originalName: string) => {
    guard.touch('teams');
    const res = await fetch(`/api/teams?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'removeReplacement', teamId, originalName }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setTeams(data.teams);
    return {};
  };

  // ── Bracket ───────────────────────────────────────────────────────────────
  const setStageFormats = async (sf: import('@/lib/types').StageFormats) => {
    setStageFormatsState(sf);
    await fetch(`/api/bracket?t=${t}`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ elimMode, action: 'saveFormats', stageFormats: sf }),
    });
  };

  const generateBracket = async (sf?: import('@/lib/types').StageFormats) => {
    guard.touch('bracket');
    const res = await fetch(`/api/bracket?t=${t}`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ elimMode, matchFormat: 'bo1', action: 'generate', stageFormats: sf ?? stageFormats }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setBracket(data.bracket);
    return {};
  };

  const seedBracket = async (sf?: import('@/lib/types').StageFormats) => {
    guard.touch('bracket');
    const res = await fetch(`/api/bracket?t=${t}`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ elimMode, matchFormat: 'bo1', action: 'seed', stageFormats: sf ?? stageFormats }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setBracket(data.bracket);
    // Register this client as owner of the shuffle animation
    if (data.shuffleState?.startTime) {
      localShuffleStartTimeRef.current = data.shuffleState.startTime;
    }
    return { shuffleState: data.shuffleState ?? null };
  };

  const updateScore = async (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => {
    guard.touch('bracket');
    const res = await fetch(`/api/bracket?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ section, ri, mi, p1wins, p2wins }),
    });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const undoMatch = async (section: string, ri: number, mi: number) => {
    guard.touch('bracket');
    const res = await fetch(`/api/bracket?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'undoMatch', section, ri, mi }),
    });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const updateThirdPlace = async (p1wins: number, p2wins: number) => {
    guard.touch('bracket');
    const res = await fetch(`/api/bracket?t=${t}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ p1wins, p2wins }),
    });
    const data = await res.json();
    setBracket(data.bracket);
  };

  const resetBracket = async () => {
    guard.touch('bracket'); guard.touch('stageMaps');
    await fetch(`/api/bracket?t=${t}`, { method: 'DELETE', headers: adminHeaders });
    setBracket(null);
    setStageMaps({});
  };

  const setElimMode = async (mode: 'single' | 'double') => {
    setElimModeState(mode);
    await fetch(`/api/bracket?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'setElimMode', elimMode: mode }),
    });
  };

  // ── Maps ──────────────────────────────────────────────────────────────────
  const addMap = async (name: string) => {
    guard.touch('maps');
    const res = await fetch(`/api/maps?t=${t}`, {
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
    guard.touch('maps'); guard.touch('stageMaps');
    const res = await fetch(`/api/maps?t=${t}`, {
      method: 'DELETE',
      headers: adminHeaders,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setMaps(data.maps);
    setStageMaps(data.stageMaps);
  };

  const appendSpinQueue = async (map: string) => {
    // Optimistic — add immediately so the spinner feels instant
    guard.touch('spinQueue');
    setSpinQueue(prev => [...prev, map]);
    try {
      const res = await fetch(`/api/maps?t=${t}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ action: 'appendSpinQueue', map }),
      });
      if (res.ok) {
        const data = await res.json();
        // Reconcile with server's authoritative list
        guard.touch('spinQueue');
        setSpinQueue(data.spinQueue);
      } else {
        // Revert optimistic update
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
      fetch(`/api/maps?t=${t}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ action: 'updateSpinQueue', spinQueue: newQ }),
      });
      return newQ;
    });
  };

  const clearSpinQueue = async () => {
    guard.touch('spinQueue');
    setSpinQueue([]);
    await fetch(`/api/maps?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'updateSpinQueue', spinQueue: [] }),
    });
  };

  const saveDefaultMaps = async (starred: string[]) => {
    guard.touch('defaultMaps');
    setDefaultMaps(starred);
    await fetch(`/api/maps?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'updateDefaultMaps', defaultMaps: starred }),
    });
  };

  const saveSpinCategories = async (cats: string[], itemCat: Record<number, string>) => {
    guard.touch('spinCategories');
    setSpinCategories(cats);
    setSpinItemCategory(itemCat);
    await fetch(`/api/maps?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'updateSpinCategories', spinCategories: cats, spinItemCategory: itemCat }),
    });
  };

  const assignStage = async (stageKey: string, mapName: string, slot = 0) => {
    guard.touch('stageMaps');
    const res = await fetch(`/api/maps?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'assignStage', stageKey, mapName, slot }),
    });
    const data = await res.json();
    setStageMaps(data.stageMaps);
  };

  const clearStage = async (stageKey: string, slot?: number) => {
    guard.touch('stageMaps');
    const res = await fetch(`/api/maps?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'clearStage', stageKey, slot }),
    });
    const data = await res.json();
    setStageMaps(data.stageMaps);
  };

  const setTickerText = async (text: string) => {
    guard.touch('tickerText');
    setTickerTextState(text); // optimistic
    await fetch(`/api/ticker?t=${t}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ tickerText: text }),
    });
  };

  const resetAll = async () => {
    // Touch everything so SSE from the reset doesn't race with local clear
    ['players','roster','teams','bracket','stageMaps','joinKey','chat','spinQueue','spinCategories','defaultMaps'].forEach(f => guard.touch(f));
    await fetch(`/api/reset?t=${t}`, { method: 'DELETE', headers: adminHeaders });
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
    setShuffleState(null);
  };

  return (
    <Ctx.Provider value={{
      players, roster, teamMode, teams, elimMode, bracket, maps, stageMaps, spinState, shuffleState, spinQueue,
      spinCategories, spinItemCategory, defaultMaps, stageFormats,
      joinKey, chatMessages,
      isAdmin: isAdmin && !previewAsUser, previewAsUser, adminToken, loading, tickerText,
      setIsAdmin, setPreviewAsUser: setPreviewAsUserState, setAdminToken: setAdminTokenPublic, refresh, setTickerText, setStageFormats,
      submitPlayer, removePlayer, addToRoster, removeFromRoster,
      setRoster, clearQueue, clearRoster,
      setJoinKey,
      sendChat, clearChat,
      formTeams, resetTeams, setTeamMode, renameTeam, setTeamNameFromLeader, addReplacement, removeReplacement,
      generateBracket, seedBracket, updateScore, undoMatch, updateThirdPlace, resetBracket, setElimMode,
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
