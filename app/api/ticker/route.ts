import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ tickerText: state.tickerText ?? '' });
}

export async function PATCH(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { tickerText } = await req.json();
  if (typeof tickerText !== 'string') {
    return NextResponse.json({ error: 'tickerText must be a string' }, { status: 400 });
  }
  await updateState(s => ({ ...s, tickerText: tickerText.trim() }), tid);
  return NextResponse.json({ tickerText: tickerText.trim() });
}
