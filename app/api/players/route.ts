import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { checkTournamentAccess } from '@/lib/tournamentAccess';

const ADMIN_ACTIONS = new Set(['addToRoster', 'removeFromRoster', 'setRoster', 'clearQueue', 'clearRoster', 'renamePlayer']);

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ players: state.players, roster: state.roster });
}

export async function POST(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  // Whitelist only the fields we expect — ignore any extra keys in the body.
  const raw = await req.json();
  const name: string | undefined = raw.name;
  const joinKey: string | undefined = raw.joinKey;

  const trimmed = name?.trim();
  if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  if (trimmed.length > 24) return NextResponse.json({ error: 'Name must be 24 characters or fewer' }, { status: 400 });

  // Validate join key before touching the updater.
  const precheck = await getState(tid);
  if (precheck.joinKey) {
    if (!joinKey || joinKey.trim() !== precheck.joinKey) {
      return NextResponse.json({ error: 'Invalid join key' }, { status: 403 });
    }
  }

  const lo = trimmed.toLowerCase();

  // Move duplicate check inside the updater so it runs atomically with the write,
  // preventing the race where two identical names pass the check simultaneously.
  let duplicateError: string | null = null;
  const next = await updateState(s => {
    if (s.players.find(p => p.name.toLowerCase() === lo)) {
      duplicateError = `"${trimmed}" is already in the queue`;
      return s; // no-op — return unchanged state
    }
    return {
      ...s,
      players: [
        ...s.players.map(({ name, addedAt }) => ({ name, addedAt })),
        { name: trimmed, addedAt: Date.now() },
      ],
    };
  }, tid);

  if (duplicateError) {
    return NextResponse.json({ error: duplicateError }, { status: 409 });
  }

  return NextResponse.json({ players: next.players });
}

export async function DELETE(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;
  const { name } = await req.json();
  const next = await updateState(s => ({
    ...s,
    players: s.players.filter(p => p.name !== name),
    roster: s.roster.filter(n => n !== name),
  }), tid);
  return NextResponse.json({ players: next.players, roster: next.roster });
}

export async function PATCH(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const body = await req.json();
  const { action, name, roster } = body;

  if (ADMIN_ACTIONS.has(action)) {
    const access = await checkTournamentAccess(req, tid);
    if (access instanceof NextResponse) return access;
  }

  if (action === 'setRoster' && Array.isArray(roster)) {
    const next = await updateState(s => ({ ...s, roster }), tid);
    return NextResponse.json({ roster: next.roster });
  }
  if (action === 'addToRoster') {
    // Apply case-insensitive dedup on write to prevent "Alice" and "alice" both ending up in roster.
    const lo = (name as string).toLowerCase();
    const next = await updateState(s => ({
      ...s,
      roster: s.roster.find(n => n.toLowerCase() === lo) ? s.roster : [...s.roster, name],
    }), tid);
    return NextResponse.json({ roster: next.roster });
  }
  if (action === 'removeFromRoster') {
    const next = await updateState(s => ({ ...s, roster: s.roster.filter(n => n !== name) }), tid);
    return NextResponse.json({ roster: next.roster });
  }
  if (action === 'clearQueue') {
    const next = await updateState(s => ({ ...s, players: [], roster: [] }), tid);
    return NextResponse.json({ players: next.players, roster: next.roster });
  }
  if (action === 'clearRoster') {
    const next = await updateState(s => ({ ...s, roster: [] }), tid);
    return NextResponse.json({ roster: next.roster });
  }
  if (action === 'renamePlayer') {
    const { oldName, newName } = body as { oldName: string; newName: string };
    const trimmedNew = newName?.trim();
    if (!oldName || !trimmedNew) return NextResponse.json({ error: 'oldName and newName required' }, { status: 400 });
    if (trimmedNew.length > 24) return NextResponse.json({ error: 'Name must be 24 characters or fewer' }, { status: 400 });

    const next = await updateState(s => {
      const lo = trimmedNew.toLowerCase();
      // Reject if new name already exists (for a different player).
      if (s.players.find(p => p.name !== oldName && p.name.toLowerCase() === lo)) return s;
      return {
        ...s,
        players: s.players.map(p => p.name === oldName ? { ...p, name: trimmedNew } : p),
        roster:  s.roster.map(n => n === oldName ? trimmedNew : n),
        teams:   s.teams.map(t => ({
          ...t,
          leader:  t.leader  === oldName ? trimmedNew : t.leader,
          members: t.members.map(m => m === oldName ? trimmedNew : m),
        })),
      };
    }, tid);
    return NextResponse.json({ players: next.players, roster: next.roster, teams: next.teams });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
