import { NextRequest, NextResponse } from 'next/server';
import { getState, listTournaments, updateState } from '@/lib/kv';

// ─── Global active admin tracking ────────────────────────────────────────────
// Tracks all currently logged-in adminIds across the entire app (not per-tournament).
// In a multi-instance deployment this would need Redis, but works for single-instance.
const globalActiveAdmins = new Set<string>();

// ─── Picker visitor tracking ─────────────────────────────────────────────────
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

/** Called by auth route when admin logs in */
export function registerAdmin(adminId: string) {
  globalActiveAdmins.add(adminId);
}

/** Called by auth route when admin logs out */
export function unregisterAdmin(adminId: string) {
  globalActiveAdmins.delete(adminId);
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
  pickerVisitors.add(clientKey(req));

  // Sum up tournament visitors from KV
  const tournaments = await listTournaments();
  let tournamentVisitors = 0;
  await Promise.all(
    tournaments.map(async (t) => {
      try {
        const state = await getState(t.id);
        tournamentVisitors += state.visitorCount ?? 0;
      } catch { /* ignore */ }
    }),
  );

  return NextResponse.json({
    visitorCount: pickerVisitors.size + tournamentVisitors,
    activeAdminCount: globalActiveAdmins.size,
  });
}
