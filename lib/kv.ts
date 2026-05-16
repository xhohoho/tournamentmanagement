import { kv } from '@vercel/kv';
import type { TournamentState } from './types';

const KV_KEY = 'tournament:state';

export function defaultState(): TournamentState {
  return {
    adminPwHash: 'admin123', // plain for now; hash on first set
    players: [],
    roster: [],
    teamMode: 'leader',
    teams: [],
    elimMode: 'single',
    bracket: null,
    maps: [],
    stageMaps: {},
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

export async function updateState(
  updater: (s: TournamentState) => TournamentState
): Promise<TournamentState> {
  const current = await getState();
  const next = updater(current);
  await setState(next);
  return next;
}
