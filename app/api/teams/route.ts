import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { shuffle, TEAM_COLORS } from '@/lib/utils';
import type { Team } from '@/lib/types';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

export async function GET() {
  const state = await getState();
  return NextResponse.json({ teams: state.teams, teamMode: state.teamMode });
}

export async function POST(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const state = await getState();
  const roster = state.roster;

  // Assign leaders to already-created teams (fully-random mode)
  if (body.assignments && typeof body.assignments === 'object' && !Array.isArray(body.assignments)) {
    const { assignments } = body;
    const currentTeams = state.teams ?? [];
    const updatedTeams = currentTeams.map(team =>
      assignments[team.name] ? { ...team, leader: assignments[team.name] } : team
    );
    await updateState(s => ({ ...s, teams: updatedTeams }));
    return NextResponse.json({ teams: updatedTeams });
  }

  // (Re)create teams based on roster & mode
  const { teamMode, leaders } = body;
  if (roster.length < 10 || roster.length % 5 !== 0) {
    return NextResponse.json({ error: 'Need 10+ roster players in multiples of 5' }, { status: 400 });
  }

  const n = Math.floor(roster.length / 5);
  const teams: Team[] = [];

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
    const invalidLeader = leaders.find((l: string) => !roster.includes(l));
    if (invalidLeader) {
      return NextResponse.json({ error: `"${invalidLeader}" is not in the roster` }, { status: 400 });
    }
    const pool = shuffle(roster.filter((p: string) => !leaders.includes(p)));
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

export async function DELETE(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const next = await updateState(s => ({ ...s, teams: [], bracket: null }));
  return NextResponse.json({ teams: next.teams });
}

export async function PATCH(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const body = await req.json();

  // Set team formation mode
  if (body.teamMode !== undefined && !body.action) {
    const next = await updateState(s => ({ ...s, teamMode: body.teamMode }));
    return NextResponse.json({ teamMode: next.teamMode });
  }

  // Rename a team (manual custom name)
  if (body.action === 'renameTeam') {
    const { teamId, customName } = body;
    if (!teamId || typeof customName !== 'string') {
      return NextResponse.json({ error: 'teamId and customName required' }, { status: 400 });
    }
    const next = await updateState(s => ({
      ...s,
      teams: s.teams.map(t => t.name === teamId ? { ...t, customName: customName.trim() || undefined } : t),
    }));
    return NextResponse.json({ teams: next.teams });
  }

  // Set team name from leader name
  if (body.action === 'setTeamNameFromLeader') {
    const { teamId } = body;
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    const next = await updateState(s => ({
      ...s,
      teams: s.teams.map(t => {
        if (t.name !== teamId) return t;
        return { ...t, customName: t.leader ? t.leader : t.customName };
      }),
    }));
    return NextResponse.json({ teams: next.teams });
  }

  // Add a replacement player (sub-in)
  if (body.action === 'addReplacement') {
    const { teamId, originalName, replacementName } = body;
    if (!teamId || !originalName || !replacementName) {
      return NextResponse.json({ error: 'teamId, originalName, replacementName required' }, { status: 400 });
    }
    const next = await updateState(s => ({
      ...s,
      teams: s.teams.map(t => {
        if (t.name !== teamId) return t;
        return {
          ...t,
          replacements: { ...(t.replacements ?? {}), [originalName]: replacementName.trim() },
        };
      }),
    }));
    return NextResponse.json({ teams: next.teams });
  }

  // Remove a replacement (undo sub)
  if (body.action === 'removeReplacement') {
    const { teamId, originalName } = body;
    if (!teamId || !originalName) {
      return NextResponse.json({ error: 'teamId and originalName required' }, { status: 400 });
    }
    const next = await updateState(s => ({
      ...s,
      teams: s.teams.map(t => {
        if (t.name !== teamId) return t;
        const replacements = { ...(t.replacements ?? {}) };
        delete replacements[originalName];
        return { ...t, replacements };
      }),
    }));
    return NextResponse.json({ teams: next.teams });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}