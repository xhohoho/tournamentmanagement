import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { shuffle, nextPow2 } from '@/lib/utils';
import { verifyAdminToken } from '@/app/api/admin/auth/route';
import type { BracketMatch, GrandFinal, Bracket } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyMatch(format: 'bo1' | 'bo3' = 'bo1'): BracketMatch {
  return { p1: null, p2: null, winner: null, score1: 0, score2: 0, format };
}

/** Returns the winning team name if the match is decided, else null. */
function resolveWinner(match: BracketMatch | GrandFinal): string | null {
  const target = match.format === 'bo3' ? 2 : 1;
  if (match.score1 >= target && match.p1) return match.p1;
  if (match.score2 >= target && match.p2) return match.p2;
  return null;
}

/**
 * Walk a round array and auto-advance any team that has a bye (only one
 * participant AND the missing slot cannot possibly be filled by a future
 * winner — i.e. the feeder match is already done or doesn't exist).
 * Returns a new deep-copied array — does not mutate its input.
 */
function autoByes(rounds: BracketMatch[][]): BracketMatch[][] {
  // Deep-copy so callers can pass their working copy without a separate clone step
  const result: BracketMatch[][] = rounds.map(r => r.map(m => ({ ...m })));
  for (let ri = 0; ri < result.length; ri++) {
    for (let mi = 0; mi < result[ri].length; mi++) {
      const m = result[ri][mi];
      if (m.winner) continue;
      // Only treat as a bye if exactly one slot is filled and there is no
      // prior round that could still produce an opponent for the empty slot.
      // If ri === 0 there is no feeder round, so a null slot is a real bye.
      // If ri > 0, check that the feeder match that would fill the empty slot
      // is already decided (has a winner) — meaning no real opponent is coming.
      let byeWinner: string | null = null;
      if (m.p1 && !m.p2) {
        // p2 slot is empty — is it a real bye or just waiting?
        const feederMi = mi * 2 + 1; // the feeder match that produces p2
        const feederMatch = ri > 0 ? result[ri - 1][feederMi] : undefined;
        // Real bye: no previous round, or the feeder is already done (winner set)
        if (ri === 0 || !feederMatch || feederMatch.winner) byeWinner = m.p1;
      } else if (!m.p1 && m.p2) {
        const feederMi = mi * 2; // the feeder match that produces p1
        const feederMatch = ri > 0 ? result[ri - 1][feederMi] : undefined;
        if (ri === 0 || !feederMatch || feederMatch.winner) byeWinner = m.p2;
      }
      if (!byeWinner) continue;
      m.winner = byeWinner;
      if (ri + 1 < result.length) {
        const s = Math.floor(mi / 2);
        if (mi % 2 === 0) result[ri + 1][s].p1 = byeWinner;
        else              result[ri + 1][s].p2 = byeWinner;
      }
    }
  }
  return result;
}

// ─── Single Elimination ───────────────────────────────────────────────────────

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

// ─── Double Elimination ───────────────────────────────────────────────────────

/**
 * Build a complete double-elimination lower bracket skeleton.
 *
 * For U upper rounds there are (2U - 2) lower rounds:
 *   Even LB rounds (0, 2, 4…) are "drop-in" rounds — UB losers seed in.
 *   Odd LB rounds  (1, 3, 5…) are "consolidation" rounds — LB survivors play.
 *
 * Match counts per lower round:
 *   LB R0: UB_R0_matches / 2   (two UB R0 losers share each LB match)
 *   LB R1: same
 *   LB R2: half of LB R1  (one UB R1 loser per LB match)
 *   LB R3: same
 *   … until 1 match remains (LB Final)
 */
function buildDE(
  names: string[],
  format: 'bo1' | 'bo3' = 'bo1'
): { upper: BracketMatch[][]; lower: BracketMatch[][] } {
  const upper = buildSE(names, format);
  const ubRounds = upper.length;

  // Classic double-elim: 2*(U-1) lower rounds
  const lbRoundCount = 2 * (ubRounds - 1);
  const lower: BracketMatch[][] = [];

  // LB R0 has half as many matches as UB R0 (pairs of losers share a match)
  let lbSize = Math.max(1, Math.floor(upper[0].length / 2));

  for (let lri = 0; lri < lbRoundCount; lri++) {
    lower.push(Array.from({ length: lbSize }, () => emptyMatch(format)));
    // After each consolidation round (odd index) the field halves
    if (lri % 2 === 1) lbSize = Math.max(1, Math.floor(lbSize / 2));
  }

  return { upper, lower };
}

/**
 * Seed a UB loser into the correct LB drop-in round.
 * UB round ri  →  LB drop-in round ri*2.
 * slotHint (UB match index) determines which LB match slot to fill so that
 * two losers from the same UB round go into different LB matches.
 */
function seedLBDropIn(
  lower: BracketMatch[][],
  lbRi: number,
  loser: string,
  slotHint: number
): void {
  const lbRound = lower[lbRi];
  if (!lbRound) return;
  const matchIdx = Math.min(Math.floor(slotHint / 2), lbRound.length - 1);
  const m = lbRound[matchIdx];
  if (!m) return;
  if (!m.p1) m.p1 = loser;
  else if (!m.p2) m.p2 = loser;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  const state = await getState();
  return NextResponse.json({ bracket: state.bracket, elimMode: state.elimMode });
}

export async function POST(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { elimMode, matchFormat = 'bo1' } = await req.json();
  const fmt: 'bo1' | 'bo3' = matchFormat === 'bo3' ? 'bo3' : 'bo1';
  const state = await getState();

  if (state.teams.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 teams' }, { status: 400 });
  }

  const names = shuffle(state.teams.map(t => t.name));
  let bracket: Bracket;

  if (elimMode === 'single') {
    const upperRaw = buildSE(names, fmt);
    const upper = autoByes(upperRaw);
    const thirdPlace = names.length >= 4 ? emptyMatch(fmt) : undefined;
    bracket = { type: 'single', upper, thirdPlace, champion: null };
  } else {
    const { upper: upperRaw, lower: lowerRaw } = buildDE(names, fmt);
    const upper = autoByes(upperRaw);
    const lower = autoByes(lowerRaw);
    bracket = { type: 'double', upper, lower, grandFinal: emptyMatch(fmt), champion: null };
  }

  const next = await updateState(s => ({ ...s, bracket, elimMode }));
  return NextResponse.json({ bracket: next.bracket });
}

export async function PATCH(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const body = await req.json();
  const { section, ri, mi, p1wins, p2wins, action, elimMode: newElimMode } = body;

  // Undo a completed match — clear winner/scores and reverse propagation
  if (action === 'undoMatch') {
    const state = await getState();
    const B = state.bracket;
    if (!B) return NextResponse.json({ error: 'No bracket' }, { status: 400 });
    const bracket: Bracket = JSON.parse(JSON.stringify(B));

    // Undo grand final (GF2 reset first, then GF1)
    if (section === 'gf') {
      const gf = bracket.grandFinal;
      if (!gf) return NextResponse.json({ error: 'No grand final' }, { status: 400 });
      if (gf.isReset && (gf.resetScore1 ?? 0) === 0 && (gf.resetScore2 ?? 0) === 0) {
        // Undo the reset itself (revert to GF1 state where LB finalist won)
        gf.isReset = false;
        gf.resetScore1 = 0;
        gf.resetScore2 = 0;
      } else if (gf.isReset) {
        // Undo GF2 result only
        gf.winner = null;
        bracket.champion = null;
        gf.resetScore1 = 0;
        gf.resetScore2 = 0;
      } else {
        // Undo GF1
        gf.winner = null;
        gf.score1 = 0;
        gf.score2 = 0;
        bracket.champion = null;
      }
      const next = await updateState(s => ({ ...s, bracket }));
      return NextResponse.json({ bracket: next.bracket });
    }

    let rounds: BracketMatch[][] | undefined;
    if (section === 'upper') rounds = bracket.upper;
    else if (section === 'lower') rounds = bracket.lower;
    if (!rounds) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });

    const match = rounds[ri]?.[mi];
    if (!match || !match.winner) return NextResponse.json({ error: 'Match not complete' }, { status: 400 });

    const prevWinner = match.winner;
    const prevLoser  = prevWinner === match.p1 ? match.p2 : match.p1;

    // Clear the match
    match.winner = null; match.score1 = 0; match.score2 = 0;

    // Reverse winner propagation
    const isLastRound = ri === rounds.length - 1;
    if (!isLastRound) {
      const slot = Math.floor(mi / 2);
      const target = rounds[ri + 1][slot];
      if (target.p1 === prevWinner) target.p1 = null;
      if (target.p2 === prevWinner) target.p2 = null;
      // Clear onward matches too if they already used the propagated winner
      target.winner = null; target.score1 = 0; target.score2 = 0;
    } else {
      if (section === 'upper') {
        if (bracket.type === 'single') bracket.champion = null;
        else if (bracket.grandFinal) { bracket.grandFinal.p1 = null; bracket.grandFinal.winner = null; bracket.champion = null; }
      } else if (section === 'lower' && bracket.grandFinal) {
        bracket.grandFinal.p2 = null; bracket.grandFinal.winner = null; bracket.champion = null;
      }
    }

    // Reverse 3rd place seeding for single-elim semi-finals
    if (bracket.type === 'single' && ri === rounds.length - 2 && bracket.thirdPlace) {
      if (mi % 2 === 0 && bracket.thirdPlace.p1 === prevLoser) bracket.thirdPlace.p1 = null;
      if (mi % 2 === 1 && bracket.thirdPlace.p2 === prevLoser) bracket.thirdPlace.p2 = null;
      bracket.thirdPlace.winner = null; bracket.thirdPlace.score1 = 0; bracket.thirdPlace.score2 = 0;
    }

    // Reverse LB drop-in for double-elim upper rounds
    if (bracket.type === 'double' && section === 'upper' && prevLoser && bracket.lower) {
      const lbRi = ri * 2;
      const lbRound = bracket.lower[lbRi];
      if (lbRound) {
        const matchIdx = Math.min(Math.floor(mi / 2), lbRound.length - 1);
        const lbMatch = lbRound[matchIdx];
        if (lbMatch) {
          if (lbMatch.p1 === prevLoser) { lbMatch.p1 = null; lbMatch.winner = null; lbMatch.score1 = 0; lbMatch.score2 = 0; }
          else if (lbMatch.p2 === prevLoser) { lbMatch.p2 = null; lbMatch.winner = null; lbMatch.score1 = 0; lbMatch.score2 = 0; }
        }
      }
    }

    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  // Persist elimMode without touching the bracket
  if (action === 'setElimMode') {
    const next = await updateState(s => ({ ...s, elimMode: newElimMode }));
    return NextResponse.json({ elimMode: next.elimMode });
  }

  const state = await getState();
  const B = state.bracket;
  if (!B) return NextResponse.json({ error: 'No bracket' }, { status: 400 });

  const bracket: Bracket = JSON.parse(JSON.stringify(B));

  // ── Grand Final ─────────────────────────────────────────────────────────────
  if (section === 'gf') {
    const gf = bracket.grandFinal;
    if (!gf) return NextResponse.json({ error: 'No grand final' }, { status: 400 });

    if (gf.isReset) {
      // ── GF2: bracket-reset match ──────────────────────────────────────────
      gf.resetScore1 = p1wins ?? gf.resetScore1 ?? 0;
      gf.resetScore2 = p2wins ?? gf.resetScore2 ?? 0;
      const target = gf.format === 'bo3' ? 2 : 1;
      if ((gf.resetScore1 ?? 0) >= target && gf.p1) {
        gf.winner = gf.p1;
        bracket.champion = gf.p1;
      } else if ((gf.resetScore2 ?? 0) >= target && gf.p2) {
        gf.winner = gf.p2;
        bracket.champion = gf.p2;
      }
    } else {
      // ── GF1 ──────────────────────────────────────────────────────────────
      gf.score1 = p1wins ?? gf.score1;
      gf.score2 = p2wins ?? gf.score2;
      const winner = resolveWinner(gf);
      if (winner) {
        // p1 is the upper-bracket finalist (0 losses), p2 is the lower-bracket finalist (1 loss)
        if (winner === gf.p1) {
          // Upper bracket wins → tournament over, no reset needed
          gf.winner = winner;
          bracket.champion = winner;
        } else {
          // Lower bracket wins → both have 1 loss now → bracket reset (GF2)
          gf.isReset = true;
          gf.resetScore1 = 0;
          gf.resetScore2 = 0;
          // Do NOT set gf.winner or bracket.champion yet
        }
      }
    }
    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  // ── Upper or Lower round ────────────────────────────────────────────────────
  let rounds: BracketMatch[][] | undefined;
  if (section === 'upper') rounds = bracket.upper;
  else if (section === 'lower') rounds = bracket.lower;
  if (!rounds) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });

  const match = rounds[ri]?.[mi];
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 400 });

  match.score1 = p1wins ?? match.score1;
  match.score2 = p2wins ?? match.score2;

  const winner = resolveWinner(match);
  if (!winner) {
    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  // Don't re-propagate if winner is unchanged
  if (match.winner === winner) {
    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  const loser = winner === match.p1 ? match.p2 : match.p1;
  match.winner = winner;

  // ── Propagate winner forward ─────────────────────────────────────────────────
  const isLastRound = ri === rounds.length - 1;

  if (!isLastRound) {
    // Advance within the same bracket section
    const slot = Math.floor(mi / 2);
    if (mi % 2 === 0) rounds[ri + 1][slot].p1 = winner;
    else              rounds[ri + 1][slot].p2 = winner;
  } else {
    // Winner of the final round of a section
    if (section === 'upper') {
      if (bracket.type === 'single') {
        bracket.champion = winner;
      } else if (bracket.grandFinal) {
        bracket.grandFinal.p1 = winner; // UB Final winner → GF p1
      }
    } else if (section === 'lower' && bracket.grandFinal) {
      bracket.grandFinal.p2 = winner;   // LB Final winner → GF p2
    }
  }

  // ── Single elim: semi-final loser → 3rd place match ─────────────────────────
  if (bracket.type === 'single') {
    const isSemiFinal = ri === rounds.length - 2;
    if (isSemiFinal && loser && bracket.thirdPlace) {
      if (mi % 2 === 0) bracket.thirdPlace.p1 = loser;
      else              bracket.thirdPlace.p2 = loser;
    }
  }

  // ── Double elim: UB loser → correct LB drop-in round ────────────────────────
  if (bracket.type === 'double' && section === 'upper' && loser && bracket.lower) {
    seedLBDropIn(bracket.lower, ri * 2, loser, mi);
  }

  // Advance any byes created by the seeding above (only for truly null slots, not pending matches)
  bracket.upper = autoByes(bracket.upper);
  if (bracket.lower) bracket.lower = autoByes(bracket.lower);
  if (bracket.grandFinal?.winner) bracket.champion = bracket.grandFinal.winner;

  const next = await updateState(s => ({ ...s, bracket }));
  return NextResponse.json({ bracket: next.bracket });
}

// Handle 3rd place score update (single elim only)
export async function PUT(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const { p1wins, p2wins } = await req.json();
  const state = await getState();
  const B = state.bracket;
  if (!B || !B.thirdPlace) return NextResponse.json({ error: 'No 3rd place match' }, { status: 400 });
  const bracket: Bracket = JSON.parse(JSON.stringify(B));
  const tp = bracket.thirdPlace!;
  tp.score1 = p1wins ?? tp.score1;
  tp.score2 = p2wins ?? tp.score2;
  const winner = resolveWinner(tp);
  if (winner) { tp.winner = winner; bracket.third = winner; }
  const next = await updateState(s => ({ ...s, bracket }));
  return NextResponse.json({ bracket: next.bracket });
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const next = await updateState(s => ({ ...s, bracket: null }));
  return NextResponse.json({ bracket: next.bracket });
}
