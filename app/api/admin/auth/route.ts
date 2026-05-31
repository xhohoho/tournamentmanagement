import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { listAdminAccounts, saveAdminAccount } from '@/lib/kv';
import type { AdminAccount } from '@/lib/types';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// ── Token TTL: 8 hours in seconds ─────────────────────────────────────────
const TOKEN_TTL = 60 * 60 * 8;
const TOKEN_PREFIX = 'admin:token:';

// ── Password helpers ──────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.includes(':')) return password === stored; // legacy plaintext
  const [salt, hashHex] = stored.split(':');
  const storedHash = Buffer.from(hashHex, 'hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return storedHash.length === derived.length && timingSafeEqual(storedHash, derived);
}

// ── Token helpers ─────────────────────────────────────────────────────────
// Tokens now carry the adminId so any route can identify who is acting.
// KV key: admin:token:<token>  value: <adminId>

export async function verifyAdminToken(req: NextRequest): Promise<string | null> {
  // Returns the adminId if valid, null otherwise.
  const token = req.headers.get('X-Admin-Token');
  if (!token) return null;
  try {
    const adminId = await kv.get<string>(`${TOKEN_PREFIX}${token}`);
    return adminId ?? null;
  } catch {
    return null;
  }
}

/** Convenience — returns true/false for routes that only need auth check. */
export async function isAdminTokenValid(req: NextRequest): Promise<boolean> {
  return (await verifyAdminToken(req)) !== null;
}

async function createToken(adminId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await kv.set(`${TOKEN_PREFIX}${token}`, adminId, { ex: TOKEN_TTL });
  return token;
}

async function revokeToken(token: string): Promise<void> {
  await kv.del(`${TOKEN_PREFIX}${token}`);
}

// ── Seed default admin if none exist ─────────────────────────────────────
// On a fresh deploy with no accounts, we bootstrap one from env vars so the
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

// ── Route handlers ────────────────────────────────────────────────────────

/**
 * POST /api/admin/auth
 * Body: { name: string, password: string }
 * Returns: { ok, token, adminId, name, isSuperAdmin }
 */
export async function POST(req: NextRequest) {
  await ensureDefaultAdmin();
  const body = await req.json();
  const { name, password } = body as { name?: string; password?: string };
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
  const token = await createToken(account.adminId);
  return NextResponse.json({
    ok: true,
    token,
    adminId: account.adminId,
    name: account.name,
    isSuperAdmin: account.isSuperAdmin ?? false,
  });
}

/**
 * GET /api/admin/auth/accounts — list all admin accounts (super admin only)
 * We handle this on the same route via GET for simplicity.
 */
export async function GET(req: NextRequest) {
  const adminId = await verifyAdminToken(req);
  if (!adminId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
  const accounts = await listAdminAccounts();
  const me = accounts.find(a => a.adminId === adminId);
  if (!me?.isSuperAdmin) return NextResponse.json({ ok: false, error: 'Super admin required' }, { status: 403 });
  // Never return pwHash to client
  return NextResponse.json({ ok: true, accounts: accounts.map(({ pwHash: _, ...rest }) => rest) });
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
    // Only super admins can create new accounts
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
    const { deleteAdminAccount } = await import('@/lib/kv');
    const next = await deleteAdminAccount(targetId);
    return NextResponse.json({ ok: true, accounts: next.map(({ pwHash: _, ...rest }) => rest) });
  }

  if (action === 'changePassword') {
    const { adminId: targetId, newPassword } = body as { adminId: string; newPassword: string };
    // Admins can only change their own password, super admins can change anyone's
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

// DELETE /api/admin/auth — logout (revoke current token)
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('X-Admin-Token');
  if (token) await revokeToken(token);
  return NextResponse.json({ ok: true });
}
