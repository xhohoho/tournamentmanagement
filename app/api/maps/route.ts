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
    stageMaps: Object.fromEntries(
      Object.entries(s.stageMaps).filter(([, v]) => v !== name)
    ),
  }));
  return NextResponse.json({ maps: next.maps, stageMaps: next.stageMaps });
}

export async function PATCH(req: NextRequest) {
  const { action, stageKey, mapName } = await req.json();

  if (action === 'assignStage') {
    const next = await updateState(s => ({
      ...s,
      stageMaps: { ...s.stageMaps, [stageKey]: mapName },
    }));
    return NextResponse.json({ stageMaps: next.stageMaps });
  }

  if (action === 'clearStage') {
    const next = await updateState(s => {
      const sm = { ...s.stageMaps };
      delete sm[stageKey];
      return { ...s, stageMaps: sm };
    });
    return NextResponse.json({ stageMaps: next.stageMaps });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
