import { NextRequest, NextResponse } from 'next/server';
import { updateState } from '@/lib/kv';
import { checkTournamentAccess } from '@/lib/tournamentAccess';

// DELETE /api/reset — wipe all tournament data except admin password, maps pool, default maps, ticker, and format preferences
export async function DELETE(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;
  const next = await updateState(s => ({
    ...s,
    players: [],
    roster: [],
    teams: [],
    bracket: null,
    stageMaps: {},
    joinKey: '',
    chatMessages: [],
    spinQueue: [],
    spinState: null,
    shuffleState: null,
    spinCategories: [],
    spinItemCategory: {},
  }), tid);
  const { adminPwHash: _, ...safe } = next;
  return NextResponse.json(safe);
}
