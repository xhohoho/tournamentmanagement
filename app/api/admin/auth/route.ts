import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { kv } from '@vercel/kv';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// ── Token TTL: 8 hours in seconds ──────────────────────────────────────────
const TOKEN_TTL = 60 * 60 * 8;
const TOKEN_PREFIX = 'admin:token:';

// ── Password helpers ───────────────────────────────────────────────────────

/**
 * Hash a plaintext password using scrypt.
 * Returns a string in the format `salt:hash` (both hex-encoded).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored hash string.
 * Handles legacy plaintext passwords (no `:` separator) by falling back
 * to a direct equality check so existing installs aren't locked out.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Legacy plaintext — stored value has no salt:hash format
  if (!stored.includes(':')) {
    return password === stored;
  }
  const [salt, hashHex] = stored.split(':');
  const storedHash = Buffer.from(hashHex, 'hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  // timingSafeEqual prevents timing attacks
  return storedHash.length === derived.length && timingSafeEqual(storedHash, derived);
}

// ── Token helpers (KV-backed, survive restarts & multi-instance) ───────────

export async function verifyAdminToken(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('X-Admin-Token');
  if (!token) return false;
  try {
    const stored = await kv.get<string>(`${TOKEN_PREFIX}${token}`);
    return stored === 'valid';
  } catch {
    return false;
  }
}

async function createToken(): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await kv.set(`${TOKEN_PREFIX}${token}`, 'valid', { ex: TOKEN_TTL });
  return token;
}

async function revokeToken(token: string): Promise<void> {
  await kv.del(`${TOKEN_PREFIX}${token}`);
}

// ── Route handlers ─────────────────────────────────────────────────────────

// POST /api/admin/auth — verify password, return session token
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password) {
    return NextResponse.json({ ok: false, error: 'Password required' }, { status: 400 });
  }
  const state = await getState();
  const valid = await verifyPassword(password, state.adminPwHash);
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Wrong password' }, { status: 401 });
  }

  // If the stored password is still plaintext, upgrade it to a hash now
  if (!state.adminPwHash.includes(':')) {
    const hashed = await hashPassword(password);
    await updateState(s => ({ ...s, adminPwHash: hashed }));
  }

  const token = await createToken();
  return NextResponse.json({ ok: true, token });
}

// PATCH /api/admin/auth — change password (requires valid session token)
export async function PATCH(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
  }
  const { newPassword } = await req.json();
  if (!newPassword?.trim()) {
    return NextResponse.json({ ok: false, error: 'New password required' }, { status: 400 });
  }
  const hashed = await hashPassword(newPassword.trim());
  await updateState(s => ({ ...s, adminPwHash: hashed }));
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/auth — logout (revoke current token)
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('X-Admin-Token');
  if (token) await revokeToken(token);
  return NextResponse.json({ ok: true });
}
