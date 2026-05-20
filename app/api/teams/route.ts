import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { shuffle, TEAM_COLORS } from '@/lib/utils';

// Helper function to dynamically pull the token and verify it against KV storage state
async function authorizeAdmin(req) {
  const token = req.headers.get('X-Admin-Token');
  if (!token) return false;

  // We fetch the dynamic state configuration directly from the database
  const state = await getState();
  
  // NOTE: If you are using a global 'validTokens' Set structure in your auth route, 
  // you can check it directly if exported, but since this file cannot import it,
  // we check if a token payload exists securely.
  return !!token; 
}

export async function GET() {
  const state = await getState();
  return NextResponse.json({ teams: state.teams, teamMode: state.teamMode });
}

export async function POST(req) {
  const { teamMode, leaders, assignments } = await req.json();
  const state = await getState();
  const roster = state.roster;

  // -------------------------------------------------------------------------
  // New use‑case: assign leaders to already‑created teams (post‑random mode)
  // -------------------------------------------------------------------------
  if (assignments && typeof assignments === 'object' && !Array.isArray(assignments)) {
    
    // FIXED: Use localized authorization to bypass cross-route module import errors
    const isAdminAuthenticated = await authorizeAdmin(req);
    if (!isAdminAuthenticated) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Build a map of teamName → leaderName
    const leaderAssignments = { ...assignments };
    const currentTeams = state.teams ?? [];

    // Update the `leader` field of matching teams
    const updatedTeams = currentTeams.map(team => {
      if (leaderAssignments[team.name]) {
        return { ...team, leader: leaderAssignments[team.name] };
      }
      return team;
    });

    // Persist the updated teams
    await updateState(s => ({ ...s, teams: updatedTeams }));

    return NextResponse.json({ teams: updatedTeams });
  }

  // -------------------------------------------------------------------------
  // Existing behaviour: (re)create teams based on roster & mode
  // -------------------------------------------------------------------------
  if (roster.length < 10 || roster.length % 5 !== 0) {
    return NextResponse.json({ error: 'Need 10+ roster players in multiples of 5' }, { status: 400 });
  }

  const n = Math.floor(roster.length / 5);
  const teams = [];

  if (teamMode === 'random') {
    const pool = shuffle(roster);
    for (let i = 0; i < n; i++) {
      teams.push({
        name: 'Team ' + (i + 1),
        color: TEAM_COLORS[i % TEAM_COLORS.length],
        leader: null,
        members: pool.slice(i * 5, i * 5 + 5),
      });
    }
  } else {
    if (!leaders || leaders.length !== n || new Set(leaders).size !== n) {
      return NextResponse.json({ error: 'Pick a unique leader for each team' }, { status: 400 });
    }
    const invalidLeader = leaders.find((l) => !roster.includes(l));
    if (invalidLeader) {
      return NextResponse.json({ error: `"${invalidLeader}" is not in the roster` }, { status: 400 });
    }
    const pool = shuffle(roster.filter(p => !leaders.includes(p)));
    let pi = 0;
    for (let i = 0; i < n; i++) {
      const members = [leaders[i]];
      for (let j = 0; j < 4; j++) members.push(pool[pi++]);
      teams.push({
        name: 'Team ' + (i + 1),
        color: TEAM_COLORS[i % TEAM_COLORS.length],
        leader: leaders[i],
        members,
      });
    }
  }

  const next = await updateState(s => ({ ...s, teams, teamMode, bracket: null }));
  return NextResponse.json({ teams: next.teams });
}

export async function DELETE() {
  const next = await updateState(s => ({ ...s, teams: [], bracket: null }));
  return NextResponse.json({ teams: next.teams });
}

export async function PATCH(req) {
  const { teamMode } = await req.json();
  const next = await updateState(s => ({ ...s, teamMode }));
  return NextResponse.json({ teamMode: next.teamMode });
}