import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { shuffle, nextPow2 } from '@/lib/utils';
import type { BracketMatch, Bracket } from '@/lib/types';

function buildSE(names: string[]): BracketMatch[][] {
  const size = nextPow2(names.length);
  const seeded: (string | null)[] = [...names, ...Array(size - names.length).fill(null)];
  const r0: BracketMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    r0.push({ p1: seeded[i], p2: seeded[i + 1], winner: null });
  }
  const rounds: BracketMatch[][] = [r0];
  let prev = r0;
  while (prev.length > 1) {
    const next: BracketMatch[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push({ p1: null, p2: null, winner: null });
    rounds.push(next);
    prev = next;
  }
  return rounds;
}

function autoByes(rounds: BracketMatch[][]): void {
  for (let ri = 0; ri < rounds.length; ri++) {
    for (let mi = 0; mi < rounds[ri].length; mi++) {
      const m = rounds[ri][mi];
      if (m.winner) continue;
      let byeWinner: string | null = null;
      if (m.p1 && !m.p2) byeWinner = m.p1;
      else if (!m.p1 && m.p2) byeWinner = m.p2;
      if (!byeWinner) continue;
      m.winner = byeWinner;
      if (ri + 1 < rounds.length) {
        const s = Math.floor(mi / 2);
        if (mi % 2 === 0) rounds[ri + 1][s].p1 = byeWinner;
        else rounds[ri + 1][s].p2 = byeWinner;
      }
    }
  }
}

export async function GET() {
  const state = await getState();
  return NextResponse.json({ bracket: state.bracket, elimMode: state.elimMode });
}

export async function POST(req: NextRequest) {
  const { elimMode } = await req.json();
  const state = await getState();

  if (state.teams.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 teams' }, { status: 400 });
  }

  const names = shuffle(state.teams.map(t => t.name));
  let bracket: Bracket;

  if (elimMode === 'single') {
    bracket = { type: 'single', upper: buildSE(names), champion: null };
  } else {
    bracket = {
      type: 'double',
      upper: buildSE(names),
      lower: [],
      grandFinal: { p1: null, p2: null, winner: null },
      champion: null,
    };
  }

  autoByes(bracket.upper);
  const next = await updateState(s => ({ ...s, bracket, elimMode }));
  return NextResponse.json({ bracket: next.bracket });
}

export async function PATCH(req: NextRequest) {
  const { section, ri, mi, player } = await req.json();
  const state = await getState();
  const B = state.bracket;
  if (!B) return NextResponse.json({ error: 'No bracket' }, { status: 400 });

  // Deep clone
  const bracket: Bracket = JSON.parse(JSON.stringify(B));

  let rounds: BracketMatch[][] | undefined;
  if (section === 'upper') rounds = bracket.upper;
  else if (section === 'lower') rounds = bracket.lower;
  else if (section === 'gf') {
    if (bracket.grandFinal) {
      bracket.grandFinal.winner = player;
      bracket.champion = player;
    }
    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  if (!rounds) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });

  const match = rounds[ri][mi];
  const loser = player === match.p1 ? match.p2 : match.p1;
  match.winner = player;

  // Propagate winner
  if (ri + 1 < rounds.length) {
    const s = Math.floor(mi / 2);
    if (mi % 2 === 0) rounds[ri + 1][s].p1 = player;
    else rounds[ri + 1][s].p2 = player;
  } else {
    if (section === 'upper') {
      if (bracket.type === 'single') {
        bracket.champion = player;
      } else if (bracket.grandFinal) {
        bracket.grandFinal.p1 = player;
      }
    } else if (section === 'lower' && bracket.grandFinal) {
      bracket.grandFinal.p2 = player;
    }
  }

  // Drop loser to lower bracket in double elim
  if (bracket.type === 'double' && section === 'upper' && loser) {
    if (!bracket.lower) bracket.lower = [];
    const lri = ri * 2;
    while (bracket.lower.length <= lri) bracket.lower.push([]);
    const lr = bracket.lower[lri];
    const open = lr.find(m => !m.winner && (!m.p1 || !m.p2));
    if (open) {
      if (!open.p1) open.p1 = loser;
      else open.p2 = loser;
    } else {
      lr.push({ p1: loser, p2: null, winner: null });
    }
  }

  autoByes(bracket.upper);
  if (bracket.type === 'double' && bracket.lower) autoByes(bracket.lower);
  if (bracket.grandFinal?.winner) bracket.champion = bracket.grandFinal.winner;

  const next = await updateState(s => ({ ...s, bracket }));
  return NextResponse.json({ bracket: next.bracket });
}

export async function DELETE() {
  const next = await updateState(s => ({ ...s, bracket: null }));
  return NextResponse.json({ bracket: next.bracket });
}
