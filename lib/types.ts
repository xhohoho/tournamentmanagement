// ─── Admin accounts ───────────────────────────────────────────────────────────
export interface AdminAccount {
  adminId: string;       // e.g. "admin_abc123"
  name: string;          // display name, e.g. "Alice"
  pwHash: string;        // scrypt hash
  isSuperAdmin?: boolean; // can edit any tournament regardless of ownership
  createdAt: number;
}

export interface Player {
  name: string;
  addedAt: number;
}

export interface Team {
  name: string;
  color: string;
  leader: string | null;
  members: string[];
  /** customName overrides the display name (e.g. set manually or from leader) */
  customName?: string;
  /** replacements maps original member name -> replacement name */
  replacements?: Record<string, string>;
}

export interface BracketMatch {
  p1: string | null;
  p2: string | null;
  winner: string | null;
  score1: number;   // wins for p1
  score2: number;   // wins for p2
  format: 'bo1' | 'bo3' | 'bo5'; // best-of
}

export interface GrandFinal {
  p1: string | null;
  p2: string | null;
  winner: string | null;
  score1: number;
  score2: number;
  format: 'bo1' | 'bo3' | 'bo5';
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

/** One reveal event in the bracket shuffle animation. */
export interface ShuffleReveal {
  slotKey: string;  // e.g. 'm_upper_0_0_p1'
  team: string;
}

/** Broadcast shuffle animation so all clients animate in sync. */
export interface ShuffleState {
  startTime: number;  // Date.now() when shuffle was triggered
  delayMs: number;    // ms between each reveal
  reveals: ShuffleReveal[];
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

// ─── Free For All ─────────────────────────────────────────────────────────────

/** Map details shown in the FFA tab header (from the screenshot). */
export interface FFAMapInfo {
  title: string;       // e.g. "Tour"
  mapName: string;     // e.g. "London"
  scoreLimit: number;  // e.g. 50
  timeLimit: number;   // minutes, e.g. 20
  maxPlayers: string;  // e.g. "8 vs 8"
  password: string;
  server: string;
  imageUrl?: string;   // optional uploaded screenshot URL
}

/** Per-player score entry in a FFA match. */
export interface FFAPlayerScore {
  playerName: string;
  score: number;
  imageUrl?: string; // optional score screenshot for this player
}

/** A single FFA match/round. */
export interface FFAMatch {
  id: string;
  createdAt: number;
  mapInfo: FFAMapInfo;
  scores: FFAPlayerScore[];
  locked: boolean; // admin can lock to prevent further edits
  /** Single score-tab screenshot uploaded by admin after the round ends. */
  scoreImageUrl?: string;
}

/** Full FFA state stored on server. */
export interface FFAState {
  matches: FFAMatch[];
  players: string[]; // list of player names participating
}

/** Full state stored in KV — never sent to the client as-is. */
export interface ServerState {
  /** @deprecated Per-tournament passwords removed. Use admin accounts instead. */
  adminPwHash?: string;
  /** The adminId of whoever created this tournament. */
  ownerAdminId?: string;
  players: Player[];
  roster: string[];
  teamMode: 'leader' | 'random' | 'manual';
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
  shuffleState: ShuffleState | null; // live bracket shuffle broadcast
  spinCategories: string[];              // ordered category names
  spinItemCategory: Record<number, string>; // spinQueue index -> category name
  tickerText: string;
  stageFormats: import('./types').StageFormats;
  ffa: FFAState;
}

/**
 * Public state returned from /api/state — identical to ServerState
 * but with sensitive server-only fields omitted.
 */
export type ClientState = Omit<ServerState, 'adminPwHash' | 'ownerAdminId'>;

/**
 * @deprecated Use ServerState instead. Kept as an alias so existing
 * server-side code that imports TournamentState continues to compile.
 */
export type TournamentState = ServerState;

/** Per-team manual assignment used when teamMode === 'manual'. */
export interface ManualTeamAssignment {
  /** Slot index 0-based — determines team color/name. */
  index: number;
  members: string[];
  leader: string | null;
}

/**
 * Per-stage match formats for the bracket.
 * - groupStage: earliest rounds (all rounds except last two in SE, UB/LB early rounds in DE)
 * - semiFinal: second-to-last round
 * - grandFinal: final / GF in DE
 */
export interface StageFormats {
  groupStage: 'bo1' | 'bo3' | 'bo5';
  semiFinal:  'bo1' | 'bo3' | 'bo5';
  grandFinal: 'bo1' | 'bo3' | 'bo5';
}

export type TabId = 'players' | 'teams' | 'bracket' | 'maps' | 'ffa' | 'chat';
