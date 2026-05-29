import { NextRequest, NextResponse } from 'next/server';
import { listTournaments, registerTournament, deleteTournamentState, updateTournamentMeta } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

// GET /api/tournaments — list all tournaments (public)
export async function GET() {
  const list = await listTournaments();
  return NextResponse.json({ tournaments: list });
}

// POST /api/tournaments — create a new tournament (admin only)
export async function POST(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { id, name, posterUrl } = await req.json();
  const safeId = id?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
  const safeName = name?.trim().slice(0, 80);
  const safePoster = typeof posterUrl === 'string' ? posterUrl.trim().slice(0, 500) : undefined;
  if (!safeId || !safeName) {
    return NextResponse.json({ error: 'id and name required' }, { status: 400 });
  }
  const list = await registerTournament(safeId, safeName, safePoster || undefined);
  return NextResponse.json({ tournaments: list, id: safeId });
}

// PATCH /api/tournaments?t=slug — update poster/name (admin only)
export async function PATCH(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t');
  if (!tid) return NextResponse.json({ error: 'Tournament id required' }, { status: 400 });
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const body = await req.json();
  const patch: Record<string, string> = {};
  if (typeof body.posterUrl === 'string') patch.posterUrl = body.posterUrl.trim().slice(0, 500);
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 80);
  const list = await updateTournamentMeta(tid, patch);
  return NextResponse.json({ tournaments: list });
}

// DELETE /api/tournaments?t=slug — delete a tournament (admin only)
export async function DELETE(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t');
  if (!tid) return NextResponse.json({ error: 'Tournament id required' }, { status: 400 });
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  await deleteTournamentState(tid);
  const list = await listTournaments();
  return NextResponse.json({ tournaments: list });
}
