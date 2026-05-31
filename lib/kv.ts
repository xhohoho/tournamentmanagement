import { kv } from '@vercel/kv';
import type { TournamentState, AdminAccount } from './types';

// ─── Admin accounts ───────────────────────────────────────────────────────────
const ADMIN_ACCOUNTS_KEY = 'admin:accounts';

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  try {
    return (await kv.get<AdminAccount[]>(ADMIN_ACCOUNTS_KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function getAdminAccount(adminId: string): Promise<AdminAccount | null> {
  const list = await listAdminAccounts();
  return list.find(a => a.adminId === adminId) ?? null;
}

export async function getAdminAccountByName(name: string): Promise<AdminAccount | null> {
  const list = await listAdminAccounts();
  return list.find(a => a.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export async function saveAdminAccount(account: AdminAccount): Promise<AdminAccount[]> {
  const list = await listAdminAccounts();
  const existing = list.findIndex(a => a.adminId === account.adminId);
  const next = existing >= 0
    ? list.map(a => a.adminId === account.adminId ? account : a)
    : [...list, account];
  await kv.set(ADMIN_ACCOUNTS_KEY, next);
  return next;
}

export async function deleteAdminAccount(adminId: string): Promise<AdminAccount[]> {
  const list = await listAdminAccounts();
  const next = list.filter(a => a.adminId !== adminId);
  await kv.set(ADMIN_ACCOUNTS_KEY, next);
  return next;
}

// ─── Tournament registry ───────────────────────────────────────────────────────
const REGISTRY_KEY = 'tournament:registry';

export interface TournamentMeta {
  id: string;
  name: string;
  createdAt: number;
  ownerAdminId: string;   // which admin account created this tournament
  posterUrl?: string;
  tournamentDate?: number;
  organizer?: string;
}

export async function listTournaments(): Promise<TournamentMeta[]> {
  try {
    return (await kv.get<TournamentMeta[]>(REGISTRY_KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function registerTournament(
  id: string,
  name: string,
  ownerAdminId: string,
  posterUrl?: string,
  tournamentDate?: number,
  organizer?: string,
): Promise<TournamentMeta[]> {
  const list = await listTournaments();
  if (list.find(t => t.id === id)) return list;
  const entry: TournamentMeta = { id, name, ownerAdminId, createdAt: Date.now() };
  if (posterUrl) entry.posterUrl = posterUrl;
  if (tournamentDate) entry.tournamentDate = tournamentDate;
  if (organizer) entry.organizer = organizer;
  const next = [...list, entry];
  await kv.set(REGISTRY_KEY, next);
  return next;
}

export async function updateTournamentMeta(
  id: string,
  patch: Partial<Pick<TournamentMeta, 'name' | 'posterUrl' | 'tournamentDate' | 'organizer'>>,
): Promise<TournamentMeta[]> {
  const list = await listTournaments();
  const next = list.map(t => t.id === id ? { ...t, ...patch } : t);
  await kv.set(REGISTRY_KEY, next);
  return next;
}

export async function deleteTournamentFromRegistry(id: string): Promise<TournamentMeta[]> {
  const list = await listTournaments();
  const next = list.filter(t => t.id !== id);
  await kv.set(REGISTRY_KEY, next);
  return next;
}

// ─── Per-tournament KV key ─────────────────────────────────────────────────────
function kvKey(tournamentId: string) {
  const safe = tournamentId.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
  return `tournament:state:${safe || 'default'}`;
}

// ─── Default state ─────────────────────────────────────────────────────────────
export function defaultState(): TournamentState {
  return {
    players: [],
    roster: [],
    teamMode: 'leader',
    teams: [],
    elimMode: 'single',
    bracket: null,
    maps: [],
    stageMaps: {},
    joinKey: '',
    chatMessages: [],
    defaultMaps: [],
    spinQueue: [],
    spinState: null,
    shuffleState: null,
    spinCategories: [],
    spinItemCategory: {},
    tickerText: 'Shop : https://suddenattack.safie.cc',
    stageFormats: { groupStage: 'bo1', semiFinal: 'bo3', grandFinal: 'bo3' },
  };
}

// ─── Read / write ──────────────────────────────────────────────────────────────
export async function getState(tournamentId = 'default'): Promise<TournamentState> {
  try {
    const data = await kv.get<TournamentState>(kvKey(tournamentId));
    if (!data) return defaultState();
    return { ...defaultState(), ...data };
  } catch {
    return defaultState();
  }
}

export async function setState(state: TournamentState, tournamentId = 'default'): Promise<void> {
  await kv.set(kvKey(tournamentId), state);
}

export async function updateState(
  updater: (s: TournamentState) => TournamentState,
  tournamentId = 'default',
): Promise<TournamentState> {
  const KEY = kvKey(tournamentId);
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const raw = await kv.get<TournamentState & { _v?: number }>(KEY);
    const current: TournamentState = raw ? { ...defaultState(), ...raw } : defaultState();
    const version = raw?._v ?? 0;
    const next = { ...updater(current), _v: version + 1 };

    const luaScript = `
      local val = redis.call('GET', KEYS[1])
      if val == false then
        if tonumber(ARGV[2]) == 0 then
          redis.call('SET', KEYS[1], ARGV[1])
          return 1
        else
          return 0
        end
      end
      local ok, obj = pcall(cjson.decode, val)
      if not ok then return 0 end
      local currentV = tonumber(obj['_v']) or 0
      if currentV ~= tonumber(ARGV[2]) then return 0 end
      redis.call('SET', KEYS[1], ARGV[1])
      return 1
    `;

    const result = await kv.eval(luaScript, [KEY], [JSON.stringify(next), String(version)]);
    if (result === 1) return next;
    await new Promise(r => setTimeout(r, 10 + Math.random() * 40 * (attempt + 1)));
  }

  const current = await getState(tournamentId);
  const next = updater(current);
  await setState(next, tournamentId);
  return next;
}

// ─── Delete a tournament's state entirely ──────────────────────────────────────
export async function deleteTournamentState(tournamentId: string): Promise<void> {
  await kv.del(kvKey(tournamentId));
  await deleteTournamentFromRegistry(tournamentId);
}
