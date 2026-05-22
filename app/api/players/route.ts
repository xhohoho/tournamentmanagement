import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

const ADMIN_ACTIONS = new Set(['addToRoster', 'removeFromRoster', 'setRoster', 'clearQueue', 'clearRoster']);

// GET /api/players
export async function GET() {
  const state = await getState();
  return NextResponse.json({ players: state.players, roster: state.roster });
}

// POST /api/players — add player to queue (open to all)
export async function POST(req: NextRequest) {
  const { name, joinKey } = await req.json();
  const trimmed = name?.trim();
  if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  if (trimmed.length > 24) return NextResponse.json({ error: 'Name must be 24 characters or fewer' }, { status: 400 });

  const state = await getState();

  // Join key check
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
    // Strip byAdmin from any legacy records on the way through, add new clean record
    players: [
      ...s.players.map(({ name, addedAt }) => ({ name, addedAt })),
      { name: trimmed, addedAt: Date.now() },
    ],
  }));
  return NextResponse.json({ players: next.players });
}

// DELETE /api/players — remove player by name (admin only)
export async function DELETE(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { name } = await req.json();
  const next = await updateState(s => ({
    ...s,
    players: s.players.filter(p => p.name !== name),
    roster: s.roster.filter(n => n !== name),
  }));
  return NextResponse.json({ players: next.players, roster: next.roster });
}

// PATCH /api/players — roster management (admin-only actions)
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { action, name, roster } = body;

  if (ADMIN_ACTIONS.has(action)) {
    if (!await verifyAdminToken(req)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
  }

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
