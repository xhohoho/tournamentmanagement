import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';

// GET /api/players
export async function GET() {
  const state = await getState();
  return NextResponse.json({ players: state.players, roster: state.roster });
}

// POST /api/players - add player to queue
export async function POST(req: NextRequest) {
  const { name, byAdmin } = await req.json();
  const trimmed = name?.trim();
  if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const state = await getState();
  const lo = trimmed.toLowerCase();
  if (state.players.find(p => p.name.toLowerCase() === lo)) {
    return NextResponse.json({ error: `"${trimmed}" is already in the queue` }, { status: 409 });
  }

  const next = await updateState(s => ({
    ...s,
    players: [...s.players, { name: trimmed, byAdmin: !!byAdmin, addedAt: Date.now() }],
  }));
  return NextResponse.json({ players: next.players });
}

// DELETE /api/players - remove player by name (admin)
export async function DELETE(req: NextRequest) {
  const { name } = await req.json();
  const next = await updateState(s => ({
    ...s,
    players: s.players.filter(p => p.name !== name),
    roster: s.roster.filter(n => n !== name),
  }));
  return NextResponse.json({ players: next.players, roster: next.roster });
}

// PATCH /api/players - update roster
export async function PATCH(req: NextRequest) {
  const { action, name, roster } = await req.json();

  if (action === 'setRoster' && Array.isArray(roster)) {
    const next = await updateState(s => ({ ...s, roster }));
    return NextResponse.json({ roster: next.roster });
  }

  if (action === 'addToRoster') {
    const next = await updateState(s => ({
      ...s,
      roster: s.roster.includes(name) ? s.roster : [...s.roster, name],
    }));
    return NextResponse.json({ roster: next.roster });
  }

  if (action === 'removeFromRoster') {
    const next = await updateState(s => ({
      ...s,
      roster: s.roster.filter(n => n !== name),
    }));
    return NextResponse.json({ roster: next.roster });
  }

  if (action === 'clearQueue') {
    const next = await updateState(s => ({ ...s, players: [], roster: [] }));
    return NextResponse.json({ players: next.players, roster: next.roster });
  }

  if (action === 'clearRoster') {
    const next = await updateState(s => ({ ...s, roster: [] }));
    return NextResponse.json({ roster: next.roster });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
