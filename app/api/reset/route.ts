import { NextResponse } from 'next/server';
import { updateState } from '@/lib/kv';

// DELETE /api/reset — wipe everything except admin password and maps
export async function DELETE() {
  const next = await updateState(s => ({
    ...s,
    players: [],
    roster: [],
    teams: [],
    bracket: null,
    stageMaps: {},
  }));
  const { adminPwHash: _, ...safe } = next;
  return NextResponse.json(safe);
}
