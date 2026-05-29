import { NextRequest, NextResponse } from 'next/server';
import { updateState } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

// DELETE /api/reset — wipe all tournament data except admin password, maps pool, default maps, ticker, and format preferences
export async function DELETE(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
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
