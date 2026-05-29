import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { shuffle, nextPow2 } from '@/lib/utils';
import { verifyAdminToken } from '@/app/api/admin/auth/route';
import type { BracketMatch, GrandFinal, Bracket, ShuffleReveal } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyMatch(format: 'bo1' | 'bo3' = 'bo1'): BracketMatch {
  return { p1: null, p2: null, winner: null, score1: 0, score2: 0, format };
}

function resolveWinner(match: BracketMatch | GrandFinal): string | null {
  const target = match.format === 'bo3' ? 2 : 1;
  if (match.score1 >= target && match.score2 < target && match.p1) return match.p1;
  if (match.score2 >= target && match.score1 < target && match.p2) return match.p2;
  return null;
}

// Check if the feeder matches for a specific slot are finished so byes can safely advance
function isFeederResolved(bracket: Bracket, section: 'upper' | 'lower', ri: number, mi: number, slot: 0 | 1): boolean {
  if (section === 'upper') {
    if (ri === 0) return true;
    const f = bracket.upper[ri - 1][mi * 2 + slot];
    return f ? !!f.winner : true;
  } else {
    if (ri === 0) {
      // Fed by UB R0
      const f = bracket.upper[0][mi * 2 + slot];
      return f ? !!f.winner : true;
    } else if (ri % 2 === 1) {
      // Odd round (Drop-in): slot 0 is from LB[ri-1], slot 1 is from UB[(ri+1)/2]
      if (slot === 0) {
        const f = bracket.lower![ri - 1][mi];
        return f ? !!f.winner : true;
      } else {
        const ubRi = (ri + 1) / 2;
        const f = bracket.upper[ubRi]?.[mi];
        return f ? !!f.winner : true;
      }
    } else {
      // Even round > 0 (Consolidation): halves the field from LB[ri-1]
      const f = bracket.lower![ri - 1][mi * 2 + slot];
      return f ? !!f.winner : true;
    }
  }
}

/** Recursively advance teams that have no opponent (Byes) */
function sweepBracket(bracket: Bracket): Bracket {
  let sweepAgain = true;
  while (sweepAgain) {
    sweepAgain = false;
    const sections: ('upper' | 'lower')[] = bracket.type === 'double' ? ['upper', 'lower'] : ['upper'];

    for (const section of sections) {
      const rounds = section === 'upper' ? bracket.upper : bracket.lower!;
      for (let ri = 0; ri < rounds.length; ri++) {
        for (let mi = 0; mi < rounds[ri].length; mi++) {
          const m = rounds[ri][mi];
          if (m.winner) continue;

          const f1Resolved = isFeederResolved(bracket, section, ri, mi, 0);
          const f2Resolved = isFeederResolved(bracket, section, ri, mi, 1);

          if (f1Resolved && f2Resolved && ((m.p1 && !m.p2) || (!m.p1 && m.p2))) {
            m.winner = m.p1 || m.p2;
            sweepAgain = true;

            const isLast = ri === rounds.length - 1;
            if (!isLast) {
              if (section === 'upper') {
                const slot = Math.floor(mi / 2);
                if (mi % 2 === 0) rounds[ri + 1][slot].p1 = m.winner;
                else rounds[ri + 1][slot].p2 = m.winner;
              } else {
                if (ri % 2 === 0) {
                  rounds[ri + 1][mi].p1 = m.winner;
                } else {
                  const slot = Math.floor(mi / 2);
                  if (mi % 2 === 0) rounds[ri + 1][slot].p1 = m.winner;
                  else rounds[ri + 1][slot].p2 = m.winner;
                }
              }
            } else {
              if (section === 'upper') {
                if (bracket.type === 'single') bracket.champion = m.winner;
                else if (bracket.grandFinal) bracket.grandFinal.p1 = m.winner;
              } else if (section === 'lower' && bracket.grandFinal) {
                bracket.grandFinal.p2 = m.winner;
              }
            }
          }
        }
      }
    }
  }
  return bracket;
}

// ─── Single Elimination ───────────────────────────────────────────────────────

function buildSE(names: string[], format: 'bo1' | 'bo3' = 'bo1'): BracketMatch[][] {
  const size = nextPow2(names.length);
  const r0: BracketMatch[] = Array.from({ length: size / 2 }, () => emptyMatch(format));

  // Distribute players optimally to avoid dead branches (null v null matches)
  for (let i = 0; i < size / 2; i++) {
    if (i < names.length) r0[i].p1 = names[i];
  }
  let nIdx = size / 2;
  let mIdx = 0;
  while (nIdx < names.length) {
    r0[mIdx].p2 = names[nIdx++];
    mIdx += 2; // skip every other match to spread byes
    if (mIdx >= size / 2) mIdx = 1;
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

function buildDE(names: string[], format: 'bo1' | 'bo3' = 'bo1'): { upper: BracketMatch[][]; lower: BracketMatch[][] } {
  const upper = buildSE(names, format);
  const ubRounds = upper.length;
  const lower: BracketMatch[][] = [];
  const lbRoundCount = 2 * (ubRounds - 1);

  let lbSize = Math.max(1, Math.floor(upper[0].length / 2));
  for (let lri = 0; lri < lbRoundCount; lri++) {
    lower.push(Array.from({ length: lbSize }, () => emptyMatch(format)));
    if (lri % 2 === 1) lbSize = Math.max(1, Math.floor(lbSize / 2));
  }

  return { upper, lower };
}

function seedLBDropIn(lower: BracketMatch[][], ubRi: number, loser: string, slotHint: number): void {
  if (ubRi === 0) {
    const m = lower[0]?.[Math.floor(slotHint / 2)];
    if (m) {
      if (!m.p1) m.p1 = loser;
      else m.p2 = loser;
    }
  } else {
    const lbRi = ubRi * 2 - 1;
    const m = lower[lbRi]?.[slotHint];
    if (m) m.p2 = loser;
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  const state = await getState();
  return NextResponse.json({ bracket: state.bracket, elimMode: state.elimMode });
}

export async function POST(req: NextRequest) {
  if (!await verifyAdminToken(req)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const body = await req.json();
  const { elimMode, matchFormat = 'bo1', action = 'generate' } = body;
  const fmt: 'bo1' | 'bo3' = matchFormat === 'bo3' ? 'bo3' : 'bo1';
  const state = await getState();

  if (state.teams.length < 2) return NextResponse.json({ error: 'Need at least 2 teams' }, { status: 400 });

  // ── action: 'generate' — build empty skeleton, no teams placed ──────────────
  if (action === 'generate') {
    const teamCount = state.teams.length;
    let bracket: Bracket;

    if (elimMode === 'single') {
      const size = nextPow2(teamCount);
      const r0: BracketMatch[] = Array.from({ length: size / 2 }, () => emptyMatch(fmt));
      const rounds: BracketMatch[][] = [r0];
      let prev = r0;
      while (prev.length > 1) {
        const next: BracketMatch[] = [];
        for (let i = 0; i < prev.length; i += 2) next.push(emptyMatch(fmt));
        rounds.push(next);
        prev = next;
      }
      const thirdPlace = teamCount >= 4 ? emptyMatch(fmt) : undefined;
      bracket = { type: 'single', upper: rounds, thirdPlace, champion: null };
    } else {
      const { upper: upperRaw, lower: lowerRaw } = buildDE(Array(state.teams.length).fill(''), fmt);
      // Clear any accidental placeholders — all slots empty
      upperRaw.forEach(r => r.forEach(m => { m.p1 = null; m.p2 = null; }));
      lowerRaw.forEach(r => r.forEach(m => { m.p1 = null; m.p2 = null; }));
      bracket = { type: 'double', upper: upperRaw, lower: lowerRaw, grandFinal: emptyMatch(fmt), champion: null };
    }

    const next = await updateState(s => ({ ...s, bracket, elimMode, shuffleState: null }));
    return NextResponse.json({ bracket: next.bracket });
  }

  // ── action: 'seed' — shuffle teams into bracket + broadcast animation ───────
  if (action === 'seed') {
    const state2 = await getState();
    const B = state2.bracket;
    if (!B) return NextResponse.json({ error: 'Generate bracket structure first' }, { status: 400 });

    const names = shuffle(state2.teams.map(t => t.customName || t.name));
    let seeded: Bracket;

    if (B.type === 'single') {
      const upperRaw = buildSE(names, fmt);
      const thirdPlace = names.length >= 4 ? emptyMatch(fmt) : undefined;
      seeded = sweepBracket({ type: 'single', upper: upperRaw, thirdPlace, champion: null });
    } else {
      const { upper: upperRaw, lower: lowerRaw } = buildDE(names, fmt);
      seeded = sweepBracket({ type: 'double', upper: upperRaw, lower: lowerRaw, grandFinal: emptyMatch(fmt), champion: null });
    }

    // Build reveal sequence: collect all p1/p2 slots that have a team name
    const reveals: ShuffleReveal[] = [];
    seeded.upper.forEach((round, ri) =>
      round.forEach((m, mi) => {
        if (m.p1) reveals.push({ slotKey: `m_upper_${ri}_${mi}_p1`, team: m.p1 });
        if (m.p2) reveals.push({ slotKey: `m_upper_${ri}_${mi}_p2`, team: m.p2 });
      })
    );
    if (seeded.lower) {
      seeded.lower.forEach((round, ri) =>
        round.forEach((m, mi) => {
          if (m.p1) reveals.push({ slotKey: `m_lower_${ri}_${mi}_p1`, team: m.p1 });
          if (m.p2) reveals.push({ slotKey: `m_lower_${ri}_${mi}_p2`, team: m.p2 });
        })
      );
    }
    // Shuffle the reveal order for drama
    const shuffledReveals = shuffle(reveals);
    const DELAY_MS = 180;
    const totalDuration = shuffledReveals.length * DELAY_MS + 800;
    const startTime = Date.now();

    const shuffleState = { startTime, delayMs: DELAY_MS, reveals: shuffledReveals };

    // Write seeded bracket + shuffleState together
    const next = await updateState(s => ({ ...s, bracket: seeded, shuffleState }));

    // Schedule clearing shuffleState after animation completes
    setTimeout(async () => {
      await updateState(s => ({ ...s, shuffleState: null }));
    }, totalDuration);

    return NextResponse.json({ bracket: next.bracket, shuffleState });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  if (!await verifyAdminToken(req)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const body = await req.json();
  const { section, ri, mi, p1wins, p2wins, action, elimMode: newElimMode } = body;

  if (action === 'undoMatch') {
    const state = await getState();
    const B = state.bracket;
    if (!B) return NextResponse.json({ error: 'No bracket' }, { status: 400 });
    const bracket: Bracket = JSON.parse(JSON.stringify(B));

    if (section === 'gf') {
      const gf = bracket.grandFinal;
      if (!gf) return NextResponse.json({ error: 'No grand final' }, { status: 400 });
      if (gf.isReset && (gf.resetScore1 ?? 0) === 0 && (gf.resetScore2 ?? 0) === 0) {
        gf.isReset = false; gf.resetScore1 = 0; gf.resetScore2 = 0;
      } else if (gf.isReset) {
        gf.winner = null; bracket.champion = null; gf.resetScore1 = 0; gf.resetScore2 = 0;
      } else {
        gf.winner = null; gf.score1 = 0; gf.score2 = 0; bracket.champion = null;
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
    const prevLoser = prevWinner === match.p1 ? match.p2 : match.p1;

    match.winner = null; match.score1 = 0; match.score2 = 0;

    const isLastRound = ri === rounds.length - 1;
    if (!isLastRound) {
      if (section === 'upper') {
        const slot = Math.floor(mi / 2);
        const target = rounds[ri + 1][slot];
        if (target.p1 === prevWinner) target.p1 = null;
        if (target.p2 === prevWinner) target.p2 = null;
        target.winner = null; target.score1 = 0; target.score2 = 0;
      } else {
        if (ri % 2 === 0) {
          const target = rounds[ri + 1][mi];
          if (target.p1 === prevWinner) target.p1 = null;
          target.winner = null; target.score1 = 0; target.score2 = 0;
        } else {
          const slot = Math.floor(mi / 2);
          const target = rounds[ri + 1][slot];
          if (target.p1 === prevWinner) target.p1 = null;
          if (target.p2 === prevWinner) target.p2 = null;
          target.winner = null; target.score1 = 0; target.score2 = 0;
        }
      }
    } else {
      if (section === 'upper') {
        if (bracket.type === 'single') bracket.champion = null;
        else if (bracket.grandFinal) { bracket.grandFinal.p1 = null; bracket.grandFinal.winner = null; bracket.champion = null; }
      } else if (section === 'lower' && bracket.grandFinal) {
        bracket.grandFinal.p2 = null; bracket.grandFinal.winner = null; bracket.champion = null;
      }
    }

    if (bracket.type === 'single' && ri === rounds.length - 2 && bracket.thirdPlace) {
      if (mi % 2 === 0 && bracket.thirdPlace.p1 === prevLoser) bracket.thirdPlace.p1 = null;
      if (mi % 2 === 1 && bracket.thirdPlace.p2 === prevLoser) bracket.thirdPlace.p2 = null;
      bracket.thirdPlace.winner = null; bracket.thirdPlace.score1 = 0; bracket.thirdPlace.score2 = 0;
    }

    if (bracket.type === 'double' && section === 'upper' && prevLoser && bracket.lower) {
      if (ri === 0) {
        const m = bracket.lower[0]?.[Math.floor(mi / 2)];
        if (m) {
          if (m.p1 === prevLoser) { m.p1 = null; m.winner = null; m.score1 = 0; m.score2 = 0; }
          else if (m.p2 === prevLoser) { m.p2 = null; m.winner = null; m.score1 = 0; m.score2 = 0; }
        }
      } else {
        const m = bracket.lower[ri * 2 - 1]?.[mi];
        if (m && m.p2 === prevLoser) { m.p2 = null; m.winner = null; m.score1 = 0; m.score2 = 0; }
      }
    }

    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  if (action === 'setElimMode') {
    const next = await updateState(s => ({ ...s, elimMode: newElimMode }));
    return NextResponse.json({ elimMode: next.elimMode });
  }

  const state = await getState();
  const B = state.bracket;
  if (!B) return NextResponse.json({ error: 'No bracket' }, { status: 400 });

  const bracket: Bracket = JSON.parse(JSON.stringify(B));

  if (section === 'gf') {
    const gf = bracket.grandFinal;
    if (!gf) return NextResponse.json({ error: 'No grand final' }, { status: 400 });

    if (gf.isReset) {
      gf.resetScore1 = p1wins ?? gf.resetScore1 ?? 0;
      gf.resetScore2 = p2wins ?? gf.resetScore2 ?? 0;
      const target = gf.format === 'bo3' ? 2 : 1;
      if ((gf.resetScore1 ?? 0) >= target && gf.p1) { gf.winner = gf.p1; bracket.champion = gf.p1; }
      else if ((gf.resetScore2 ?? 0) >= target && gf.p2) { gf.winner = gf.p2; bracket.champion = gf.p2; }
    } else {
      gf.score1 = p1wins ?? gf.score1;
      gf.score2 = p2wins ?? gf.score2;
      const winner = resolveWinner(gf);
      if (winner) {
        if (winner === gf.p1) { gf.winner = winner; bracket.champion = winner; }
        else { gf.isReset = true; gf.resetScore1 = 0; gf.resetScore2 = 0; }
      }
    }
    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  let rounds: BracketMatch[][] | undefined;
  if (section === 'upper') rounds = bracket.upper;
  else if (section === 'lower') rounds = bracket.lower;
  if (!rounds) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });

  const match = rounds[ri]?.[mi];
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 400 });

  match.score1 = p1wins ?? match.score1;
  match.score2 = p2wins ?? match.score2;

  const winner = resolveWinner(match);
  if (!winner || match.winner === winner) {
    const next = await updateState(s => ({ ...s, bracket }));
    return NextResponse.json({ bracket: next.bracket });
  }

  const loser = winner === match.p1 ? match.p2 : match.p1;
  match.winner = winner;

  const isLastRound = ri === rounds.length - 1;
  if (!isLastRound) {
    if (section === 'upper') {
      const slot = Math.floor(mi / 2);
      if (mi % 2 === 0) rounds[ri + 1][slot].p1 = winner;
      else rounds[ri + 1][slot].p2 = winner;
    } else {
      if (ri % 2 === 0) {
        rounds[ri + 1][mi].p1 = winner;
      } else {
        const slot = Math.floor(mi / 2);
        if (mi % 2 === 0) rounds[ri + 1][slot].p1 = winner;
        else rounds[ri + 1][slot].p2 = winner;
      }
    }
  } else {
    if (section === 'upper') {
      if (bracket.type === 'single') bracket.champion = winner;
      else if (bracket.grandFinal) bracket.grandFinal.p1 = winner;
    } else if (section === 'lower' && bracket.grandFinal) {
      bracket.grandFinal.p2 = winner;
    }
  }

  if (bracket.type === 'single') {
    const isSemiFinal = ri === rounds.length - 2;
    if (isSemiFinal && loser && bracket.thirdPlace) {
      if (mi % 2 === 0) bracket.thirdPlace.p1 = loser;
      else bracket.thirdPlace.p2 = loser;
    }
  }

  if (bracket.type === 'double' && section === 'upper' && loser && bracket.lower) {
    seedLBDropIn(bracket.lower, ri, loser, mi);
  }

  sweepBracket(bracket);
  if (bracket.grandFinal?.winner) bracket.champion = bracket.grandFinal.winner;

  const next = await updateState(s => ({ ...s, bracket }));
  return NextResponse.json({ bracket: next.bracket });
}

export async function PUT(req: NextRequest) {
  if (!await verifyAdminToken(req)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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
  if (!await verifyAdminToken(req)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const next = await updateState(s => ({ ...s, bracket: null, stageMaps: {} }));
  return NextResponse.json({ bracket: next.bracket });
}