import { NextRequest, NextResponse } from 'next/server';
import { getState } from '@/lib/kv';

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({
    visitorCount: state.visitorCount ?? 0,
    activeAdminCount: (state.activeAdmins ?? []).length,
  });
}
