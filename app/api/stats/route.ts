import { NextRequest, NextResponse } from 'next/server';
import { getState, listTournaments, updateState } from '@/lib/kv';

// ─── In-memory picker visitor tracking ───────────────────────────────────────
// Tracks unique picker visitors by IP+UA hash (resets on deploy)
const pickerVisitors = new Set<string>();

function clientKey(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const ua = req.headers.get('user-agent') ?? 'unknown';
  return `${ip}|${ua}`;
}

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t');

  // Per-tournament stats (used by main tournament page via SSE)
  if (tid) {
    const state = await getState(tid);
    return NextResponse.json({
      visitorCount: state.visitorCount ?? 0,
      activeAdminCount: (state.activeAdmins ?? []).length,
    });
  }

  // ── Overall stats (picker page) ──────────────────────────────────────────
  // Register this picker visitor
  const key = clientKey(req);
  const isNew = !pickerVisitors.has(key);
  pickerVisitors.add(key);

  // Get per-tournament counts from KV
  const tournaments = await listTournaments();
  let tournamentVisitors = 0;
  const allAdmins = new Set<string>();

  await Promise.all(
    tournaments.map(async (t) => {
      try {
        const state = await getState(t.id);
        tournamentVisitors += state.visitorCount ?? 0;
        for (const adminId of state.activeAdmins ?? []) {
          allAdmins.add(adminId);
        }
      } catch { /* ignore */ }
    }),
  );

  const totalVisitors = pickerVisitors.size + tournamentVisitors;
  const totalAdmins = allAdmins.size;

  return NextResponse.json({
    visitorCount: totalVisitors,
    activeAdminCount: totalAdmins,
  });
}
