import { kv } from '@vercel/kv';
import type { TournamentState } from './types';
const KV_KEY = 'tournament:state';

export function defaultState(): TournamentState {
  return {
    adminPwHash: 'c4fbc127ee7664d0d392c796504b255b:4f7a69bcceab7a62f082ca3e039803f0e80adf19819e83650ea5e0e7c179614de28e452ee8d32966f1c117c9fee7f1f1532e9e932806c6d73c0d7931d6b4b067',
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
    spinCategories: [],
    spinItemCategory: {},
  };
}
export async function getState(): Promise<TournamentState> {
  try {
    const data = await kv.get<TournamentState>(KV_KEY);
    if (!data) return defaultState();
    return { ...defaultState(), ...data };
  } catch {
    return defaultState();
  }
}
export async function setState(state: TournamentState): Promise<void> {
  await kv.set(KV_KEY, state);
}
export async function updateState(updater: (s: TournamentState) => TournamentState): Promise<TournamentState> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Read current state plus its version stamp.
    // The version stamp lets us detect if another request wrote between our
    // read and our write — eliminating the race that caused removed maps
    // (and other fields) to silently reappear after concurrent writes.
    const raw = await kv.get<TournamentState & { _v?: number }>(KV_KEY);
    const current: TournamentState = raw ? { ...defaultState(), ...raw } : defaultState();
    const version = raw?._v ?? 0;
    const next = { ...updater(current), _v: version + 1 };
    // SET with NX is not what we want; instead use a Lua script for CAS
    // (compare-and-swap on _v). Upstash/Vercel KV exposes kv.eval().
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
    const result = await kv.eval(luaScript, [KV_KEY], [JSON.stringify(next), String(version)]);
    if (result === 1) return next;
    // Lost the race — back off briefly and retry with fresh state
    await new Promise(r => setTimeout(r, 10 + Math.random() * 40 * (attempt + 1)));
  }
  // Fallback: best-effort non-atomic write after all retries exhausted
  const current = await getState();
  const next = updater(current);
  await setState(next);
  return next;
}
