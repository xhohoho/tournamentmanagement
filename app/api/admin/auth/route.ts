import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { randomBytes } from 'crypto';

// In-memory token store. Survives for the server process lifetime.
// In a multi-instance deployment, use KV for token storage instead.
const validTokens = new Set<string>();

export function verifyAdminToken(req: NextRequest): boolean {
  const token = req.headers.get('X-Admin-Token');
  return !!token && validTokens.has(token);
}

// POST /api/admin/auth — verify password, return session token
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const state = await getState();
  if (password !== state.adminPwHash) {
    return NextResponse.json({ ok: false, error: 'Wrong password' }, { status: 401 });
  }
  const token = randomBytes(32).toString('hex');
  validTokens.add(token);
  return NextResponse.json({ ok: true, token });
}

// PATCH /api/admin/auth — change password (requires valid session token)
export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
  }
  const { newPassword } = await req.json();
  if (!newPassword?.trim()) {
    return NextResponse.json({ ok: false, error: 'New password required' }, { status: 400 });
  }
  await updateState(s => ({ ...s, adminPwHash: newPassword.trim() }));
  return NextResponse.json({ ok: true });
}
