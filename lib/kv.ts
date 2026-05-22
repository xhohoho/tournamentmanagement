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
  const current = await getState();
  const next = updater(current);
  await setState(next);
  return next;
}
