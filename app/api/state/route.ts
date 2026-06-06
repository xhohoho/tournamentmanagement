import { NextRequest, NextResponse } from 'next/server';
import { getState, safeState, getActiveAdminCount } from '@/lib/kv';

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const [state, activeAdminCount] = await Promise.all([getState(tid), getActiveAdminCount()]);
  return NextResponse.json({ ...safeState(state), activeAdminCount });
}
