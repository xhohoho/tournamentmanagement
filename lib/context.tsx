'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Player, Team, Bracket, ChatMessage, FFAState, FFAMapInfo, FFAPlayerScore, FFAWinner, CasterSheet, CasterMatch } from '@/lib/types';

import type { TourneyContext } from '@/lib/types';

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

// All state fields that can be optimistically guarded against SSE overwrites.
const GUARD_FIELDS = [
  'players', 'roster', 'teamMode', 'teams', 'bracket', 'stageMaps',
  'maps', 'usedMaps', 'spinQueue', 'spinCategories', 'defaultMaps',
  'joinKey', 'queueCap', 'queueLocked', 'chat', 'tickerText', 'ffa', 'casterSheet',
] as const;
type GuardField = typeof GUARD_FIELDS[number];

function makeGuard() {
  const stamps = {} as Record<GuardField, number>;
  return {
    touch(field: GuardField) { stamps[field] = Date.now(); },
    guarded(field: GuardField) { return Date.now() - (stamps[field] ?? 0) < GUARD_MS; },
    clear(field: GuardField) { stamps[field] = 0; },
  };
}

export function TourneyProvider({ children, tournamentId = 'default', initialAdminToken, initialAdminInfo }: { children: React.ReactNode; tournamentId?: string; initialAdminToken?: string; initialAdminInfo?: { adminId: string; name: string; isSuperAdmin: boolean } | null }) {
  const t = encodeURIComponent(tournamentId);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roster, setRosterState] = useState<string[]>([]);
  const [teamMode, setTeamModeState] = useState<'leader' | 'random' | 'manual'>('leader');
  const [teams, setTeams] = useState<Team[]>([]);
  const [stageFormats, setStageFormatsState] = useState<import('@/lib/types').StageFormats>({ upperBracket: 'bo3', lowerBracket: 'bo1', lowerBracketFinal: 'bo3', grandFinal: 'bo5' });
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
  const [queueCap, setQueueCapState] = useState<number>(0);
  const [queueLocked, setQueueLockedState] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [ffa, setFFA] = useState<FFAState>({ matches: [], players: [] });
  const [casterSheet, setCasterSheetState] = useState<CasterSheet>({ matches: [] });
  const [isAdmin, setIsAdminState] = useState(!!initialAdminToken);
  const [previewAsUser, setPreviewAsUserState] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(initialAdminToken ?? null);
  const [adminId, setAdminId] = useState<string | null>(initialAdminInfo?.adminId ?? null);
  const [adminName, setAdminName] = useState<string | null>(initialAdminInfo?.name ?? null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(initialAdminInfo?.isSuperAdmin ?? false);
  const [loading, setLoading] = useState(true);
  const [sseStatus, setSseStatus] = useState<import('@/hooks/useSSE').SSEStatus>('connecting');
  const [tickerText, setTickerTextState] = useState('');
  const [visitorCount, setVisitorCount] = useState(0);
  const [activeAdminCount, setActiveAdminCount] = useState(0);

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
    if (!fromSSE) setStageFormatsState((data.stageFormats as import('@/lib/types').StageFormats) ?? { upperBracket: 'bo3', lowerBracket: 'bo1', lowerBracketFinal: 'bo3', grandFinal: 'bo5' });
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
    if (!fromSSE || !guard.guarded('queueCap'))   setQueueCapState((data.queueCap as number) ?? 0);
    if (!fromSSE || !guard.guarded('queueLocked')) setQueueLockedState((data.queueLocked as boolean) ?? false);
    if (!fromSSE || !guard.guarded('chat'))      setChatMessages(data.chatMessages as ChatMessage[] ?? []);
    if (!fromSSE || !guard.guarded('tickerText')) setTickerTextState(data.tickerText as string ?? '');
    if (!fromSSE || !guard.guarded('ffa'))       setFFA((data.ffa as FFAState) ?? { matches: [], players: [] });
    if (!fromSSE || !guard.guarded('casterSheet')) setCasterSheetState((data.casterSheet as CasterSheet) ?? { matches: [] });

    // Server-driven counts (no optimistic guard needed)
    setVisitorCount(data.visitorCount as number ?? 0);
    setActiveAdminCount(data.activeAdminCount as number ?? 0);

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
        setSseStatus('polling');
        return;
      }
      setSseStatus('connecting');
      es = new EventSource(`/api/state/stream?t=${t}`);
      es.onopen = () => setSseStatus('connected');
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          applySnapshot(data, true);
        } catch { /* ignore malformed frames */ }
        setLoading(false);
        setSseStatus('connected');
      };
      es.onerror = () => {
        es?.close();
        es = null;
        setSseStatus('error');
        if (!pollFallback) {
          pollFallback = setInterval(refresh, 4000);
          setSseStatus('polling');
        }
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

  const setQueueCap = async (cap: number) => {
    guard.touch('queueCap');
    const res = await apiFetch(`/api/players/joinkey?t=${t}`, 'PATCH', { queueCap: cap });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setQueueCapState(data.queueCap ?? 0);
    return {};
  };

  const setQueueLocked = async (locked: boolean) => {
    guard.touch('queueLocked');
    const res = await apiFetch(`/api/players/joinkey?t=${t}`, 'PATCH', { queueLocked: locked });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setQueueLockedState(data.queueLocked ?? false);
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

    // The Teams tab runs a per-member reveal animation after this resolves
    // (~120ms per member). Keep the 'teams' guard alive for the full duration
    // so a mid-animation SSE poll can't briefly wipe the just-formed teams
    // before the reveal finishes. Re-touch repeatedly rather than once, in
    // case a touch lands right before an SSE message is already in flight.
    const formedTeams = (data.teams as import('@/lib/types').Team[]) ?? [];
    const memberCount = formedTeams.reduce((sum: number, team: import('@/lib/types').Team) => sum + team.members.length, 0);
    const animationMs = memberCount * 120 + 1000; // matches useReveal's 120ms/slot + buffer
    const reTouchCount = Math.ceil(animationMs / GUARD_MS) + 1;
    for (let i = 1; i <= reTouchCount; i++) {
      setTimeout(() => guard.touch('teams'), i * (GUARD_MS - 200));
    }

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

  const manualSeedSlot = async (section: string, ri: number, mi: number, slot: 1 | 2, team: string | null) => {
    guard.touch('bracket');
    const res = await apiFetch(`/api/bracket?t=${t}`, 'PATCH', { action: 'manualSeed', section, ri, mi, slot, team });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    setBracket(data.bracket);
    return {};
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
    const prev = usedMaps;
    setUsedMaps(name ? (prev => prev.filter(m => m !== name)) : []);
    try {
      const res = await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'restoreUsed', ...(name ? { map: name } : {}) });
      if (res.ok) {
        const data = await res.json();
        guard.touch('usedMaps');
        setUsedMaps(data.usedMaps ?? []);
      } else {
        // Revert optimistic update on failure
        setUsedMaps(prev);
      }
    } catch {
      // Revert optimistic update on network error
      setUsedMaps(prev);
    }
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
    const prev = spinQueue;
    const newQ = prev.filter((_, i) => i !== idx);
    setSpinQueue(newQ); // optimistic update
    const res = await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'updateSpinQueue', spinQueue: newQ });
    if (!res.ok) {
      setSpinQueue(prev); // rollback on server error
      guard.clear('spinQueue');
    }
  };

  const clearSpinQueue = async () => {
    guard.touch('spinQueue'); guard.touch('usedMaps');
    const prevQueue = spinQueue;
    const prevUsed = usedMaps;
    setSpinQueue([]);
    setUsedMaps([]);
    try {
      const res = await apiFetch(`/api/maps?t=${t}`, 'PATCH', { action: 'clearAll' });
      if (res.ok) {
        const data = await res.json();
        guard.touch('usedMaps');
        setUsedMaps(data.usedMaps ?? []);
        guard.touch('spinQueue');
        setSpinQueue(data.spinQueue ?? []);
      } else {
        setSpinQueue(prevQueue);
        setUsedMaps(prevUsed);
      }
    } catch {
      setSpinQueue(prevQueue);
      setUsedMaps(prevUsed);
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

  // ── Caster Sheet ──────────────────────────────────────────────────────────
  // Returns normally on success, throws on network/server error so the UI can
  // show a "Save failed" warning instead of silently losing data.
  const setCasterSheet = async (matches: CasterMatch[]) => {
    guard.touch('casterSheet');
    setCasterSheetState({ matches }); // optimistic update
    let res: Response;
    try {
      res = await apiFetch(`/api/caster?t=${t}`, 'PUT', { matches });
    } catch (err) {
      // Network failure — roll back optimistic update so SSE restores real state
      guard.clear('casterSheet');
      throw new Error('Network error — note not saved. Check your connection.');
    }
    if (!res.ok) {
      guard.clear('casterSheet');
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Server error ${res.status} — note not saved.`);
    }
    const data = await res.json();
    guard.touch('casterSheet');
    if (data.casterSheet) setCasterSheetState(data.casterSheet);
  };

  const resetAll = async () => {
    (['players','roster','teams','bracket','maps','usedMaps','stageMaps','joinKey','queueCap','queueLocked','chat','spinQueue','spinCategories','defaultMaps','ffa'] as const satisfies readonly GuardField[]).forEach(f => guard.touch(f));
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
      spinCategories, spinItemCategory, defaultMaps, stageFormats, ffa, casterSheet,
      tournamentId,
      joinKey, chatMessages,
      queueCap, queueLocked,
      isAdmin: isAdmin && !previewAsUser, previewAsUser, adminToken, adminId, adminName, isSuperAdmin, loading, sseStatus, tickerText,
      visitorCount, activeAdminCount,
      setIsAdmin, setPreviewAsUser: setPreviewAsUserState, setAdminToken: setAdminTokenPublic, setAdminInfo, refresh, setTickerText, setStageFormats,
      submitPlayer, removePlayer, renamePlayer, addToRoster, removeFromRoster,
      setRoster, clearQueue, clearRoster,
      setJoinKey, setQueueCap, setQueueLocked,
      sendChat, clearChat,
      formTeams, resetTeams, setTeamMode, renameTeam, setTeamNameFromLeader, addReplacement, removeReplacement, swapPlayer,
      generateBracket, seedBracket, manualSeedSlot, updateScore, undoMatch, updateThirdPlace, resetBracket, setElimMode,
      addMap, removeMap, moveMapToUsed, restoreUsedMap, appendSpinQueue, clearSpinQueue, removeSpinQueueItem, saveDefaultMaps, saveSpinCategories, assignStage, clearStage,
      assignLeader,
      createFFAMatch, updateFFAScore, removeFFAScore, setFFAScores, setFFAPlayers,
      deleteFFAMatch, lockFFAMatch, updateFFAMapInfo, setFFAMatchImage, setFFAMatchScoreImage,
      setFFAMatchWinners,
      setCasterSheet,
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
