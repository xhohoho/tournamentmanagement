import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

const ADMIN_ACTIONS = new Set(['addToRoster', 'removeFromRoster', 'setRoster', 'clearQueue', 'clearRoster']);

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ players: state.players, roster: state.roster });
}

export async function POST(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const { name, joinKey } = await req.json();
  const trimmed = name?.trim();
  if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  if (trimmed.length > 24) return NextResponse.json({ error: 'Name must be 24 characters or fewer' }, { status: 400 });

  const state = await getState(tid);
  if (state.joinKey) {
    if (!joinKey || joinKey.trim() !== state.joinKey) {
      return NextResponse.json({ error: 'Invalid join key' }, { status: 403 });
    }
  }

  const lo = trimmed.toLowerCase();
  if (state.players.find(p => p.name.toLowerCase() === lo)) {
    return NextResponse.json({ error: `"${trimmed}" is already in the queue` }, { status: 409 });
  }

  const next = await updateState(s => ({
    ...s,
    players: [
      ...s.players.map(({ name, addedAt }) => ({ name, addedAt })),
      { name: trimmed, addedAt: Date.now() },
    ],
  }), tid);
  return NextResponse.json({ players: next.players });
}

export async function DELETE(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
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
    if (!await verifyAdminToken(req)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
  }

  if (action === 'setRoster' && Array.isArray(roster)) {
    const next = await updateState(s => ({ ...s, roster }), tid);
    return NextResponse.json({ roster: next.roster });
  }
  if (action === 'addToRoster') {
    const next = await updateState(s => ({
      ...s,
      roster: s.roster.includes(name) ? s.roster : [...s.roster, name],
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
