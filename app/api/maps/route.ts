import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { parseStageMaps } from '@/lib/utils';
import { verifyAdminToken } from '@/app/api/admin/auth/route';

export async function GET() {
  const state = await getState();
  // Return spinQueue along with maps and stageMaps
  return NextResponse.json({ 
    maps: state.maps, 
    stageMaps: state.stageMaps,
    spinQueue: state.spinQueue || [],
    spinCategories: state.spinCategories || [],
    spinItemCategory: state.spinItemCategory || {},
  });
}

export async function POST(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { name } = await req.json();
  const trimmed = name?.trim();
  if (!trimmed) return NextResponse.json({ error: 'Map name required' }, { status: 400 });

  const state = await getState();
  if (state.maps.includes(trimmed)) {
    return NextResponse.json({ error: 'Map already exists' }, { status: 409 });
  }

  const next = await updateState(s => ({ ...s, maps: [...s.maps, trimmed] }));
  return NextResponse.json({ maps: next.maps });
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { name } = await req.json();
  
  const next = await updateState(s => ({
    ...s,
    // ONLY remove from the wheel maps pool. Leave the bracket's stageMaps completely alone!
    maps: s.maps.filter(m => m !== name),
  }));
  
  return NextResponse.json({ maps: next.maps, stageMaps: next.stageMaps });
}

export async function PATCH(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const body = await req.json();
  const { action, stageKey, mapName, slot, spinQueue } = body;

  // Save the Spin Queue to the database (full replace)
  if (action === 'updateSpinQueue') {
    const next = await updateState(s => ({ ...s, spinQueue: spinQueue || [] }));
    return NextResponse.json({ spinQueue: next.spinQueue });
  }

  // Save default (starred) maps and known maps list
  if (action === 'updateDefaultMaps') {
    const { defaultMaps } = body;
    const next = await updateState(s => ({
      ...s,
      ...(defaultMaps !== undefined ? { defaultMaps } : {}),
    }));
    return NextResponse.json({ defaultMaps: next.defaultMaps });
  }

  // Save spin categories and item assignments
  if (action === 'updateSpinCategories') {
    const { spinCategories, spinItemCategory } = body;
    const next = await updateState(s => ({
      ...s,
      ...(spinCategories !== undefined ? { spinCategories } : {}),
      ...(spinItemCategory !== undefined ? { spinItemCategory } : {}),
    }));
    return NextResponse.json({ spinCategories: next.spinCategories, spinItemCategory: next.spinItemCategory });
  }

  // Atomically append one map to the spin queue (avoids client-side stale-state race)
  if (action === 'appendSpinQueue') {
    const { map } = body;
    if (!map) return NextResponse.json({ error: 'map required' }, { status: 400 });
    const next = await updateState(s => ({ ...s, spinQueue: [...(s.spinQueue || []), map] }));
    return NextResponse.json({ spinQueue: next.spinQueue });
  }

  // Broadcast live spin state to all viewers
  if (action === 'updateSpinState') {
    const { spinState } = body;
    const next = await updateState(s => ({ ...s, spinState: spinState ?? null }));
    return NextResponse.json({ spinState: next.spinState });
  }

  if (action === 'assignStage') {
    // slot = 0|1|2 for BO3; default 0 (append to array up to 3)
    const next = await updateState(s => {
      const current: string[] = [...parseStageMaps(s.stageMaps[stageKey])];
      if (slot !== undefined && slot !== null) {
        current[slot] = mapName;
      } else {
        // append if not already present and under 3
        if (!current.includes(mapName) && current.length < 3) current.push(mapName);
      }
      return { ...s, stageMaps: { ...s.stageMaps, [stageKey]: current } };
    });
    return NextResponse.json({ stageMaps: next.stageMaps });
  }

  if (action === 'clearStage') {
    const next = await updateState(s => {
      const sm = { ...s.stageMaps };
      if (slot !== undefined && slot !== null) {
        // Clear a specific map slot
        const current = [...parseStageMaps(sm[stageKey])];
        current.splice(slot, 1);
        if (current.length === 0) delete sm[stageKey];
        else sm[stageKey] = current as unknown as string[];
      } else {
        delete sm[stageKey];
      }
      return { ...s, stageMaps: sm };
    });
    return NextResponse.json({ stageMaps: next.stageMaps });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}