export interface Player {
  name: string;
  byAdmin: boolean;
  addedAt: number;
}

export interface Team {
  name: string;
  color: string;
  leader: string | null;
  members: string[];
}

export interface BracketMatch {
  p1: string | null;
  p2: string | null;
  winner: string | null;
  score1: number;   // wins for p1
  score2: number;   // wins for p2
  format: 'bo1' | 'bo3'; // best-of
}

export interface GrandFinal {
  p1: string | null;
  p2: string | null;
  winner: string | null;
  score1: number;
  score2: number;
  format: 'bo1' | 'bo3';
}

export interface Bracket {
  type: 'single' | 'double';
  upper: BracketMatch[][];
  lower?: BracketMatch[][];
  grandFinal?: GrandFinal;
  thirdPlace?: BracketMatch;  // single elim only, 4+ teams
  champion: string | null;
  third?: string | null;      // 3rd place winner
}

/** Full state stored in KV — never sent to the client as-is. */
export interface ServerState {
  adminPwHash: string;
  players: Player[];
  roster: string[];
  teamMode: 'leader' | 'random';
  teams: Team[];
  elimMode: 'single' | 'double';
  bracket: Bracket | null;
  maps: string[];
  stageMaps: Record<string, string[]>; // key -> up to 3 map names (BO3)
}

/**
 * Public state returned from /api/state — identical to ServerState
 * but with sensitive server-only fields omitted.
 */
export type ClientState = Omit<ServerState, 'adminPwHash'>;

/**
 * @deprecated Use ServerState instead. Kept as an alias so existing
 * server-side code that imports TournamentState continues to compile.
 */
export type TournamentState = ServerState;

export type TabId = 'players' | 'teams' | 'bracket' | 'maps';
