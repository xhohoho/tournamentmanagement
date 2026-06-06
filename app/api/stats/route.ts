import { NextRequest, NextResponse } from 'next/server';
import { getState, listTournaments } from '@/lib/kv';

export async function GET(req: NextRequest) {
  // If a specific tournament is requested, return that tournament's stats
  const tid = req.nextUrl.searchParams.get('t');
  if (tid) {
    const state = await getState(tid);
    return NextResponse.json({
      visitorCount: state.visitorCount ?? 0,
      activeAdminCount: (state.activeAdmins ?? []).length,
    });
  }

  // Otherwise, return overall totals across all tournaments
  const tournaments = await listTournaments();
  let totalVisitors = 0;
  let totalAdmins = 0;
  const seenAdmins = new Set<string>();

  await Promise.all(
    tournaments.map(async (t) => {
      try {
        const state = await getState(t.id);
        totalVisitors += state.visitorCount ?? 0;
        for (const adminId of state.activeAdmins ?? []) {
          seenAdmins.add(adminId);
        }
      } catch { /* ignore */ }
    }),
  );
  totalAdmins = seenAdmins.size;

  return NextResponse.json({
    visitorCount: totalVisitors,
    activeAdminCount: totalAdmins,
  });
}
