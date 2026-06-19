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
 *  UB (upper_de):  R0 R1 R2  R3(UF)              all rounds -> upperBracket (incl. Upper Final)
 *  LB (lower):     R0 R1 R2 R3 R4  R5(LBF)       R0-R4 -> lowerBracket, R5 (true final) -> lowerBracketFinal
 *  GF:             always grandFinal              -> grandFinal
 *  SE (upper):     R0...Rn-2 Rn-1(F)              all but last -> upperBracket, last -> grandFinal
 *
 * Rules:
 *  upper_de  every round (incl. Upper Final) -> upperBracket
 *  lower     last round ONLY                 -> lowerBracketFinal (winner advances to GF)
 *            all other rounds                -> lowerBracket
 *  upper/SE  last -> grandFinal, rest -> upperBracket (single elim has no lower bracket)
 *  gf        always                          -> grandFinal
 */
export function stageFormat(
  sf: StageFormats,
  totalRounds: number,
  roundIdx: number,
  section: 'upper' | 'upper_de' | 'lower' | 'gf' = 'upper',
): 'bo1' | 'bo3' | 'bo5' {
  if (section === 'gf') return sf.grandFinal;

  if (section === 'upper_de') {
    return sf.upperBracket; // every UB round, including the Upper Final, shares one format
  }

  if (section === 'lower') {
    if (roundIdx === totalRounds - 1) return sf.lowerBracketFinal; // true LB Final only
    return sf.lowerBracket;                                       // every other LB round
  }

  // SE upper bracket: last round IS the Grand Final; everything before it is Upper Bracket.
  if (roundIdx === totalRounds - 1) return sf.grandFinal;
  return sf.upperBracket;
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
  const thirdPlace = teamCount >= 4 ? emptyMatch(sf.upperBracket) : undefined;
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

// ─── Match numbering + feeder labels (shared by BracketTab + CasterSheetTab) ──

export type MatchNumbers = {
  upper: number[][];
  lower: number[][];
  thirdPlace: number | null;
  gf: number | null;
};

export function computeMatchNumbers(bracket: Bracket): MatchNumbers {
  const ubRounds = bracket.upper.filter(r => r.length > 0);
  const lbRounds = (bracket.lower || []).filter(r => r.length > 0);
  const upper: number[][] = ubRounds.map(r => new Array(r.length).fill(0));
  const lower: number[][] = lbRounds.map(r => new Array(r.length).fill(0));
  let n = 1;
  const assignUpper = (colIdx: number) => { for (let mi = 0; mi < upper[colIdx].length; mi++) upper[colIdx][mi] = n++; };
  const assignLower = (colIdx: number) => { for (let mi = 0; mi < lower[colIdx].length; mi++) lower[colIdx][mi] = n++; };

  if (bracket.type === 'single') {
    ubRounds.forEach((_, colIdx) => assignUpper(colIdx));
    const thirdPlace = bracket.thirdPlace ? n++ : null;
    return { upper, lower: [], thirdPlace, gf: null };
  }

  const U = ubRounds.length;
  const L = lbRounds.length;
  for (let i = 0; i < U - 1; i++) {
    assignUpper(i);
    if (i < L) assignLower(i);
  }
  for (let i = U - 1; i < L - 1; i++) assignLower(i);
  if (U > 0) assignUpper(U - 1);
  if (L > 0) assignLower(L - 1);
  const gf = bracket.grandFinal ? n++ : null;

  return { upper, lower, thirdPlace: null, gf };
}

export function feederLabel(
  numbers: MatchNumbers,
  section: 'upper' | 'lower' | 'gf' | 'thirdPlace',
  colIdx: number,
  mi: number,
  slot: 1 | 2,
): string | null {
  if (section === 'upper') {
    if (colIdx === 0) return null;
    const prevMi = slot === 1 ? mi * 2 : mi * 2 + 1;
    const num = numbers.upper[colIdx - 1]?.[prevMi];
    return num ? `Winner of ${num}` : null;
  }
  if (section === 'lower') {
    if (colIdx === 0) {
      const ubMi = slot === 1 ? mi * 2 : mi * 2 + 1;
      const num = numbers.upper[0]?.[ubMi];
      return num ? `Loser of ${num}` : null;
    }
    if (colIdx % 2 === 1) {
      if (slot === 1) {
        const num = numbers.lower[colIdx - 1]?.[mi];
        return num ? `Winner of ${num}` : null;
      }
      const ubRoundIdx = (colIdx + 1) / 2;
      const num = numbers.upper[ubRoundIdx]?.[mi];
      return num ? `Loser of ${num}` : null;
    }
    const prevMi = slot === 1 ? mi * 2 : mi * 2 + 1;
    const num = numbers.lower[colIdx - 1]?.[prevMi];
    return num ? `Winner of ${num}` : null;
  }
  if (section === 'gf') {
    const num = slot === 1
      ? numbers.upper[numbers.upper.length - 1]?.[0]
      : numbers.lower[numbers.lower.length - 1]?.[0];
    return num ? `Winner of ${num}` : null;
  }
  const semiColIdx = numbers.upper.length - 2;
  const num = numbers.upper[semiColIdx]?.[slot === 1 ? 0 : 1];
  return num ? `Loser of ${num}` : null;
}

function roundLabel(colIdx: number, totalRounds: number, roundLen: number, prefix: string): string {
  const isFinal = colIdx === totalRounds - 1 && roundLen === 1;
  const isSemi = colIdx === totalRounds - 2 && roundLen === 2 && totalRounds >= 3;
  const isQuarter = colIdx === totalRounds - 3 && roundLen === 4 && totalRounds >= 4;
  if (prefix === '') {
    return isFinal ? 'Final' : isSemi ? 'Semi Final' : isQuarter ? 'Quarter Final' : `Round ${colIdx + 1}`;
  }
  return isFinal ? `${prefix} Final` : `${prefix} Round ${colIdx + 1}`;
}

/** A single bracket match slot, flattened for list display (e.g. the Caster Sheet). */
export interface BracketSlotInfo {
  key: string;     // e.g. "m_upper_0_0" — matches the matchKey used by BracketTab
  number: number;  // overall match number badge
  label: string;   // e.g. "Upper Round 1", "Grand Final"
  p1: string;       // actual team name, feeder hint ("Winner of 3"), or "TBD"
  p2: string;
  isDone: boolean;
}

/** Flatten every match slot in a bracket — including ones still TBD — in match-number order. */
export function listBracketSlots(bracket: Bracket): BracketSlotInfo[] {
  const numbers = computeMatchNumbers(bracket);
  const slots: BracketSlotInfo[] = [];
  const resolve = (actual: string | null, placeholder: string | null) => actual ?? placeholder ?? 'TBD';

  if (bracket.type === 'single') {
    const rounds = bracket.upper.filter(r => r.length > 0);
    rounds.forEach((round, colIdx) => {
      const label = roundLabel(colIdx, rounds.length, round.length, '');
      round.forEach((match, mi) => {
        const number = numbers.upper[colIdx]?.[mi];
        if (number == null) return;
        slots.push({
          key: `m_upper_${colIdx}_${mi}`,
          number,
          label,
          p1: resolve(match.p1, feederLabel(numbers, 'upper', colIdx, mi, 1)),
          p2: resolve(match.p2, feederLabel(numbers, 'upper', colIdx, mi, 2)),
          isDone: !!match.winner,
        });
      });
    });
    if (bracket.thirdPlace) {
      slots.push({
        key: 'm_thirdPlace_0_0',
        number: numbers.thirdPlace ?? slots.length + 1,
        label: '3rd Place Match',
        p1: resolve(bracket.thirdPlace.p1, null),
        p2: resolve(bracket.thirdPlace.p2, null),
        isDone: !!bracket.thirdPlace.winner,
      });
    }
  } else {
    const ubRounds = bracket.upper.filter(r => r.length > 0);
    const lbRounds = (bracket.lower || []).filter(r => r.length > 0);

    ubRounds.forEach((round, colIdx) => {
      const label = roundLabel(colIdx, ubRounds.length, round.length, 'Upper');
      round.forEach((match, mi) => {
        const number = numbers.upper[colIdx]?.[mi];
        if (number == null) return;
        slots.push({
          key: `m_upper_${colIdx}_${mi}`,
          number,
          label,
          p1: resolve(match.p1, feederLabel(numbers, 'upper', colIdx, mi, 1)),
          p2: resolve(match.p2, feederLabel(numbers, 'upper', colIdx, mi, 2)),
          isDone: !!match.winner,
        });
      });
    });

    lbRounds.forEach((round, colIdx) => {
      const label = colIdx === lbRounds.length - 1 ? 'Lower Final' : `Lower Round ${colIdx + 1}`;
      round.forEach((match, mi) => {
        const number = numbers.lower[colIdx]?.[mi];
        if (number == null) return;
        slots.push({
          key: `m_lower_${colIdx}_${mi}`,
          number,
          label,
          p1: resolve(match.p1, feederLabel(numbers, 'lower', colIdx, mi, 1)),
          p2: resolve(match.p2, feederLabel(numbers, 'lower', colIdx, mi, 2)),
          isDone: !!match.winner,
        });
      });
    });

    if (bracket.grandFinal) {
      const gf = bracket.grandFinal;
      slots.push({
        key: 'm_gf_0_0',
        number: numbers.gf ?? slots.length + 1,
        label: 'Grand Final',
        p1: resolve(gf.p1, feederLabel(numbers, 'gf', 0, 0, 1)),
        p2: resolve(gf.p2, feederLabel(numbers, 'gf', 0, 0, 2)),
        isDone: !!(gf.winner && !gf.isReset),
      });
      if (gf.isReset) {
        slots.push({
          key: 'm_gf_0_1',
          number: (numbers.gf ?? slots.length) + 0.5,
          label: 'Grand Final (Reset)',
          p1: resolve(gf.p1, null),
          p2: resolve(gf.p2, null),
          isDone: !!gf.winner,
        });
      }
    }
  }

  return slots.sort((a, b) => a.number - b.number);
}
