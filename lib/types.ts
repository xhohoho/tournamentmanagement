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

export interface TournamentState {
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

export type TabId = 'players' | 'teams' | 'bracket' | 'maps';
