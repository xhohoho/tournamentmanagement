import { NextResponse } from 'next/server';
import { getState } from '@/lib/kv';

export async function GET() {
  const state = await getState();
  // Never expose the password hash to client
  const { adminPwHash: _, ...safe } = state;
  return NextResponse.json(safe);
}
