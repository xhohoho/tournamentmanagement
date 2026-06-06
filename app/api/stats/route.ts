import { NextRequest, NextResponse } from 'next/server';
import { getState, listTournaments, updateState } from '@/lib/kv';
import { kv } from '@vercel/kv';

// ─── Picker visitor tracking (in-memory, per-instance) ────────────────────────
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

/** KV key for active admin set */
const ACTIVE_ADMINS_KEY = 'tournament:activeAdmins';

export async function registerAdmin(adminId: string) {
  try {
    const current = await kv.get<string[]>(ACTIVE_ADMINS_KEY) ?? [];
    if (!current.includes(adminId)) {
      await kv.set(ACTIVE_ADMINS_KEY, [...current, adminId]);
    }
  } catch { /* ignore */ }
}

export async function unregisterAdmin(adminId: string) {
  try {
    const current = await kv.get<string[]>(ACTIVE_ADMINS_KEY) ?? [];
    await kv.set(ACTIVE_ADMINS_KEY, current.filter(id => id !== adminId));
  } catch { /* ignore */ }
}

async function getActiveAdminCount(): Promise<number> {
  try {
    const admins = await kv.get<string[]>(ACTIVE_ADMINS_KEY);
    return admins?.length ?? 0;
  } catch { return 0; }
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

  const activeAdminCount = await getActiveAdminCount();

  return NextResponse.json({
    visitorCount: pickerVisitors.size + tournamentVisitors,
    activeAdminCount,
  });
}
