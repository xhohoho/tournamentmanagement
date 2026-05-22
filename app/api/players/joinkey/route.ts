import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

// GET /api/players/joinkey — returns whether a key is active (not the key itself)
export async function GET() {
  const state = await getState();
  return NextResponse.json({ hasKey: !!(state.joinKey) });
}

// PATCH /api/players/joinkey — set or clear the join key (admin only)
export async function PATCH(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { joinKey } = await req.json();
  const next = await updateState(s => ({ ...s, joinKey: (joinKey ?? '').trim() }));
  return NextResponse.json({ joinKey: next.joinKey, hasKey: !!(next.joinKey) });
}
