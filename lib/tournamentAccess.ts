import { NextRequest, NextResponse } from 'next/server';
import { listTournaments, listAdminAccounts } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';
import { canAccessTournament } from '@/lib/auth';

/**
 * Verifies admin token AND checks tournament access.
 * Returns { adminId } on success, or a NextResponse 403 on failure.
 */
export async function checkTournamentAccess(
  req: NextRequest,
  tid: string,
): Promise<{ adminId: string } | NextResponse> {
  const adminId = await verifyAdminToken(req);
  if (!adminId) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const [tournaments, accounts] = await Promise.all([listTournaments(), listAdminAccounts()]);
  const tournament = tournaments.find(t => t.id === tid);
  const me = accounts.find(a => a.adminId === adminId);

  if (tournament && !canAccessTournament(adminId, me?.isSuperAdmin ?? false, tournament)) {
    return NextResponse.json({ error: 'You do not have access to this tournament' }, { status: 403 });
  }

  return { adminId };
}
