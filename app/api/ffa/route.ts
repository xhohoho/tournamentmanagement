import { NextRequest, NextResponse } from 'next/server';
import { updateState } from '@/lib/kv';
import { checkTournamentAccess } from '@/lib/tournamentAccess';
import type { FFAMatch, FFAMapInfo, FFAPlayerScore } from '@/lib/types';

function makeId() {
  return `ffa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/ffa?t=xxx — returns ffa state
export async function GET(req: NextRequest) {
  const { getState } = await import('@/lib/kv');
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ ffa: state.ffa });
}

// POST /api/ffa?t=xxx — create a new FFA match
// body: { mapInfo: FFAMapInfo }
export async function POST(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;

  const body = await req.json();
  const mapInfo: FFAMapInfo = body.mapInfo;
  if (!mapInfo) return NextResponse.json({ error: 'mapInfo required' }, { status: 400 });

  const newMatch: FFAMatch = {
    id: makeId(),
    createdAt: Date.now(),
    mapInfo,
    scores: [],
    locked: false,
  };

  const next = await updateState(s => ({
    ...s,
    ffa: {
      ...s.ffa,
      matches: [...(s.ffa?.matches ?? []), newMatch],
    },
  }), tid);

  return NextResponse.json({ ffa: next.ffa });
}

// PATCH /api/ffa?t=xxx — update ffa data
// actions:
//   updateMapInfo    { matchId, mapInfo }
//   updateScore      { matchId, playerName, score, imageUrl? }
//   removeScore      { matchId, playerName }
//   setPlayers       { players: string[] }
//   setScores        { matchId, scores: FFAPlayerScore[] }
//   lockMatch        { matchId, locked: boolean }
//   deleteMatch      { matchId }
//   setMatchImage    { matchId, imageUrl }         — updates mapInfo.imageUrl (header banner)
//   setScoreImage    { matchId, scoreImageUrl }    — updates match.scoreImageUrl (score tab screenshot)
export async function PATCH(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;

  const body = await req.json();
  const { action, matchId } = body;

  if (action === 'setPlayers') {
    const { players } = body as { players: string[] };
    const next = await updateState(s => ({
      ...s,
      ffa: { ...s.ffa, players },
    }), tid);
    return NextResponse.json({ ffa: next.ffa });
  }

  if (action === 'updateMapInfo') {
    const { mapInfo } = body as { mapInfo: FFAMapInfo };
    const next = await updateState(s => ({
      ...s,
      ffa: {
        ...s.ffa,
        matches: (s.ffa?.matches ?? []).map(m =>
          m.id === matchId ? { ...m, mapInfo } : m
        ),
      },
    }), tid);
    return NextResponse.json({ ffa: next.ffa });
  }

  if (action === 'setMatchImage') {
    const { imageUrl } = body as { imageUrl: string };
    const next = await updateState(s => ({
      ...s,
      ffa: {
        ...s.ffa,
        matches: (s.ffa?.matches ?? []).map(m =>
          m.id === matchId ? { ...m, mapInfo: { ...m.mapInfo, imageUrl } } : m
        ),
      },
    }), tid);
    return NextResponse.json({ ffa: next.ffa });
  }

  if (action === 'setScoreImage') {
    const { scoreImageUrl } = body as { scoreImageUrl: string };
    const next = await updateState(s => ({
      ...s,
      ffa: {
        ...s.ffa,
        matches: (s.ffa?.matches ?? []).map(m =>
          m.id === matchId ? { ...m, scoreImageUrl } : m
        ),
      },
    }), tid);
    return NextResponse.json({ ffa: next.ffa });
  }

  if (action === 'updateScore') {
    const { playerName, score, imageUrl } = body as { playerName: string; score: number; imageUrl?: string };
    const next = await updateState(s => ({
      ...s,
      ffa: {
        ...s.ffa,
        matches: (s.ffa?.matches ?? []).map(m => {
          if (m.id !== matchId) return m;
          const existing = m.scores.find(sc => sc.playerName === playerName);
          const updated: FFAPlayerScore = { playerName, score, ...(imageUrl !== undefined ? { imageUrl } : existing?.imageUrl ? { imageUrl: existing.imageUrl } : {}) };
          const scores = existing
            ? m.scores.map(sc => sc.playerName === playerName ? updated : sc)
            : [...m.scores, updated];
          return { ...m, scores };
        }),
      },
    }), tid);
    return NextResponse.json({ ffa: next.ffa });
  }

  if (action === 'setScores') {
    const { scores } = body as { scores: FFAPlayerScore[] };
    const next = await updateState(s => ({
      ...s,
      ffa: {
        ...s.ffa,
        matches: (s.ffa?.matches ?? []).map(m =>
          m.id === matchId ? { ...m, scores } : m
        ),
      },
    }), tid);
    return NextResponse.json({ ffa: next.ffa });
  }

  if (action === 'removeScore') {
    const { playerName } = body as { playerName: string };
    const next = await updateState(s => ({
      ...s,
      ffa: {
        ...s.ffa,
        matches: (s.ffa?.matches ?? []).map(m =>
          m.id === matchId
            ? { ...m, scores: m.scores.filter(sc => sc.playerName !== playerName) }
            : m
        ),
      },
    }), tid);
    return NextResponse.json({ ffa: next.ffa });
  }

  if (action === 'lockMatch') {
    const { locked } = body as { locked: boolean };
    const next = await updateState(s => ({
      ...s,
      ffa: {
        ...s.ffa,
        matches: (s.ffa?.matches ?? []).map(m =>
          m.id === matchId ? { ...m, locked } : m
        ),
      },
    }), tid);
    return NextResponse.json({ ffa: next.ffa });
  }

  if (action === 'deleteMatch') {
    const next = await updateState(s => ({
      ...s,
      ffa: {
        ...s.ffa,
        matches: (s.ffa?.matches ?? []).filter(m => m.id !== matchId),
      },
    }), tid);
    return NextResponse.json({ ffa: next.ffa });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
