import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { listAdminAccounts } from '@/lib/kv';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

const PICKER_TICKER_KEY = 'global:picker-ticker';

const DEFAULT_TEXT =
  '⚡ SUDDEN ATTACK SHOP NOW OPEN — Grab your gear at suddenattack.safie.cc — Exclusive deals on weapons, skins & more! 🛒 Click here to visit the shop!';

export async function GET() {
  try {
    const text = await kv.get<string>(PICKER_TICKER_KEY);
    return NextResponse.json({ tickerText: text ?? DEFAULT_TEXT });
  } catch {
    return NextResponse.json({ tickerText: DEFAULT_TEXT });
  }
}

export async function PATCH(req: NextRequest) {
  // Verify token
  const adminId = await verifyAdminToken(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Must be super admin
  const accounts = await listAdminAccounts();
  const me = accounts.find(a => a.adminId === adminId);
  if (!me?.isSuperAdmin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const body = await req.json();
  if (typeof body.tickerText !== 'string') {
    return NextResponse.json({ error: 'tickerText must be a string' }, { status: 400 });
  }

  const trimmed = body.tickerText.trim() || DEFAULT_TEXT;
  await kv.set(PICKER_TICKER_KEY, trimmed);
  return NextResponse.json({ tickerText: trimmed });
}
