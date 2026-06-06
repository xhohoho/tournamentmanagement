import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { listAdminAccounts, saveAdminAccount, deleteAdminAccount, updateState, registerActiveAdmin, unregisterActiveAdmin } from '@/lib/kv';
import type { AdminAccount } from '@/lib/types';
import { randomBytes } from 'crypto';
import {
  hashPassword,
  verifyPassword,
  verifyAdminToken,
  createAdminToken,
  revokeAdminToken,
} from '@/lib/auth';

// ── Brute-force protection ────────────────────────────────────────────────────
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_S = 60;

async function checkRateLimit(ip: string): Promise<{ limited: boolean; retryAfter: number }> {
  const key = `ratelimit:login:${ip}`;
  try {
    // Atomically increment and set TTL on first hit
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, RATE_LIMIT_WINDOW_S);
    if (count > RATE_LIMIT_MAX) {
      const ttl = await kv.ttl(key);
      return { limited: true, retryAfter: Math.max(ttl, 1) };
    }
  } catch {
    // If KV is unavailable, fail open (don't block legitimate logins)
  }
  return { limited: false, retryAfter: 0 };
}

/** Clear the rate-limit counter on successful login so legit users aren't penalised. */
async function clearRateLimit(ip: string): Promise<void> {
  try { await kv.del(`ratelimit:login:${ip}`); } catch { /* ignore */ }
}

// ── Seed default admin if none exist ─────────────────────────────────────────
// On a fresh deploy with no accounts, bootstrap one from env vars so the
// operator isn't locked out. Set ADMIN_NAME and ADMIN_PASSWORD in Vercel.
async function ensureDefaultAdmin(): Promise<void> {
  const existing = await listAdminAccounts();
  if (existing.length > 0) return;
  const name = process.env.ADMIN_NAME?.trim();
  const pw   = process.env.ADMIN_PASSWORD?.trim();
  if (!name || !pw) return;
  const account: AdminAccount = {
    adminId: `admin_${randomBytes(6).toString('hex')}`,
    name,
    pwHash: await hashPassword(pw),
    isSuperAdmin: true,
    createdAt: Date.now(),
  };
  await saveAdminAccount(account);
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * POST /api/admin/auth
 * Body: { name: string, password: string }
 * Returns: { ok, token, adminId, name, isSuperAdmin }
 */
export async function POST(req: NextRequest) {
  // ── Rate limit: 5 attempts / 60 s per IP ─────────────────────────────────
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const { limited, retryAfter } = await checkRateLimit(ip);
  if (limited) {
    return NextResponse.json(
      { ok: false, error: 'Too many login attempts. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  await ensureDefaultAdmin();
  const body = await req.json();
  const { name, password, tournamentId = 'default' } = body as { name?: string; password?: string; tournamentId?: string };
  if (!name?.trim() || !password) {
    return NextResponse.json({ ok: false, error: 'Name and password required' }, { status: 400 });
  }
  const accounts = await listAdminAccounts();
  const account = accounts.find(a => a.name.toLowerCase() === name.trim().toLowerCase());
  if (!account) {
    return NextResponse.json({ ok: false, error: 'Wrong name or password' }, { status: 401 });
  }
  const valid = await verifyPassword(password, account.pwHash);
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Wrong name or password' }, { status: 401 });
  }
  // Upgrade legacy plaintext hash in-place
  if (!account.pwHash.includes(':')) {
    await saveAdminAccount({ ...account, pwHash: await hashPassword(password) });
  }
  const token = await createAdminToken(account.adminId, req);
  // Successful login — register as active admin and clear rate limit
  await registerActiveAdmin(account.adminId);
  await clearRateLimit(ip);

  return NextResponse.json({
    ok: true,
    token,
    adminId: account.adminId,
    name: account.name,
    isSuperAdmin: account.isSuperAdmin ?? false,
  });
}

/**
 * GET /api/admin/auth — verify session and return admin info
 */
export async function GET(req: NextRequest) {
  const adminId = await verifyAdminToken(req);
  if (!adminId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
  const accounts = await listAdminAccounts();
  const me = accounts.find(a => a.adminId === adminId);
  if (!me) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
  // Return own info (used by SuperAdminPanel to check super admin status)
  if (!me?.isSuperAdmin) return NextResponse.json({ ok: true, accounts: [], isSuperAdmin: false, adminId: me.adminId, name: me.name });
  return NextResponse.json({ ok: true, accounts: accounts.map(({ pwHash: _, ...rest }) => rest), isSuperAdmin: true, adminId: me.adminId, name: me.name });
}

/**
 * PATCH /api/admin/auth — manage admin accounts (super admin only)
 * Body actions:
 *   { action: 'create', name, password, isSuperAdmin? }
 *   { action: 'delete', adminId }
 *   { action: 'changePassword', adminId, newPassword }
 */
export async function PATCH(req: NextRequest) {
  const callerId = await verifyAdminToken(req);
  if (!callerId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
  const accounts = await listAdminAccounts();
  const caller = accounts.find(a => a.adminId === callerId);

  const body = await req.json();
  const { action } = body as { action: string };

  if (action === 'create') {
    if (!caller?.isSuperAdmin) return NextResponse.json({ ok: false, error: 'Super admin required' }, { status: 403 });
    const { name, password, isSuperAdmin } = body as { name: string; password: string; isSuperAdmin?: boolean };
    if (!name?.trim() || !password?.trim()) {
      return NextResponse.json({ ok: false, error: 'Name and password required' }, { status: 400 });
    }
    const duplicate = accounts.find(a => a.name.toLowerCase() === name.trim().toLowerCase());
    if (duplicate) return NextResponse.json({ ok: false, error: 'Name already taken' }, { status: 409 });
    const newAccount: AdminAccount = {
      adminId: `admin_${randomBytes(6).toString('hex')}`,
      name: name.trim(),
      pwHash: await hashPassword(password.trim()),
      isSuperAdmin: isSuperAdmin ?? false,
      createdAt: Date.now(),
    };
    const next = await saveAdminAccount(newAccount);
    return NextResponse.json({ ok: true, accounts: next.map(({ pwHash: _, ...rest }) => rest) });
  }

  if (action === 'delete') {
    if (!caller?.isSuperAdmin) return NextResponse.json({ ok: false, error: 'Super admin required' }, { status: 403 });
    const { adminId: targetId } = body as { adminId: string };
    if (targetId === callerId) return NextResponse.json({ ok: false, error: 'Cannot delete yourself' }, { status: 400 });
    const next = await deleteAdminAccount(targetId);
    return NextResponse.json({ ok: true, accounts: next.map(({ pwHash: _, ...rest }) => rest) });
  }

  if (action === 'changePassword') {
    const { adminId: targetId, newPassword } = body as { adminId: string; newPassword: string };
    if (targetId !== callerId && !caller?.isSuperAdmin) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    if (!newPassword?.trim()) return NextResponse.json({ ok: false, error: 'Password required' }, { status: 400 });
    const target = accounts.find(a => a.adminId === targetId);
    if (!target) return NextResponse.json({ ok: false, error: 'Admin not found' }, { status: 404 });
    await saveAdminAccount({ ...target, pwHash: await hashPassword(newPassword.trim()) });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}

/**
 * DELETE /api/admin/auth — logout (revoke current token)
 */
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('X-Admin-Token');
  if (token) {
    // Resolve adminId before revoking so we can unregister them
    const adminId = await verifyAdminToken(req);
    await revokeAdminToken(token);
    if (adminId) await unregisterActiveAdmin(adminId);
  }
  return NextResponse.json({ ok: true });
}
