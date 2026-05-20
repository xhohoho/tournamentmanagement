import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { shuffle, nextPow2 } from '@/lib/utils';
import type { BracketMatch, GrandFinal, Bracket } from '@/lib/types';

function emptyMatch(format: 'bo1' | 'bo3' = 'bo1'): BracketMatch {
  return { p1: null, p2: null, winner: null, score1: 0, score2: 0, format };
}

function buildSE(names: string[], format: 'bo1' | 'bo3' = 'bo1'): BracketMatch[][] {
  const size = nextPow2(names.length);
  const seeded: (string | null)[] = [...names, ...Array(size - names.length).fill(null)];
  const r0: BracketMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    r0.push({ p1: seeded[i], p2: seeded[i + 1], winner: null, score1: 0, score2: 0, format });
  }
  const rounds: BracketMatch[][] = [r0];
  let prev = r0;
  while (prev.length > 1) {
    const next: BracketMatch[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(emptyMatch(format));
    rounds.push(next);
    prev = next;
  }
  return rounds;
}

// Build a 3rd-place match bracket (one extra match with the two semi-final losers)
function buildThirdPlace(format: 'bo1' | 'bo3' = 'bo1'): BracketMatch {
  return emptyMatch(format);
}

// Returns winner if score determines it (bo1: any win; bo3: first to 2)
function resolveWinner(match: BracketMatch | GrandFinal): string | null {
  const target = match.format === 'bo3' ? 2 : 1;
  if (match.score1 >= target && match.p1) return match.p1;
  if (match.score2 >= target && match.p2) return match.p2;
  return null;
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
    const upper = buildSE(names);
    // If 4+ teams, add a 3rd place match (losers of semi-finals)
    const thirdPlace = names.length >= 4 ? buildThirdPlace() : null;
    bracket = { type: 'single', upper, thirdPlace: thirdPlace ?? undefined, champion: null };
  } else {
    bracket = {
      type: 'double',
      upper: buildSE(names),
      lower: [],
      grandFinal: { p1: null, p2: null, winner: null, score1: 0, score2: 0, format: 'bo1' },
      champion: null,
    };
  }

  autoByes(bracket.upper);
  const next = await updateState(s => ({ ...s, bracket, elimMode }));
  return NextResponse.json({ bracket: next.bracket });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { section, ri, mi, p1wins, p2wins, action, elimMode: newElimMode } = body;

  // Persist elimMode without touching the bracket
  if (action === 'setElimMode') {
    const next = await updateState(s => ({ ...s, elimMode: newElimMode }));
    return NextResponse.json({ elimMode: next.elimMode });
  }

  const state = await getState();
  const B = state.bracket;
  if (!B) return NextResponse.json({ error: 'No bracket' }, { status: 400 });

  const bracket: Bracket = JSON.parse(JSON.stringify(B));

  // Grand final score update
  if (section === 'gf') {
    const gf = bracket.grandFinal;
    if (!gf) return NextResponse.json({ error: 'No grand final' }, { status: 400 });
    gf.score1 = p1wins ?? gf.score1;
    gf.score2 = p2wins ?? gf.score2;
    const winner = resolveWinner(gf);
    if (winner) { gf.winner = winner; bracket.champion = winner; }
    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  let rounds: BracketMatch[][] | undefined;
  if (section === 'upper') rounds = bracket.upper;
  else if (section === 'lower') rounds = bracket.lower;
  if (!rounds) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });

  const match = rounds[ri][mi];
  match.score1 = p1wins ?? match.score1;
  match.score2 = p2wins ?? match.score2;

  const winner = resolveWinner(match);
  if (!winner) {
    // Scores updated but no winner yet — save and return
    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  // Already had a winner — don't re-propagate
  if (match.winner === winner) {
    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  const loser = winner === match.p1 ? match.p2 : match.p1;
  match.winner = winner;

  // Is this the semi-final round? (second-to-last round, each match feeds into the final)
  const isSemiFinal = bracket.type === 'single' && ri === rounds.length - 2 && bracket.thirdPlace;

  // Propagate winner forward
  if (ri + 1 < rounds.length) {
    const s = Math.floor(mi / 2);
    if (mi % 2 === 0) rounds[ri + 1][s].p1 = winner;
    else rounds[ri + 1][s].p2 = winner;
    // Drop semi-final loser into 3rd place match
    if (isSemiFinal && loser && bracket.thirdPlace) {
      if (mi % 2 === 0) bracket.thirdPlace.p1 = loser;
      else bracket.thirdPlace.p2 = loser;
    }
  } else {
    if (section === 'upper') {
      if (bracket.type === 'single') {
        bracket.champion = winner;
      } else if (bracket.grandFinal) {
        bracket.grandFinal.p1 = winner;
      }
    } else if (section === 'lower' && bracket.grandFinal) {
      bracket.grandFinal.p2 = winner;
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
      lr.push({ p1: loser, p2: null, winner: null, score1: 0, score2: 0, format: match.format });
    }
  }

  autoByes(bracket.upper);
  if (bracket.type === 'double' && bracket.lower) autoByes(bracket.lower);
  if (bracket.grandFinal?.winner) bracket.champion = bracket.grandFinal.winner;

  const next = await updateState(s => ({ ...s, bracket }));
  return NextResponse.json({ bracket: next.bracket });
}

// Handle 3rd place score update
export async function PUT(req: NextRequest) {
  const { p1wins, p2wins } = await req.json();
  const state = await getState();
  const B = state.bracket;
  if (!B || !B.thirdPlace) return NextResponse.json({ error: 'No 3rd place match' }, { status: 400 });
  const bracket: Bracket = JSON.parse(JSON.stringify(B));
  const tp = bracket.thirdPlace!;
  tp.score1 = p1wins ?? tp.score1;
  tp.score2 = p2wins ?? tp.score2;
  const winner = resolveWinner(tp);
  if (winner) tp.winner = winner;
  const next = await updateState(s => ({ ...s, bracket }));
  return NextResponse.json({ bracket: next.bracket });
}

export async function DELETE() {
  const next = await updateState(s => ({ ...s, bracket: null }));
  return NextResponse.json({ bracket: next.bracket });
}
