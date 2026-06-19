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
  rules?: string;      // optional free-text rules for this match
}

/** Per-player score entry in a FFA match. */
export interface FFAPlayerScore {
  playerName: string;
  score: number;
  imageUrl?: string; // optional score screenshot for this player
}

/** Winner entry for a FFA match. */
export interface FFAWinner {
  playerName: string;
  prize: string; // e.g. "RP 50,000" or "Gold Medal"
}

/** A single FFA match/round. */
// ─── Caster Sheet ────────────────────────────────────────────────────────────

/** A single match entry on the caster sheet. */
export interface CasterMatch {
  id: string;           // uuid-style, generated client-side
  matchNo: string;      // e.g. "Match 1", "UB R1 M2"
  team1: string;
  team2: string;
  maps: string;         // free-text, e.g. "DR, CC, OT"
  side: string;         // free-text, e.g. "Coin spin — winner picks"
  notes: string;        // any extra caster notes
  result: string;       // e.g. "LMKY 2-1"
  createdAt: number;
  /** Optional binding to a bracket match card (e.g. "m_upper_0_0"), set when created via the bracket's 🎙 button. */
  linkedMatchKey?: string;
}

export interface CasterSheet {
  matches: CasterMatch[];
}

export interface FFAMatch {
  id: string;
  createdAt: number;
  mapInfo: FFAMapInfo;
  scores: FFAPlayerScore[];
  locked: boolean; // admin can lock to prevent further edits
  /** Single score-tab screenshot uploaded by admin after the round ends. */
  scoreImageUrl?: string;
  /** Winner(s) declared by admin. */
  winners?: FFAWinner[];
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
  /**
   * Maps that have been spun and set aside. They are hidden from the wheel but
   * remain in the master pool — "clear all" moves them back rather than deleting.
   */
  usedMaps: string[];
  stageMaps: Record<string, string[]>; // key -> up to 3 map names (BO3)
  joinKey: string;          // empty string = no key required
  queueCap: number;          // 0 = unlimited
  queueLocked: boolean;      // when true, new submissions are rejected
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
  casterSheet: import('./types').CasterSheet;
  visitorCount: number;
  activeAdmins: string[];
}

/**
 * Public state returned from /api/state — identical to ServerState
 * but with sensitive server-only fields omitted.
 */
export type ClientState = Omit<ServerState, 'adminPwHash' | 'ownerAdminId'>;

/** Per-team manual assignment used when teamMode === 'manual'. */
export interface ManualTeamAssignment {
  /** Slot index 0-based — determines team color/name. */
  index: number;
  members: string[];
  leader: string | null;
}

/**
 * Per-stage match formats for the bracket.
 * - upperBracket: all Upper Bracket rounds (double elim) or all rounds except the
 *   final two (single elim) — i.e. the regular Upper Bracket progression including
 *   the Upper Final.
 * - lowerBracket: all Lower Bracket rounds EXCEPT the final Lower Bracket round
 *   (double elim only).
 * - lowerBracketFinal: the single, final Lower Bracket round whose winner advances
 *   to the Grand Final (double elim only).
 * - grandFinal: the Grand Final (double elim) or the final round (single elim).
 */
export interface StageFormats {
  upperBracket:      'bo1' | 'bo3' | 'bo5';
  lowerBracket:       'bo1' | 'bo3' | 'bo5';
  lowerBracketFinal:  'bo1' | 'bo3' | 'bo5';
  grandFinal:         'bo1' | 'bo3' | 'bo5';
}

export type TabId = 'players' | 'teams' | 'bracket' | 'maps' | 'spin' | 'ffa' | 'chat' | 'caster';

// ─── Context shape ─────────────────────────────────────────────────────────────
// Exported so components can import the type without pulling in the full context module.
export interface TourneyContext {
  players: Player[];
  roster: string[];
  teamMode: 'leader' | 'random' | 'manual';
  teams: Team[];
  elimMode: 'single' | 'double';
  bracket: Bracket | null;
  maps: string[];
  usedMaps: string[];
  stageMaps: Record<string, string[]>;
  spinState: SpinState | null;
  shuffleState: ShuffleState | null;
  spinQueue: string[];
  spinCategories: string[];
  spinItemCategory: Record<number, string>;
  defaultMaps: string[];
  stageFormats: StageFormats;
  ffa: FFAState;
  casterSheet: CasterSheet;
  isAdmin: boolean;
  previewAsUser: boolean;
  adminToken: string | null;
  adminId: string | null;
  adminName: string | null;
  isSuperAdmin: boolean;
  loading: boolean;
  sseStatus: 'connecting' | 'connected' | 'polling' | 'error';
  tickerText: string;
  visitorCount: number;
  activeAdminCount: number;

  tournamentId: string;
  joinKey: string;
  queueCap: number;
  queueLocked: boolean;
  chatMessages: ChatMessage[];

  setIsAdmin: (v: boolean) => void;
  setPreviewAsUser: (v: boolean) => void;
  setAdminToken: (token: string | null) => void;
  setAdminInfo: (info: { adminId: string; name: string; isSuperAdmin: boolean } | null) => void;
  setStageFormats: (sf: StageFormats) => Promise<void>;
  refresh: () => Promise<void>;
  setTickerText: (text: string) => Promise<void>;

  submitPlayer: (name: string, joinKey?: string) => Promise<{ error?: string }>;
  removePlayer: (name: string) => Promise<void>;
  renamePlayer: (oldName: string, newName: string) => Promise<{ error?: string }>;
  addToRoster: (name: string) => Promise<void>;
  removeFromRoster: (name: string) => Promise<void>;
  setRoster: (names: string[]) => Promise<void>;
  clearQueue: () => Promise<void>;
  clearRoster: () => Promise<void>;

  setJoinKey: (key: string) => Promise<{ error?: string }>;
  setQueueCap: (cap: number) => Promise<{ error?: string }>;
  setQueueLocked: (locked: boolean) => Promise<{ error?: string }>;

  sendChat: (name: string, text: string) => Promise<{ error?: string }>;
  clearChat: () => Promise<void>;

  formTeams: (leaders?: string[], manualTeams?: ManualTeamAssignment[]) => Promise<{ error?: string; teams?: Team[] }>;
  resetTeams: () => Promise<void>;
  setTeamMode: (mode: 'leader' | 'random' | 'manual') => Promise<void>;
  renameTeam: (teamId: string, customName: string) => Promise<{ error?: string }>;
  setTeamNameFromLeader: (teamId: string) => Promise<{ error?: string }>;
  addReplacement: (teamId: string, originalName: string, replacementName: string) => Promise<{ error?: string }>;
  removeReplacement: (teamId: string, originalName: string) => Promise<{ error?: string }>;
  swapPlayer: (playerName: string, fromTeamId: string, toTeamId: string) => Promise<{ error?: string }>;

  generateBracket: (sf?: StageFormats) => Promise<{ error?: string }>;
  seedBracket: (sf?: StageFormats) => Promise<{ error?: string; shuffleState?: ShuffleState | null }>;
  manualSeedSlot: (section: string, ri: number, mi: number, slot: 1 | 2, team: string | null) => Promise<{ error?: string }>;
  updateScore: (section: string, ri: number, mi: number, p1wins: number, p2wins: number) => Promise<void>;
  undoMatch: (section: string, ri: number, mi: number) => Promise<void>;
  updateThirdPlace: (p1wins: number, p2wins: number) => Promise<void>;
  resetBracket: () => Promise<void>;
  setElimMode: (mode: 'single' | 'double') => Promise<void>;

  addMap: (name: string) => Promise<{ error?: string }>;
  removeMap: (name: string) => Promise<void>;
  moveMapToUsed: (name: string) => Promise<void>;
  restoreUsedMap: (name?: string) => Promise<void>;
  appendSpinQueue: (map: string) => Promise<void>;
  clearSpinQueue: () => Promise<void>;
  removeSpinQueueItem: (idx: number) => Promise<void>;
  saveSpinCategories: (cats: string[], itemCat: Record<number, string>) => Promise<void>;
  saveDefaultMaps: (starred: string[]) => Promise<void>;
  assignStage: (stageKey: string, mapName: string, slot?: number) => Promise<void>;
  clearStage: (stageKey: string, slot?: number) => Promise<void>;
  assignLeader: (teamId: string, playerName: string) => Promise<{ error?: string }>;

  createFFAMatch: (mapInfo: FFAMapInfo) => Promise<{ error?: string }>;
  updateFFAScore: (matchId: string, playerName: string, score: number, imageUrl?: string) => Promise<void>;
  removeFFAScore: (matchId: string, playerName: string) => Promise<void>;
  setFFAScores: (matchId: string, scores: FFAPlayerScore[]) => Promise<void>;
  setFFAPlayers: (players: string[]) => Promise<void>;
  deleteFFAMatch: (matchId: string) => Promise<void>;
  lockFFAMatch: (matchId: string, locked: boolean) => Promise<void>;
  updateFFAMapInfo: (matchId: string, mapInfo: FFAMapInfo) => Promise<void>;
  setFFAMatchImage: (matchId: string, imageUrl: string) => Promise<void>;
  setFFAMatchScoreImage: (matchId: string, scoreImageUrl: string) => Promise<void>;
  setFFAMatchWinners: (matchId: string, winners: FFAWinner[]) => Promise<void>;

  setCasterSheet: (matches: import('./types').CasterMatch[]) => Promise<void>;

  resetAll: () => Promise<void>;
}
