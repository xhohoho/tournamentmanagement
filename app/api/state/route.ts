import { NextRequest, NextResponse } from 'next/server';
import { getState, safeState } from '@/lib/kv';

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json(safeState(state));
}
