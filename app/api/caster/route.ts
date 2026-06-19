import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { checkTournamentAccess } from '@/lib/tournamentAccess';
import type { CasterMatch } from '@/lib/types';

// GET /api/caster?t=xxx — returns caster sheet state
export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ casterSheet: state.casterSheet });
}

// PUT /api/caster?t=xxx — replace the whole match list (admin only)
// body: { matches: CasterMatch[] }
export async function PUT(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;

  const body = await req.json();
  const matches: CasterMatch[] = body.matches ?? [];

  const next = await updateState(s => ({
    ...s,
    casterSheet: { matches },
  }), tid);

  return NextResponse.json({ casterSheet: next.casterSheet });
}
