import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { shuffle, TEAM_COLORS } from '@/lib/utils';
import type { Team } from '@/lib/types';
import { checkTournamentAccess } from '@/lib/tournamentAccess';

/**
 * Returns a color for team index i out of n total teams.
 * Uses the fixed TEAM_COLORS palette for up to 8 teams;
 * generates evenly-spaced HSL hues for larger rosters.
 */
function teamColor(i: number, n: number): string {
  if (n <= TEAM_COLORS.length) return TEAM_COLORS[i % TEAM_COLORS.length];
  const hue = Math.round((i * 360) / n) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ teams: state.teams, teamMode: state.teamMode });
}

export async function POST(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;

  const body = await req.json();
  const state = await getState(tid);
  const roster = state.roster;

  if (body.assignments && typeof body.assignments === 'object' && !Array.isArray(body.assignments)) {
    const { assignments } = body;
    const updatedTeams = (state.teams ?? []).map(team =>
      assignments[team.name] ? { ...team, leader: assignments[team.name] } : team
    );
    await updateState(s => ({ ...s, teams: updatedTeams }), tid);
    return NextResponse.json({ teams: updatedTeams });
  }

  const { teamMode, leaders, manualTeams } = body;
  if (roster.length < 10 || roster.length % 5 !== 0) {
    return NextResponse.json({ error: 'Need 10+ roster players in multiples of 5' }, { status: 400 });
  }

  const n = Math.floor(roster.length / 5);
  const teams: Team[] = [];

  if (teamMode === 'manual') {
    if (!Array.isArray(manualTeams) || manualTeams.length !== n) {
      return NextResponse.json({ error: `Expected ${n} teams in manualTeams` }, { status: 400 });
    }
    const allAssigned = manualTeams.flatMap((t: { members: string[] }) => t.members);
    if (allAssigned.length !== roster.length || new Set(allAssigned).size !== roster.length) {
      return NextResponse.json({ error: 'Each roster player must appear in exactly one team' }, { status: 400 });
    }
    const notInRoster = allAssigned.find((p: string) => !roster.includes(p));
    if (notInRoster) return NextResponse.json({ error: `"${notInRoster}" is not in the roster` }, { status: 400 });
    for (let i = 0; i < n; i++) {
      const slot = manualTeams.find((t: { index: number }) => t.index === i) ?? manualTeams[i];
      teams.push({
        name: 'Team ' + (i + 1),
        color: teamColor(i, n),
        leader: slot.leader ?? null,
        members: slot.members,
      });
    }
  } else if (teamMode === 'random') {
    const pool = shuffle(roster);
    for (let i = 0; i < n; i++) {
      teams.push({ name: 'Team ' + (i + 1), color: teamColor(i, n), leader: null, members: pool.slice(i * 5, i * 5 + 5) });
    }
  } else {
    if (!leaders || leaders.length !== n || new Set(leaders).size !== n) {
      return NextResponse.json({ error: 'Pick a unique leader for each team' }, { status: 400 });
    }
    const invalidLeader = leaders.find((l: string) => !roster.includes(l));
    if (invalidLeader) return NextResponse.json({ error: `"${invalidLeader}" is not in the roster` }, { status: 400 });
    const pool = shuffle(roster.filter((p: string) => !leaders.includes(p)));
    let pi = 0;
    for (let i = 0; i < n; i++) {
      const members = [leaders[i]];
      for (let j = 0; j < 4; j++) members.push(pool[pi++]);
      teams.push({ name: 'Team ' + (i + 1), color: teamColor(i, n), leader: leaders[i], members });
    }
  }

  const next = await updateState(s => ({ ...s, teams, teamMode, bracket: null }), tid);
  return NextResponse.json({ teams: next.teams });
}

export async function DELETE(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;
  const next = await updateState(s => ({ ...s, teams: [], bracket: null }), tid);
  return NextResponse.json({ teams: next.teams });
}

export async function PATCH(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;
  const body = await req.json();

  if (body.teamMode !== undefined && !body.action) {
    const next = await updateState(s => ({ ...s, teamMode: body.teamMode }), tid);
    return NextResponse.json({ teamMode: next.teamMode });
  }
  if (body.action === 'renameTeam') {
    const { teamId, customName } = body;
    if (!teamId || typeof customName !== 'string') return NextResponse.json({ error: 'teamId and customName required' }, { status: 400 });
    const next = await updateState(s => ({
      ...s,
      teams: s.teams.map(t => t.name === teamId ? { ...t, customName: customName.trim() || undefined } : t),
    }), tid);
    return NextResponse.json({ teams: next.teams });
  }
  if (body.action === 'setTeamNameFromLeader') {
    const { teamId } = body;
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    const next = await updateState(s => ({
      ...s,
      teams: s.teams.map(t => t.name !== teamId ? t : { ...t, customName: t.leader ?? t.customName }),
    }), tid);
    return NextResponse.json({ teams: next.teams });
  }
  if (body.action === 'addReplacement') {
    const { teamId, originalName, replacementName } = body;
    if (!teamId || !originalName || !replacementName) return NextResponse.json({ error: 'teamId, originalName, replacementName required' }, { status: 400 });
    const next = await updateState(s => ({
      ...s,
      teams: s.teams.map(t => t.name !== teamId ? t : { ...t, replacements: { ...(t.replacements ?? {}), [originalName]: replacementName.trim() } }),
    }), tid);
    return NextResponse.json({ teams: next.teams });
  }
  if (body.action === 'removeReplacement') {
    const { teamId, originalName } = body;
    if (!teamId || !originalName) return NextResponse.json({ error: 'teamId and originalName required' }, { status: 400 });
    const next = await updateState(s => ({
      ...s,
      teams: s.teams.map(t => {
        if (t.name !== teamId) return t;
        const replacements = { ...(t.replacements ?? {}) };
        delete replacements[originalName];
        return { ...t, replacements };
      }),
    }), tid);
    return NextResponse.json({ teams: next.teams });
  }
  if (body.action === 'swapPlayer') {
    const { playerName, fromTeamId, toTeamId } = body as { playerName: string; fromTeamId: string; toTeamId: string };
    if (!playerName || !fromTeamId || !toTeamId) return NextResponse.json({ error: 'playerName, fromTeamId, toTeamId required' }, { status: 400 });
    const next = await updateState(s => ({
      ...s,
      teams: s.teams.map(t => {
        if (t.name === fromTeamId) {
          return {
            ...t,
            members: t.members.filter(m => m !== playerName),
            leader: t.leader === playerName ? null : t.leader,
          };
        }
        if (t.name === toTeamId) {
          return { ...t, members: [...t.members, playerName] };
        }
        return t;
      }),
    }), tid);
    return NextResponse.json({ teams: next.teams });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
