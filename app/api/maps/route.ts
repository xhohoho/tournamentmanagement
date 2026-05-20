import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';

export async function GET() {
  const state = await getState();
  return NextResponse.json({ maps: state.maps, stageMaps: state.stageMaps });
}

export async function POST(req: NextRequest) {
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
  const { name } = await req.json();
  const next = await updateState(s => ({
    ...s,
    maps: s.maps.filter(m => m !== name),
    // Remove from any stage slot arrays too
    stageMaps: Object.fromEntries(
      Object.entries(s.stageMaps).map(([k, v]) => [
        k,
        Array.isArray(v) ? (v as string[]).filter(m => m !== name) : (v === name ? [] : [v as unknown as string]),
      ]).filter(([, v]) => (v as string[]).length > 0)
    ),
  }));
  return NextResponse.json({ maps: next.maps, stageMaps: next.stageMaps });
}

export async function PATCH(req: NextRequest) {
  const { action, stageKey, mapName, slot } = await req.json();

  if (action === 'assignStage') {
    // slot = 0|1|2 for BO3; default 0 (append to array up to 3)
    const next = await updateState(s => {
      const current: string[] = Array.isArray(s.stageMaps[stageKey])
        ? [...(s.stageMaps[stageKey] as unknown as string[])]
        : s.stageMaps[stageKey] ? [s.stageMaps[stageKey] as unknown as string] : [];
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
        const current = Array.isArray(sm[stageKey])
          ? [...(sm[stageKey] as unknown as string[])]
          : sm[stageKey] ? [sm[stageKey] as unknown as string] : [];
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
