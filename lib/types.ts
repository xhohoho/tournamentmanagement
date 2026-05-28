export interface Player {
  name: string;
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
  /** True when the lower-bracket finalist won GF1, triggering a reset match (GF2). */
  isReset?: boolean;
  /** Scores for the reset match (GF2). */
  resetScore1?: number;
  resetScore2?: number;
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

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  ts: number;
}

/** Broadcast spin animation state so all users can mirror the admin's wheel. */
export interface SpinState {
  spinning: boolean;
  startAngle: number;
  targetAngle: number;
  startTime: number;   // Date.now() when admin pressed SPIN
  duration: number;    // ms — same value used by admin
  result: string;      // winning map (set when spin completes)
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
  joinKey: string;          // empty string = no key required
  chatMessages: ChatMessage[];
  defaultMaps: string[];     // maps that are always restored after reset
  spinQueue: string[];
  spinState: SpinState | null;  // live spin broadcast
  spinCategories: string[];              // ordered category names
  spinItemCategory: Record<number, string>; // spinQueue index -> category name
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

export type TabId = 'players' | 'teams' | 'bracket' | 'maps' | 'chat';
