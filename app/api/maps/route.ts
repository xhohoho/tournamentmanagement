import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState, safeState } from '@/lib/kv';
import { parseStageMaps } from '@/lib/utils';
import { checkTournamentAccess } from '@/lib/tournamentAccess';

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ 
    maps: state.maps, 
    usedMaps: state.usedMaps ?? [],
    stageMaps: state.stageMaps,
    spinQueue: state.spinQueue || [],
    spinCategories: state.spinCategories || [],
    spinItemCategory: state.spinItemCategory || {},
  });
}

export async function POST(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;
  const { name } = await req.json();
  const trimmed = name?.trim();
  if (!trimmed) return NextResponse.json({ error: 'Map name required' }, { status: 400 });

  const state = await getState(tid);
  if (state.maps.includes(trimmed)) {
    return NextResponse.json({ error: 'Map already exists' }, { status: 409 });
  }

  const next = await updateState(s => ({ ...s, maps: [...s.maps, trimmed] }), tid);
  return NextResponse.json({ maps: next.maps });
}

export async function DELETE(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;
  const { name } = await req.json();
  
  const next = await updateState(s => {
    // Also clean up any stageMaps entries that reference the deleted map.
    const stageMaps: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(s.stageMaps)) {
      const filtered = (val as string[]).filter(m => m !== name);
      if (filtered.length > 0) stageMaps[key] = filtered;
    }
    return {
      ...s,
      maps: s.maps.filter(m => m !== name),
      stageMaps,
    };
  }, tid);
  
  return NextResponse.json({ maps: next.maps, stageMaps: next.stageMaps });
}

export async function PATCH(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;
  const body = await req.json();
  const { action, stageKey, mapName, slot, spinQueue } = body;

  // Move a map from the active wheel into the usedMaps pool (hides it from the wheel without deleting).
  if (action === 'moveToUsed') {
    const { map } = body;
    if (!map) return NextResponse.json({ error: 'map required' }, { status: 400 });
    const next = await updateState(s => {
      if ((s.usedMaps ?? []).includes(map)) return s; // already used
      return { ...s, usedMaps: [...(s.usedMaps ?? []), map] };
    }, tid);
    return NextResponse.json({ usedMaps: next.usedMaps ?? [] });
  }

  // Restore one or all maps from usedMaps back to the active wheel.
  if (action === 'restoreUsed') {
    const { map } = body; // if omitted → restore all
    const next = await updateState(s => ({
      ...s,
      usedMaps: map ? (s.usedMaps ?? []).filter(m => m !== map) : [],
    }), tid);
    return NextResponse.json({ usedMaps: next.usedMaps ?? [] });
  }

  if (action === 'updateSpinQueue') {
    const next = await updateState(s => ({ ...s, spinQueue: spinQueue || [] }), tid);
    return NextResponse.json({ spinQueue: next.spinQueue });
  }

  if (action === 'updateDefaultMaps') {
    const { defaultMaps } = body;
    const next = await updateState(s => ({
      ...s,
      ...(defaultMaps !== undefined ? { defaultMaps } : {}),
    }), tid);
    return NextResponse.json({ defaultMaps: next.defaultMaps });
  }

  if (action === 'updateSpinCategories') {
    const { spinCategories, spinItemCategory } = body;
    const next = await updateState(s => ({
      ...s,
      ...(spinCategories !== undefined ? { spinCategories } : {}),
      ...(spinItemCategory !== undefined ? { spinItemCategory } : {}),
    }), tid);
    return NextResponse.json({ spinCategories: next.spinCategories, spinItemCategory: next.spinItemCategory });
  }

  if (action === 'appendSpinQueue') {
    const { map } = body;
    if (!map) return NextResponse.json({ error: 'map required' }, { status: 400 });
    const next = await updateState(s => ({ ...s, spinQueue: [...(s.spinQueue || []), map] }), tid);
    return NextResponse.json({ spinQueue: next.spinQueue });
  }

  // Clear all: restore usedMaps back to wheel, wipe spinQueue + categories.
  if (action === 'clearAll') {
    const next = await updateState(s => ({
      ...s,
      usedMaps: [],
      spinQueue: [],
      spinCategories: s.spinCategories, // keep category definitions, clear assignments only
      spinItemCategory: {},
    }), tid);
    return NextResponse.json({
      usedMaps: next.usedMaps ?? [],
      spinQueue: next.spinQueue,
      spinCategories: next.spinCategories,
      spinItemCategory: next.spinItemCategory,
    });
  }

  if (action === 'updateSpinState') {
    const { spinState } = body;
    const next = await updateState(s => ({ ...s, spinState: spinState ?? null }), tid);
    return NextResponse.json({ spinState: next.spinState });
  }

  if (action === 'assignStage') {
    const next = await updateState(s => {
      const current: string[] = [...parseStageMaps(s.stageMaps[stageKey])];
      if (slot !== undefined && slot !== null) {
        current[slot] = mapName;
      } else {
        if (!current.includes(mapName) && current.length < 3) current.push(mapName);
      }
      return { ...s, stageMaps: { ...s.stageMaps, [stageKey]: current } };
    }, tid);
    return NextResponse.json({ stageMaps: next.stageMaps });
  }

  if (action === 'clearStage') {
    const next = await updateState(s => {
      const sm = { ...s.stageMaps };
      if (slot !== undefined && slot !== null) {
        const current = [...parseStageMaps(sm[stageKey])];
        current.splice(slot, 1);
        if (current.length === 0) delete sm[stageKey];
        else sm[stageKey] = current as unknown as string[];
      } else {
        delete sm[stageKey];
      }
      return { ...s, stageMaps: sm };
    }, tid);
    return NextResponse.json({ stageMaps: next.stageMaps });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
