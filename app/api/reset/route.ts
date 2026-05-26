import { NextRequest, NextResponse } from 'next/server';
import { updateState } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

// DELETE /api/reset — wipe everything except admin password and maps
export async function DELETE(req: NextRequest) {
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
  }));
  const { adminPwHash: _, ...safe } = next;
  return NextResponse.json(safe);
}
