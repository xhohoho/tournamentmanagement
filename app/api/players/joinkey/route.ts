import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { verifyAdminToken } from '@/lib/auth';

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
  const body = await req.json();
  const next = await updateState(s => ({
    ...s,
    ...(body.joinKey !== undefined ? { joinKey: (body.joinKey ?? '').trim() } : {}),
    ...(body.queueCap !== undefined ? { queueCap: Math.max(0, Number(body.queueCap) || 0) } : {}),
    ...(body.queueLocked !== undefined ? { queueLocked: !!body.queueLocked } : {}),
  }), tid);
  return NextResponse.json({
    joinKey: next.joinKey,
    hasKey: !!(next.joinKey),
    queueCap: next.queueCap ?? 0,
    queueLocked: next.queueLocked ?? false,
  });
}
