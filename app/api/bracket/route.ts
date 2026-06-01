import { NextRequest, NextResponse } from 'next/server';
import { getState, updateState } from '@/lib/kv';
import { shuffle } from '@/lib/utils';
import { checkTournamentAccess } from '@/lib/tournamentAccess';
import {
  emptyMatch,
  cloneBracket,
  resolveWinner,
  sweepBracket,
  buildSE,
  buildDE,
  buildEmptySE,
  buildEmptyDE,
  seedLBDropIn,
} from '@/lib/bracket';
import type { BracketMatch, Bracket, ShuffleReveal, StageFormats } from '@/lib/types';

// ─── GET /api/bracket ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const state = await getState(tid);
  return NextResponse.json({ bracket: state.bracket, elimMode: state.elimMode });
}

// ─── POST /api/bracket ────────────────────────────────────────────────────────
// actions: 'saveFormats' | 'generate' | 'seed'

export async function POST(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;

  const body = await req.json();
  const { elimMode, action = 'generate', stageFormats: sfBody } = body;

  const state = await getState(tid);
  const storedSF: StageFormats = state.stageFormats ?? { groupStage: 'bo1', semiFinal: 'bo3', grandFinal: 'bo3' };
  const sf: StageFormats = sfBody ? { ...storedSF, ...sfBody } : storedSF;

  if (sfBody) await updateState(s => ({ ...s, stageFormats: sf }), tid);

  // ── saveFormats ────────────────────────────────────────────────────────────
  if (action === 'saveFormats') {
    await updateState(s => ({ ...s, stageFormats: sf }), tid);
    return NextResponse.json({ stageFormats: sf });
  }

  if (state.teams.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 teams' }, { status: 400 });
  }

  // ── generate — empty skeleton, no teams placed ─────────────────────────────
  if (action === 'generate') {
    const bracket: Bracket = elimMode === 'single'
      ? buildEmptySE(state.teams.length, sf)
      : buildEmptyDE(state.teams.length, sf);

    const next = await updateState(s => ({ ...s, bracket, elimMode, shuffleState: null }), tid);
    return NextResponse.json({ bracket: next.bracket });
  }

  // ── seed — shuffle teams into bracket + broadcast animation ────────────────
  if (action === 'seed') {
    const fresh = await getState(tid);
    const B = fresh.bracket;
    if (!B) return NextResponse.json({ error: 'Generate bracket structure first' }, { status: 400 });

    const names = shuffle(fresh.teams.map(t => t.customName || t.name));
    let seeded: Bracket;

    if (B.type === 'single') {
      const upperRaw = buildSE(names, sf);
      const thirdPlace = names.length >= 4 ? emptyMatch(sf.semiFinal) : undefined;
      seeded = sweepBracket({ type: 'single', upper: upperRaw, thirdPlace, champion: null });
    } else {
      const { upper, lower } = buildDE(names, sf);
      seeded = sweepBracket({ type: 'double', upper, lower, grandFinal: emptyMatch(sf.grandFinal), champion: null });
    }

    // Build reveal sequence from all filled p1/p2 slots
    const reveals: ShuffleReveal[] = [];
    seeded.upper.forEach((round, ri) =>
      round.forEach((m, mi) => {
        if (m.p1) reveals.push({ slotKey: `m_upper_${ri}_${mi}_p1`, team: m.p1 });
        if (m.p2) reveals.push({ slotKey: `m_upper_${ri}_${mi}_p2`, team: m.p2 });
      }),
    );
    seeded.lower?.forEach((round, ri) =>
      round.forEach((m, mi) => {
        if (m.p1) reveals.push({ slotKey: `m_lower_${ri}_${mi}_p1`, team: m.p1 });
        if (m.p2) reveals.push({ slotKey: `m_lower_${ri}_${mi}_p2`, team: m.p2 });
      }),
    );

    const shuffledReveals = shuffle(reveals);
    const DELAY_MS = 180;
    const totalDuration = shuffledReveals.length * DELAY_MS + 800;
    const shuffleState = { startTime: Date.now(), delayMs: DELAY_MS, reveals: shuffledReveals };

    const next = await updateState(s => ({ ...s, bracket: seeded, shuffleState }), tid);

    setTimeout(async () => {
      await updateState(s => ({ ...s, shuffleState: null }), tid);
    }, totalDuration);

    return NextResponse.json({ bracket: next.bracket, shuffleState });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ─── PATCH /api/bracket ───────────────────────────────────────────────────────
// actions: 'undoMatch' | 'setElimMode' | (score update — no action field)

export async function PATCH(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;

  const body = await req.json();
  const { section, ri, mi, p1wins, p2wins, action, elimMode: newElimMode } = body;

  // ── setElimMode ────────────────────────────────────────────────────────────
  if (action === 'setElimMode') {
    const next = await updateState(s => ({ ...s, elimMode: newElimMode }), tid);
    return NextResponse.json({ elimMode: next.elimMode });
  }

  const state = await getState(tid);
  const B = state.bracket;
  if (!B) return NextResponse.json({ error: 'No bracket' }, { status: 400 });
  const bracket = cloneBracket(B);

  // ── undoMatch ──────────────────────────────────────────────────────────────
  if (action === 'undoMatch') {
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
      const next = await updateState(s => ({ ...s, bracket }), tid);
      return NextResponse.json({ bracket: next.bracket });
    }

    const rounds: BracketMatch[][] | undefined =
      section === 'upper' ? bracket.upper : section === 'lower' ? bracket.lower : undefined;
    if (!rounds) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });

    const match = rounds[ri]?.[mi];
    if (!match?.winner) return NextResponse.json({ error: 'Match not complete' }, { status: 400 });

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
        else if (bracket.grandFinal) {
          bracket.grandFinal.p1 = null; bracket.grandFinal.winner = null; bracket.champion = null;
        }
      } else if (section === 'lower' && bracket.grandFinal) {
        bracket.grandFinal.p2 = null; bracket.grandFinal.winner = null; bracket.champion = null;
      }
    }

    // Undo third-place seeding (SE only)
    if (bracket.type === 'single' && ri === rounds.length - 2 && bracket.thirdPlace) {
      if (mi % 2 === 0 && bracket.thirdPlace.p1 === prevLoser) bracket.thirdPlace.p1 = null;
      if (mi % 2 === 1 && bracket.thirdPlace.p2 === prevLoser) bracket.thirdPlace.p2 = null;
      bracket.thirdPlace.winner = null; bracket.thirdPlace.score1 = 0; bracket.thirdPlace.score2 = 0;
    }

    // Undo LB drop-in (DE only)
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

    const next = await updateState(s => ({ ...s, bracket }), tid);
    return NextResponse.json({ bracket: next.bracket });
  }

  // ── Score update ───────────────────────────────────────────────────────────
  if (section === 'gf') {
    const gf = bracket.grandFinal;
    if (!gf) return NextResponse.json({ error: 'No grand final' }, { status: 400 });

    if (gf.isReset) {
      gf.resetScore1 = p1wins ?? gf.resetScore1 ?? 0;
      gf.resetScore2 = p2wins ?? gf.resetScore2 ?? 0;
      const target = gf.format === 'bo5' ? 3 : gf.format === 'bo3' ? 2 : 1;
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

    const next = await updateState(s => ({ ...s, bracket }), tid);
    return NextResponse.json({ bracket: next.bracket });
  }

  const rounds: BracketMatch[][] | undefined =
    section === 'upper' ? bracket.upper : section === 'lower' ? bracket.lower : undefined;
  if (!rounds) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });

  const match = rounds[ri]?.[mi];
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 400 });

  match.score1 = p1wins ?? match.score1;
  match.score2 = p2wins ?? match.score2;

  const winner = resolveWinner(match);
  if (!winner || match.winner === winner) {
    const next = await updateState(s => ({ ...s, bracket }), tid);
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

  // Seed third place (SE semi-final losers)
  if (bracket.type === 'single' && ri === rounds.length - 2 && loser && bracket.thirdPlace) {
    if (mi % 2 === 0) bracket.thirdPlace.p1 = loser;
    else bracket.thirdPlace.p2 = loser;
  }

  // Seed LB drop-in (DE upper bracket losers)
  if (bracket.type === 'double' && section === 'upper' && loser && bracket.lower) {
    seedLBDropIn(bracket.lower, ri, loser, mi);
  }

  sweepBracket(bracket, ri, section as 'upper' | 'lower');
  if (bracket.grandFinal?.winner) bracket.champion = bracket.grandFinal.winner;

  const next = await updateState(s => ({ ...s, bracket }), tid);
  return NextResponse.json({ bracket: next.bracket });
}

// ─── PUT /api/bracket — third place match ─────────────────────────────────────

export async function PUT(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;

  const { p1wins, p2wins } = await req.json();
  const state = await getState(tid);
  if (!state.bracket?.thirdPlace) return NextResponse.json({ error: 'No 3rd place match' }, { status: 400 });

  const bracket = cloneBracket(state.bracket);
  const tp = bracket.thirdPlace!;
  tp.score1 = p1wins ?? tp.score1;
  tp.score2 = p2wins ?? tp.score2;
  const winner = resolveWinner(tp);
  if (winner) { tp.winner = winner; bracket.third = winner; }

  const next = await updateState(s => ({ ...s, bracket }), tid);
  return NextResponse.json({ bracket: next.bracket });
}

// ─── DELETE /api/bracket ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('t') ?? 'default';
  const access = await checkTournamentAccess(req, tid);
  if (access instanceof NextResponse) return access;

  const next = await updateState(s => ({ ...s, bracket: null, stageMaps: {} }), tid);
  return NextResponse.json({ bracket: next.bracket });
}
