import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';

// POST /api/admin/auth - verify password
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const state = await getState();
  if (password === state.adminPwHash) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'Wrong password' }, { status: 401 });
}

// PATCH /api/admin/auth - change password (requires current password)
export async function PATCH(req: NextRequest) {
  const { currentPassword, newPassword } = await req.json();
  const state = await getState();
  if (currentPassword !== state.adminPwHash) {
    return NextResponse.json({ ok: false, error: 'Wrong password' }, { status: 401 });
  }
  if (!newPassword?.trim()) {
    return NextResponse.json({ ok: false, error: 'New password required' }, { status: 400 });
  }
  await updateState(s => ({ ...s, adminPwHash: newPassword.trim() }));
  return NextResponse.json({ ok: true });
}
