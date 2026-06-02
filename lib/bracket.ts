import { nextPow2 } from '@/lib/utils';
import type { BracketMatch, GrandFinal, Bracket, StageFormats } from '@/lib/types';

// ─── Primitives ───────────────────────────────────────────────────────────────

export function emptyMatch(format: 'bo1' | 'bo3' | 'bo5' = 'bo1'): BracketMatch {
  return { p1: null, p2: null, winner: null, score1: 0, score2: 0, format };
}

export function cloneBracket(b: Bracket): Bracket {
  return JSON.parse(JSON.stringify(b));
}

// ─── Winner resolution ────────────────────────────────────────────────────────

export function resolveWinner(match: BracketMatch | GrandFinal): string | null {
  const target = match.format === 'bo5' ? 3 : match.format === 'bo3' ? 2 : 1;
  if (match.score1 >= target && match.score2 < target && match.p1) return match.p1;
  if (match.score2 >= target && match.score1 < target && match.p2) return match.p2;
  return null;
}

// ─── Stage format resolver ────────────────────────────────────────────────────
/**
 * Maps a round index to the correct match format for each bracket section.
 *
 * Naming convention (12-team DE example, nextPow2=16, 4 UB rounds, 6 LB rounds):
 *
 *  UB (upper_de):  R0 R1 R2  R3(UF)              → BO1 BO1 BO1 BO3
 *  LB (lower):     R0 R1 R2 R3  R4(SF) R5(LBF)    → BO1 BO1 BO1 BO1 BO3 BO5
 *  GF:             always grandFinal               → BO5
 *  SE (upper):     R0…Rn-2(SF) Rn-1(F)            → BO1…BO3 BO5
 *
 * Rules:
 *  upper_de  last only       → semiFinal   (Upper Final seeds GF p1)
 *  lower     last two        → semiFinal   (LB Semi + LB Final; LB Final loser = 3rd place)
 *  upper/SE  last → grandFinal, second-to-last → semiFinal, rest → groupStage
 *  gf        always          → grandFinal
 */
export function stageFormat(
  sf: StageFormats,
  totalRounds: number,
  roundIdx: number,
  section: 'upper' | 'upper_de' | 'lower' | 'gf' = 'upper',
): 'bo1' | 'bo3' | 'bo5' {
  if (section === 'gf') return sf.grandFinal;

  if (section === 'upper_de') {
    if (roundIdx === totalRounds - 1) return sf.semiFinal; // Upper Final → BO3
    return sf.groupStage;                                  // All other UB rounds → BO1
  }

  if (section === 'lower') {
    if (roundIdx >= totalRounds - 2) return sf.semiFinal; // LB Semi + LB Final → BO3
    return sf.groupStage;                                 // Early LB rounds → BO1
  }

  // SE upper bracket: last round IS the Grand Final, second-to-last is Semi Final.
  if (roundIdx === totalRounds - 1) return sf.grandFinal;
  if (roundIdx === totalRounds - 2) return sf.semiFinal;
  return sf.groupStage;
}

// ─── Feeder resolution (for bye sweeping) ────────────────────────────────────

function isFeederResolved(
  bracket: Bracket,
  section: 'upper' | 'lower',
  ri: number,
  mi: number,
  slot: 0 | 1,
): boolean {
  if (section === 'upper') {
    if (ri === 0) return true;
    const f = bracket.upper[ri - 1][mi * 2 + slot];
    return f ? !!f.winner : true;
  } else {
    if (ri === 0) {
      const f = bracket.upper[0][mi * 2 + slot];
      return f ? !!f.winner : true;
    } else if (ri % 2 === 1) {
      // Odd round (Drop-in): slot 0 from LB[ri-1], slot 1 from UB[(ri+1)/2]
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

// ─── Bye sweep ────────────────────────────────────────────────────────────────

/** Advance any team that has no opponent (bye) through all applicable rounds. Mutates in place.
 *
 * @param fromRi      - First round index to start sweeping from (default 0). Pass the
 *                      round where the triggering change occurred so earlier settled
 *                      rounds are skipped on the initial pass.
 * @param fromSection - Section to begin sweeping from on the initial pass (default 'upper').
 *                      Subsequent re-sweep passes always restart from round 0 of 'upper'.
 */
export function sweepBracket(
  bracket: Bracket,
  fromRi = 0,
  fromSection: 'upper' | 'lower' = 'upper',
): Bracket {
  const sections: ('upper' | 'lower')[] =
    bracket.type === 'double' ? ['upper', 'lower'] : ['upper'];

  let firstPass = true;
  let sweepAgain = true;
  while (sweepAgain) {
    sweepAgain = false;

    for (const section of sections) {
      const rounds = section === 'upper' ? bracket.upper : bracket.lower!;

      // On the very first pass, skip rounds that precede the changed match;
      // on subsequent re-sweep passes restart from 0 so cascading byes propagate.
      const startRi = (firstPass && section === fromSection)
        ? fromRi
        : (firstPass && section === 'lower' && fromSection === 'upper')
          ? 0   // always sweep lower from 0, even on first pass
          : 0;

      for (let ri = startRi; ri < rounds.length; ri++) {
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

export function buildSE(names: string[], sf: StageFormats, isDE = false): BracketMatch[][] {
  const size = nextPow2(names.length);
  const roundCount = Math.log2(size);
  const sec = isDE ? 'upper_de' : 'upper';

  const r0: BracketMatch[] = Array.from(
    { length: size / 2 },
    () => emptyMatch(stageFormat(sf, roundCount, 0, sec)),
  );

  // Distribute players to avoid dead branches (null vs null matches)
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
  let ri = 1;
  while (prev.length > 1) {
    const next: BracketMatch[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(emptyMatch(stageFormat(sf, roundCount, ri, sec)));
    }
    rounds.push(next);
    prev = next;
    ri++;
  }
  return rounds;
}

// ─── Double Elimination ───────────────────────────────────────────────────────

export function buildDE(
  names: string[],
  sf: StageFormats,
): { upper: BracketMatch[][]; lower: BracketMatch[][] } {
  const upper = buildSE(names, sf, true);
  const ubRounds = upper.length;
  const lower: BracketMatch[][] = [];
  const lbRoundCount = 2 * (ubRounds - 1);

  let lbSize = Math.max(1, Math.floor(upper[0].length / 2));
  for (let lri = 0; lri < lbRoundCount; lri++) {
    lower.push(
      Array.from({ length: lbSize }, () => emptyMatch(stageFormat(sf, lbRoundCount, lri, 'lower'))),
    );
    if (lri % 2 === 1) lbSize = Math.max(1, Math.floor(lbSize / 2));
  }

  return { upper, lower };
}

/** Place a UB loser into the correct LB drop-in slot. Mutates lower in place. */
export function seedLBDropIn(
  lower: BracketMatch[][],
  ubRi: number,
  loser: string,
  slotHint: number,
): void {
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

// ─── Empty skeleton builders (generate action — no teams placed) ──────────────

export function buildEmptySE(teamCount: number, sf: StageFormats): Bracket {
  const size = nextPow2(teamCount);
  const roundCount = Math.log2(size);
  const r0: BracketMatch[] = Array.from(
    { length: size / 2 },
    () => emptyMatch(stageFormat(sf, roundCount, 0, 'upper')),
  );
  const rounds: BracketMatch[][] = [r0];
  let prev = r0;
  let ri = 1;
  while (prev.length > 1) {
    const next: BracketMatch[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(emptyMatch(stageFormat(sf, roundCount, ri, 'upper')));
    }
    rounds.push(next);
    prev = next;
    ri++;
  }
  const thirdPlace = teamCount >= 4 ? emptyMatch(sf.semiFinal) : undefined;
  return { type: 'single', upper: rounds, thirdPlace, champion: null };
}

export function buildEmptyDE(teamCount: number, sf: StageFormats): Bracket {
  const { upper, lower } = buildDE(Array(teamCount).fill(''), sf);
  upper.forEach(r => r.forEach(m => { m.p1 = null; m.p2 = null; }));
  lower.forEach(r => r.forEach(m => { m.p1 = null; m.p2 = null; }));
  return { type: 'double', upper, lower, grandFinal: emptyMatch(sf.grandFinal), champion: null };
}

// ─── Winner propagation ────────────────────────────────────────────────────────────

/**
 * Propagate a match winner into the next round / grand final, and seed
 * the third-place match (SE) or LB drop-in (DE) for the loser.
 * Mutates `bracket` in place.
 */
export function propagateWinner(
  bracket: Bracket,
  section: 'upper' | 'lower',
  ri: number,
  mi: number,
  winner: string,
  loser: string | null,
): void {
  const rounds = section === 'upper' ? bracket.upper : bracket.lower;
  if (!rounds) return;
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
}

/**
 * Undo the result of a completed match: clear its winner/scores and remove
 * the propagated winner from the next round (or grand final).
 * Also undoes third-place seeding (SE) and LB drop-in (DE).
 * Mutates `bracket` in place. Returns false if the match has no winner to undo.
 */
export function undoMatchResult(
  bracket: Bracket,
  section: 'upper' | 'lower',
  ri: number,
  mi: number,
): boolean {
  const rounds = section === 'upper' ? bracket.upper : bracket.lower;
  if (!rounds) return false;
  const match = rounds[ri]?.[mi];
  if (!match?.winner) return false;

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

  return true;
}
