import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { checkTournamentAccess } from '@/lib/tournamentAccess';

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ tickerText: state.tickerText ?? '' });
}

export async function PATCH(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;
  const { tickerText } = await req.json();
  if (typeof tickerText !== 'string') {
    return NextResponse.json({ error: 'tickerText must be a string' }, { status: 400 });
  }
  await updateState(s => ({ ...s, tickerText: tickerText.trim() }), tid);
  return NextResponse.json({ tickerText: tickerText.trim() });
}
