import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ hasKey: !!(state.joinKey) });
}

export async function PATCH(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { joinKey } = await req.json();
  const next = await updateState(s => ({ ...s, joinKey: (joinKey ?? '').trim() }), tid);
  return NextResponse.json({ joinKey: next.joinKey, hasKey: !!(next.joinKey) });
}
