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
}

export interface GrandFinal {
  p1: string | null;
  p2: string | null;
  winner: string | null;
}

export interface Bracket {
  type: 'single' | 'double';
  upper: BracketMatch[][];
  lower?: BracketMatch[][];
  grandFinal?: GrandFinal;
  champion: string | null;
}

export interface TournamentState {
  adminPwHash: string; // bcrypt or simple hash stored server-side
  players: Player[];
  roster: string[]; // names selected for play
  teamMode: 'leader' | 'random';
  teams: Team[];
  elimMode: 'single' | 'double';
  bracket: Bracket | null;
  maps: string[];
  stageMaps: Record<string, string>;
}

export type TabId = 'players' | 'teams' | 'bracket' | 'maps';
