import type { AIDifficulty, DieValue, Player, ScoringEvaluation } from '../types/game';
import { findAllValidScoringSubsets } from './scoring';

export interface AIDecision {
  diceIdsToLock: number[];
  evalResult: ScoringEvaluation;
  shouldBankAfterLock: boolean;
  thoughtText: string;
}

/**
 * Calculates Lars AI's optimal move for the current roll.
 */
export function decideAIMove(params: {
  availableDice: Array<{ id: number; value: DieValue }>;
  isFirstRollOfTurn: boolean;
  lockedCycleTriples: Partial<Record<DieValue, number>>;
  currentTurnScore: number;
  aiPlayer: Player;
  allPlayers: Player[];
  finalRoundTriggered: boolean;
  difficulty: AIDifficulty;
}): AIDecision | null {
  const {
    availableDice,
    isFirstRollOfTurn,
    lockedCycleTriples,
    currentTurnScore,
    aiPlayer,
    allPlayers,
    finalRoundTriggered,
    difficulty,
  } = params;

  const subsets = findAllValidScoringSubsets(availableDice, {
    isFirstRollOfTurn,
    lockedCycleTriples,
  });

  if (subsets.length === 0) return null;

  const minToBank = aiPlayer.isOnBoard ? 350 : 1000;
  const highestOpponentScore = Math.max(
    0,
    ...allPlayers.filter((p) => p.id !== aiPlayer.id).map((p) => p.totalScore)
  );
  const mustBeatLeader = finalRoundTriggered || highestOpponentScore >= 10000;

  // Approximate Farkle probability given remaining dice count
  const farkleRiskByRemaining: Record<number, number> = {
    6: 0.023,
    5: 0.077,
    4: 0.157,
    3: 0.278,
    2: 0.444,
    1: 0.667,
  };

  let bestOption: {
    ids: number[];
    evalResult: ScoringEvaluation;
    shouldBank: boolean;
    utility: number;
  } | null = null;

  for (const sub of subsets) {
    const newTurnScore = currentTurnScore + sub.evalResult.score;
    const remainingDice = availableDice.length - sub.ids.length;
    const effectiveRemaining = remainingDice === 0 ? 6 : remainingDice;
    const canBank = newTurnScore >= minToBank;

    // Projected total if banking right after this lock
    const projectedTotal = aiPlayer.totalScore + newTurnScore;

    // If this bank wins or extends lead past 10000 in final round, check if banking is safe & winning
    const risk = farkleRiskByRemaining[effectiveRemaining] ?? 0.5;

    // Determine whether AI would bank or roll again after locking this subset
    let shouldBank = false;
    if (canBank) {
      if (effectiveRemaining === 6) {
        // Hot dice! Usually roll again unless we already have a huge safe winning bank
        if (mustBeatLeader && projectedTotal > highestOpponentScore && projectedTotal >= 10000) {
          shouldBank = true;
        } else if (newTurnScore >= 2000 && difficulty === 'afslappet') {
          shouldBank = true;
        } else {
          shouldBank = false;
        }
      } else if (mustBeatLeader && projectedTotal <= highestOpponentScore) {
        // Must keep rolling to pass leader in endgame!
        shouldBank = false;
      } else if (mustBeatLeader && projectedTotal > highestOpponentScore && projectedTotal >= 10000) {
        shouldBank = true;
      } else if (aiPlayer.consecutiveZeros === 2) {
        // Avoid -1000 penalty by banking as soon as minimum threshold is met!
        shouldBank = true;
      } else {
        const bankThresholdByDice: Record<number, number> =
          difficulty === 'mester'
            ? { 1: 350, 2: 450, 3: 700, 4: 1100, 5: 1600, 6: 2600 }
            : difficulty === 'taktisk'
              ? { 1: 350, 2: 500, 3: 750, 4: 1000, 5: 1400, 6: 2200 }
              : { 1: 350, 2: 400, 3: 550, 4: 800, 5: 1000, 6: 1600 };

        const target = Math.max(minToBank, bankThresholdByDice[effectiveRemaining] ?? 600);
        shouldBank = newTurnScore >= target;
      }
    }

    // Score the utility of taking this subset + (banking or rolling on)
    let utility = 0;
    if (shouldBank) {
      utility = newTurnScore;
      if (projectedTotal >= 10000 && projectedTotal > highestOpponentScore) {
        utility += 3000;
      }
    } else {
      // Expected value of rolling remaining dice
      const expectedGainPerDie = effectiveRemaining >= 4 ? 140 : effectiveRemaining === 3 ? 110 : 80;
      const expectedRollValue = expectedGainPerDie * effectiveRemaining;
      const survivalProb = 1 - risk;
      // Reward keeping more dice free when not yet at minimum
      utility = survivalProb * (newTurnScore + expectedRollValue);
      if (effectiveRemaining === 6) utility += 450; // Hot dice bonus
      if (difficulty === 'afslappet') {
        // Slightly less optimal: prefers grabbing points immediately
        utility = newTurnScore * 0.65 + survivalProb * expectedRollValue;
      }
    }

    if (!bestOption || utility > bestOption.utility) {
      bestOption = {
        ids: sub.ids,
        evalResult: sub.evalResult,
        shouldBank,
        utility,
      };
    }
  }

  if (!bestOption) return null;

  const labelStr = bestOption.evalResult.labels.join(' + ');
  const ptsStr = bestOption.evalResult.score.toLocaleString('da-DK');
  const nextTotal = (currentTurnScore + bestOption.evalResult.score).toLocaleString('da-DK');

  const thoughtText = bestOption.shouldBank
    ? `${aiPlayer.name} låser ${labelStr} (+${ptsStr}) og gemmer ${nextTotal} point.`
    : availableDice.length - bestOption.ids.length === 0
      ? `${aiPlayer.name} låser ${labelStr} (+${ptsStr}) og får alle 6 terninger igen!`
      : `${aiPlayer.name} låser ${labelStr} (+${ptsStr}) og kaster videre...`;

  return {
    diceIdsToLock: bestOption.ids,
    evalResult: bestOption.evalResult,
    shouldBankAfterLock: bestOption.shouldBank,
    thoughtText,
  };
}
