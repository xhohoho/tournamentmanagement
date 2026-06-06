import { kv } from '@vercel/kv';
import type { ServerState, AdminAccount, ClientState } from './types';

// ─── Admin accounts ───────────────────────────────────────────────────────────
const ADMIN_ACCOUNTS_KEY = 'admin:accounts';

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  try {
    return (await kv.get<AdminAccount[]>(ADMIN_ACCOUNTS_KEY)) ?? [];
  } catch (err) {
    console.error('[kv] listAdminAccounts error:', err);
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
  // Guard: scrypt hashes always contain ':' — a bare string means something went wrong
  if (!account.pwHash.includes(':')) {
    throw new Error(`[kv] saveAdminAccount: pwHash for "${account.name}" is not a valid scrypt hash (missing ':' separator)`);
  }
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
  ownerAdminId: string;        // which admin account created this tournament
  collaborators: string[];     // additional adminIds granted access by super admin
  posterUrl?: string;
  tournamentDate?: number;
  organizer?: string;
}

export async function listTournaments(): Promise<TournamentMeta[]> {
  try {
    const list = (await kv.get<TournamentMeta[]>(REGISTRY_KEY)) ?? [];
    // Check if any legacy backfill is needed (missing ownerAdminId or collaborators).
    const needsBackfill = list.some(t => !t.ownerAdminId || !t.collaborators);
    if (!needsBackfill) return list;
    // Find the first super admin to use as fallback owner for ownerless tournaments.
    const accounts = await listAdminAccounts();
    const superAdmin = accounts.find(a => a.isSuperAdmin);
    const backfilled = list.map(t => ({
      ...t,
      collaborators: t.collaborators ?? [],
      ownerAdminId: t.ownerAdminId || superAdmin?.adminId || '',
    }));
    // Persist the backfill so this only runs once.
    await kv.set(REGISTRY_KEY, backfilled);
    return backfilled;
  } catch (err) {
    console.error('[kv] listTournaments error:', err);
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
  const entry: TournamentMeta = { id, name, ownerAdminId, collaborators: [], createdAt: Date.now() };
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

export async function updateTournamentCollaborators(
  id: string,
  collaborators: string[],
): Promise<TournamentMeta[]> {
  const list = await listTournaments();
  const next = list.map(t => t.id === id ? { ...t, collaborators } : t);
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
export function defaultState(): ServerState {
  return {
    players: [],
    roster: [],
    teamMode: 'leader',
    teams: [],
    elimMode: 'single',
    bracket: null,
    maps: [],
    usedMaps: [],
    stageMaps: {},
    joinKey: '',
    queueCap: 0,
    queueLocked: false,
    chatMessages: [],
    defaultMaps: [],
    spinQueue: [],
    spinState: null,
    shuffleState: null,
    spinCategories: [],
    spinItemCategory: {},
    tickerText: 'Shop : https://suddenattack.safie.cc',
    stageFormats: { groupStage: 'bo1', semiFinal: 'bo3', grandFinal: 'bo3' },
    ffa: { matches: [], players: [] },
    visitorCount: 0,
    activeAdmins: [],
  };
}

/**
 * Strip server-only fields before sending state to any client.
 * Use this in every GET/SSE handler instead of destructuring adminPwHash manually.
 */
export function safeState(s: ServerState): ClientState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { adminPwHash: _pwHash, ownerAdminId: _ownerId, ...safe } = s;
  return safe;
}

// ─── Read / write ──────────────────────────────────────────────────────────────
export async function getState(tournamentId = 'default'): Promise<ServerState> {
  try {
    const data = await kv.get<ServerState>(kvKey(tournamentId));
    if (!data) return defaultState();
    return { ...defaultState(), ...data };
  } catch (err) {
    console.error('[kv] getState error:', err);
    return defaultState();
  }
}

export async function setState(state: ServerState, tournamentId = 'default'): Promise<void> {
  await kv.set(kvKey(tournamentId), state);
}

export async function updateState(
  updater: (s: ServerState) => ServerState,
  tournamentId = 'default',
): Promise<ServerState> {
  const KEY = kvKey(tournamentId);
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const raw = await kv.get<ServerState & { _v?: number }>(KEY);
    const current: ServerState = raw ? { ...defaultState(), ...raw } : defaultState();
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
    console.warn('[kv] updateState retry', attempt + 1, 'for', tournamentId);
    await new Promise(r => setTimeout(r, 10 + Math.random() * 40 * (attempt + 1)));
  }

  console.error('[kv] updateState fallback after 5 retries for', tournamentId);
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
