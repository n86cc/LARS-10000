import type { DieValue, ScoringEvaluation } from '../types/game';

const ALL_FACES: DieValue[] = [1, 2, 3, 4, 5, 6];

function getTripleBase(face: DieValue): number {
  return face === 1 ? 1000 : face * 100;
}

function getMultiOfAKindScore(face: DieValue, count: number): number {
  if (count < 3) return 0;
  return getTripleBase(face) * Math.pow(2, count - 3);
}

function getSingleScore(face: DieValue, count: number): number {
  if (face === 1) return count * 100;
  if (face === 5) return count * 50;
  return 0;
}

function countFaces(dice: DieValue[]): Record<DieValue, number> {
  const counts: Record<DieValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const d of dice) {
    counts[d] += 1;
  }
  return counts;
}

function matchesExactly(counts: Record<DieValue, number>, required: DieValue[]): boolean {
  const needed = countFaces(required);
  return ALL_FACES.every((f) => counts[f] === needed[f]);
}

function containsAtLeast(counts: Record<DieValue, number>, required: DieValue[]): boolean {
  const needed = countFaces(required);
  return ALL_FACES.every((f) => counts[f] >= needed[f]);
}

/**
 * Evaluates a selected subset of dice against LARS:10000 official rules:
 * - Lille: 1-2-3-4-5 = 500
 * - Stor: 2-3-4-5-6 = 1000
 * - Cameron: 1-2-3-4-5-6 = 2000
 * - 3 par: three pairs (including e.g. 4-of-a-kind + pair) = 1500
 * - 2 × 3 ens: two sets of 3 identical dice (ONLY on first roll of turn) = 2500
 * - 3 ens & doubling: 3×1=1000, 3×N=N*100; each extra die doubles (4=2×, 5=4×, 6=8×),
 *   INCLUDING adding matching dice to a 3+-of-a-kind already locked earlier in the same 6-dice cycle!
 * - Single 1 = 100, Single 5 = 50.
 *
 * Every die in `selectedDice` MUST contribute to the score; if any selected die is dead weight, `isValid` is false.
 */
export function evaluateSelection(
  selectedDice: DieValue[],
  options: {
    isFirstRollOfTurn: boolean;
    lockedCycleTriples?: Partial<Record<DieValue, number>>;
  }
): ScoringEvaluation {
  const invalid: ScoringEvaluation = {
    isValid: false,
    score: 0,
    labels: [],
    isDoubling: false,
    extendedTripleCounts: {},
    newTripleCounts: {},
  };

  if (selectedDice.length === 0) return invalid;

  const lockedTriples = options.lockedCycleTriples ?? {};
  const counts = countFaces(selectedDice);
  const n = selectedDice.length;

  let best: ScoringEvaluation = { ...invalid };

  const consider = (candidate: ScoringEvaluation) => {
    if (!candidate.isValid) return;
    if (!best.isValid || candidate.score > best.score) {
      best = candidate;
    }
  };

  // 1. Six-dice special combinations
  if (n === 6) {
    // Cameron: 1-2-3-4-5-6 (2.000)
    if (matchesExactly(counts, [1, 2, 3, 4, 5, 6])) {
      consider({
        isValid: true,
        score: 2000,
        labels: ['Cameron (1–6)'],
        isDoubling: false,
        extendedTripleCounts: {},
        newTripleCounts: {},
      });
    }

    // 2 × 3 ens (2.500 — only on very first roll of turn)
    const tripleFaces = ALL_FACES.filter((f) => counts[f] === 3);
    if (options.isFirstRollOfTurn && tripleFaces.length === 2) {
      consider({
        isValid: true,
        score: 2500,
        labels: [`2 × 3 ens (${tripleFaces[0]}'ere & ${tripleFaces[1]}'ere)`],
        isDoubling: false,
        extendedTripleCounts: {},
        newTripleCounts: { [tripleFaces[0]]: 3, [tripleFaces[1]]: 3 },
      });
    }

    // 3 par (1.500 — any 3 pairs, i.e., all face counts are even)
    const allEven = ALL_FACES.every((f) => counts[f] % 2 === 0);
    if (allEven) {
      consider({
        isValid: true,
        score: 1500,
        labels: ['3 par'],
        isDoubling: false,
        extendedTripleCounts: {},
        newTripleCounts: {},
      });
    }
  }

  // 2. Five-dice straights (Lille 1-2-3-4-5 = 500, Stor 2-3-4-5-6 = 1000),
  //    plus possible 6th die if n === 6 and that 6th die scores (1, 5, or extends a locked triple)
  if (n === 5 || n === 6) {
    const straights: Array<{ req: DieValue[]; score: number; label: string }> = [
      { req: [2, 3, 4, 5, 6], score: 1000, label: 'Stor (2–6)' },
      { req: [1, 2, 3, 4, 5], score: 500, label: 'Lille (1–5)' },
    ];

    for (const st of straights) {
      if (containsAtLeast(counts, st.req)) {
        if (n === 5) {
          consider({
            isValid: true,
            score: st.score,
            labels: [st.label],
            isDoubling: false,
            extendedTripleCounts: {},
            newTripleCounts: {},
          });
        } else {
          // Find the 1 leftover die
          const remCounts = { ...counts };
          for (const f of st.req) remCounts[f] -= 1;
          const extraFace = ALL_FACES.find((f) => remCounts[f] === 1);
          if (extraFace) {
            const lockedCount = lockedTriples[extraFace] ?? 0;
            if (lockedCount >= 3) {
              const delta =
                getMultiOfAKindScore(extraFace, lockedCount + 1) -
                getMultiOfAKindScore(extraFace, lockedCount);
              consider({
                isValid: true,
                score: st.score + delta,
                labels: [st.label, `Fordobling ${extraFace}'er (+${delta})`],
                isDoubling: true,
                extendedTripleCounts: { [extraFace]: 1 },
                newTripleCounts: {},
              });
            } else {
              const singlePts = getSingleScore(extraFace, 1);
              if (singlePts > 0) {
                consider({
                  isValid: true,
                  score: st.score + singlePts,
                  labels: [st.label, `1 × ${extraFace}'er`],
                  isDoubling: false,
                  extendedTripleCounts: {},
                  newTripleCounts: {},
                });
              }
            }
          }
        }
      }
    }
  }

  // 3. Standard face-by-face scoring (3-of-a-kind + doubling, extending locked triples, singles 1 & 5)
  let standardScore = 0;
  let standardValid = true;
  let standardDoubling = false;
  const standardLabels: string[] = [];
  const extendedTripleCounts: Partial<Record<DieValue, number>> = {};
  const newTripleCounts: Partial<Record<DieValue, number>> = {};

  for (const face of ALL_FACES) {
    const c = counts[face];
    if (c === 0) continue;

    const alreadyLocked = lockedTriples[face] ?? 0;

    if (alreadyLocked >= 3) {
      // Extending an already-locked 3+-of-a-kind group from earlier in this 6-dice cycle!
      const prevScore = getMultiOfAKindScore(face, alreadyLocked);
      const nextScore = getMultiOfAKindScore(face, alreadyLocked + c);
      const delta = nextScore - prevScore;
      standardScore += delta;
      standardDoubling = true;
      extendedTripleCounts[face] = c;
      standardLabels.push(`Fordobling: +${c} × ${face}'er (${alreadyLocked + c} ens)`);
    } else if (c >= 3) {
      const pts = getMultiOfAKindScore(face, c);
      standardScore += pts;
      newTripleCounts[face] = c;
      if (c > 3) {
        standardDoubling = true;
        standardLabels.push(`${c} × ${face}'ere (fordoblet)`);
      } else {
        standardLabels.push(`3 × ${face}'ere`);
      }
    } else {
      const singlePts = getSingleScore(face, c);
      if (singlePts === 0) {
        standardValid = false;
        break;
      }
      standardScore += singlePts;
      standardLabels.push(`${c} × ${face}'er`);
    }
  }

  if (standardValid && standardScore > 0) {
    consider({
      isValid: true,
      score: standardScore,
      labels: standardLabels,
      isDoubling: standardDoubling,
      extendedTripleCounts,
      newTripleCounts,
    });
  }

  return best;
}

/**
 * Finds all valid non-empty index subsets of `availableDice` that legally score points.
 */
export function findAllValidScoringSubsets(
  availableDice: Array<{ id: number; value: DieValue }>,
  options: {
    isFirstRollOfTurn: boolean;
    lockedCycleTriples?: Partial<Record<DieValue, number>>;
  }
): Array<{ indices: number[]; ids: number[]; evalResult: ScoringEvaluation }> {
  const n = availableDice.length;
  const results: Array<{ indices: number[]; ids: number[]; evalResult: ScoringEvaluation }> = [];

  for (let mask = 1; mask < 1 << n; mask++) {
    const indices: number[] = [];
    const ids: number[] = [];
    const values: DieValue[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        indices.push(i);
        ids.push(availableDice[i].id);
        values.push(availableDice[i].value);
      }
    }
    const evalResult = evaluateSelection(values, options);
    if (evalResult.isValid && evalResult.score > 0) {
      results.push({ indices, ids, evalResult });
    }
  }

  return results;
}

/**
 * Returns the IDs of all dice in `availableDice` that participate in at least one valid scoring move.
 */
export function getScoringDieIds(
  availableDice: Array<{ id: number; value: DieValue }>,
  options: {
    isFirstRollOfTurn: boolean;
    lockedCycleTriples?: Partial<Record<DieValue, number>>;
  }
): Set<number> {
  const scoringIds = new Set<number>();
  const subsets = findAllValidScoringSubsets(availableDice, options);
  for (const sub of subsets) {
    for (const id of sub.ids) {
      scoringIds.add(id);
    }
  }
  return scoringIds;
}

/**
 * Returns the highest-scoring valid subset of dice (breaking ties by using more dice, or fewer if equal).
 */
export function findBestScoringSubset(
  availableDice: Array<{ id: number; value: DieValue }>,
  options: {
    isFirstRollOfTurn: boolean;
    lockedCycleTriples?: Partial<Record<DieValue, number>>;
  }
): { ids: number[]; evalResult: ScoringEvaluation } | null {
  const subsets = findAllValidScoringSubsets(availableDice, options);
  if (subsets.length === 0) return null;

  subsets.sort((a, b) => {
    if (b.evalResult.score !== a.evalResult.score) {
      return b.evalResult.score - a.evalResult.score;
    }
    return b.ids.length - a.ids.length;
  });

  return { ids: subsets[0].ids, evalResult: subsets[0].evalResult };
}

export function rollDieValue(): DieValue {
  return (Math.floor(Math.random() * 6) + 1) as DieValue;
}

export function formatScore(value: number): string {
  return value.toLocaleString('da-DK');
}
