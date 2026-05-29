import { NextRequest, NextResponse } from 'next/server';
import { listTournaments, registerTournament, deleteTournamentState } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

// GET /api/tournaments — list all tournaments
export async function GET() {
  const list = await listTournaments();
  return NextResponse.json({ tournaments: list });
}

// POST /api/tournaments — create a new tournament
export async function POST(req: NextRequest) {
  const { id, name } = await req.json();
  const safeId = id?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64);
  const safeName = name?.trim().slice(0, 80);
  if (!safeId || !safeName) {
    return NextResponse.json({ error: 'id and name required' }, { status: 400 });
  }
  const list = await registerTournament(safeId, safeName);
  return NextResponse.json({ tournaments: list, id: safeId });
}

// DELETE /api/tournaments?t=slug — delete a tournament (admin of that tournament only)
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