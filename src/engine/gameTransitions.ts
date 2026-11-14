import type {
  AIDifficulty,
  DieState,
  DieValue,
  GameMode,
  GameState,
  LockedBatch,
  Player,
  SoundCue,
  TurnState,
} from '../types/game.ts';
import {
  evaluateSelection,
  findBestScoringSubset,
  getScoringDieIds,
  rollDieValue,
} from './scoring.ts';

export const AVATAR_COLORS = ['#0284c7', '#d97706', '#059669', '#7c3aed'];

export function createInitialDice(status: DieState['status'] = 'ready'): DieState[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: i,
    value: ((i % 6) + 1) as DieValue,
    status,
    rollNonce: 0,
  }));
}

export function createFreshTurn(
  playerIndex: number,
  roundNumber: number,
  playerName: string,
  customNotice?: string
): TurnState {
  return {
    playerIndex,
    roundNumber,
    rollCountInTurn: 0,
    isFirstRollOfTurn: true,
    turnScore: 0,
    dice: createInitialDice('ready'),
    lockedCycleTriples: {},
    cycleLockedBatches: [],
    allTurnBatches: [],
    subPhase: 'AWAITING_ROLL',
    statusMessage:
      customNotice ?? `${playerName}s tur — kast de 6 terninger for at starte`,
  };
}

export function createGameFromPlayers(params: {
  mode: GameMode;
  aiDifficulty: AIDifficulty;
  roomCode?: string;
  players: Array<{
    name: string;
    type: 'human' | 'ai';
    isLars?: boolean;
    clientId?: string;
    connected?: boolean;
  }>;
}): GameState {
  const players: Player[] = params.players.map((p, idx) => ({
    id: `p-${idx}-${Date.now()}`,
    clientId: p.clientId,
    connected: p.connected ?? true,
    name: p.name,
    type: p.type,
    isLars: p.isLars,
    avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    totalScore: 0,
    isOnBoard: false,
    consecutiveZeros: 0,
    roundScores: [],
    bestTurn: 0,
  }));

  const now = new Date().toISOString();
  return {
    id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    roomCode: params.roomCode,
    mode: params.mode,
    aiDifficulty: params.aiDifficulty,
    players,
    turn: createFreshTurn(0, 1, players[0].name),
    finalRoundTriggered: false,
    finalRoundTriggeredByIndex: null,
    winnerIndex: null,
    startedAt: now,
    updatedAt: now,
  };
}

export function applySelectionLock(
  turn: TurnState,
  selectedIds: Set<number>
): {
  nextTurn: TurnState;
  isHotDice: boolean;
  isDoubling: boolean;
} {
  const selectedDice = turn.dice.filter((d) => selectedIds.has(d.id));
  const evalResult = evaluateSelection(
    selectedDice.map((d) => d.value),
    {
      isFirstRollOfTurn: turn.isFirstRollOfTurn,
      lockedCycleTriples: turn.lockedCycleTriples,
    }
  );

  if (!evalResult.isValid || evalResult.score <= 0) {
    return { nextTurn: turn, isHotDice: false, isDoubling: false };
  }

  const nextTriples: Partial<Record<DieValue, number>> = {
    ...turn.lockedCycleTriples,
  };
  for (const [faceStr, added] of Object.entries(evalResult.extendedTripleCounts)) {
    const f = Number(faceStr) as DieValue;
    nextTriples[f] = (nextTriples[f] ?? 0) + (added ?? 0);
  }
  for (const [faceStr, cnt] of Object.entries(evalResult.newTripleCounts)) {
    const f = Number(faceStr) as DieValue;
    nextTriples[f] = cnt;
  }

  const batch: LockedBatch = {
    id: `b-${turn.rollCountInTurn}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    rollNumber: turn.rollCountInTurn,
    diceValues: selectedDice.map((d) => d.value),
    points: evalResult.score,
    labels: evalResult.labels,
    isDoubling: evalResult.isDoubling,
  };

  const nextDice: DieState[] = turn.dice.map((d) =>
    selectedIds.has(d.id) ? { ...d, status: 'locked' } : d
  );

  const remainingAvailable = nextDice.filter((d) => d.status === 'available');
  const isHotDice = remainingAvailable.length === 0;

  const nextTurn: TurnState = {
    ...turn,
    turnScore: turn.turnScore + evalResult.score,
    dice: nextDice,
    lockedCycleTriples: nextTriples,
    cycleLockedBatches: [...turn.cycleLockedBatches, batch],
    allTurnBatches: [...turn.allTurnBatches, batch],
    subPhase: isHotDice ? 'HOT_DICE_CHOICE' : 'AWAITING_ROLL',
    statusMessage: isHotDice
      ? 'Alle 6 terninger gav point! Kast alle 6 igen eller gem point.'
      : `Låste +${evalResult.score.toLocaleString('da-DK')} pt — kast igen eller gem point`,
  };

  return { nextTurn, isHotDice, isDoubling: evalResult.isDoubling };
}

export function performToggleDie(
  game: GameState,
  dieId: number
): { game: GameState; sound: SoundCue | null } {
  if (game.turn.subPhase !== 'SELECTING_DICE') {
    return { game, sound: null };
  }
  const die = game.turn.dice.find((d) => d.id === dieId);
  if (!die || (die.status !== 'available' && die.status !== 'selected')) {
    return { game, sound: null };
  }

  const willSelect = die.status === 'available';
  const nextDice: DieState[] = game.turn.dice.map((d) =>
    d.id === dieId
      ? { ...d, status: willSelect ? 'selected' : 'available' }
      : d
  );

  return {
    game: {
      ...game,
      turn: {
        ...game.turn,
        dice: nextDice,
      },
      updatedAt: new Date().toISOString(),
    },
    sound: willSelect ? 'select' : 'deselect',
  };
}

export function performSelectBest(
  game: GameState
): { game: GameState; sound: SoundCue | null } {
  if (game.turn.subPhase !== 'SELECTING_DICE') {
    return { game, sound: null };
  }
  const available = game.turn.dice.filter(
    (d) => d.status === 'available' || d.status === 'selected'
  );
  const best = findBestScoringSubset(
    available.map((d) => ({ id: d.id, value: d.value })),
    {
      isFirstRollOfTurn: game.turn.isFirstRollOfTurn,
      lockedCycleTriples: game.turn.lockedCycleTriples,
    }
  );
  if (!best) return { game, sound: null };

  const bestIds = new Set(best.ids);
  return {
    game: {
      ...game,
      turn: {
        ...game.turn,
        dice: game.turn.dice.map((d) =>
          d.status === 'locked'
            ? d
            : { ...d, status: bestIds.has(d.id) ? 'selected' : 'available' }
        ),
      },
      updatedAt: new Date().toISOString(),
    },
    sound: 'select',
  };
}

export function performLockSelected(
  game: GameState
): { game: GameState; sound: SoundCue | null } {
  if (game.turn.subPhase !== 'SELECTING_DICE') {
    return { game, sound: null };
  }
  const selectedIds = new Set(
    game.turn.dice.filter((d) => d.status === 'selected').map((d) => d.id)
  );
  if (selectedIds.size === 0) return { game, sound: null };

  const { nextTurn, isDoubling } = applySelectionLock(game.turn, selectedIds);
  if (nextTurn === game.turn) return { game, sound: null };

  return {
    game: {
      ...game,
      turn: nextTurn,
      updatedAt: new Date().toISOString(),
    },
    sound: isDoubling ? 'doubling' : 'lock',
  };
}

export function performRoll(
  game: GameState
): { game: GameState; sound: SoundCue | null } {
  let workingTurn = game.turn;

  if (workingTurn.subPhase === 'SELECTING_DICE') {
    const selectedIds = new Set(
      workingTurn.dice.filter((d) => d.status === 'selected').map((d) => d.id)
    );
    if (selectedIds.size === 0) return { game, sound: null };
    const locked = applySelectionLock(workingTurn, selectedIds);
    if (locked.nextTurn === workingTurn) return { game, sound: null };
    workingTurn = locked.nextTurn;
  }

  const isHotDiceReset = workingTurn.subPhase === 'HOT_DICE_CHOICE';
  const isInitialRoll = workingTurn.rollCountInTurn === 0;

  if (
    workingTurn.subPhase !== 'AWAITING_ROLL' &&
    workingTurn.subPhase !== 'HOT_DICE_CHOICE'
  ) {
    return { game, sound: null };
  }

  const nextRollCount = workingTurn.rollCountInTurn + 1;
  const nextTriples = isHotDiceReset ? {} : workingTurn.lockedCycleTriples;
  const nextCycleBatches = isHotDiceReset ? [] : workingTurn.cycleLockedBatches;

  const rolledDice: DieState[] = workingTurn.dice.map((d) => {
    if (isHotDiceReset || d.status === 'ready' || d.status === 'available') {
      return {
        ...d,
        value: rollDieValue(),
        status: 'available',
        rollNonce: d.rollNonce + 1,
      };
    }
    return d;
  });

  const availableForCheck = rolledDice
    .filter((d) => d.status === 'available')
    .map((d) => ({ id: d.id, value: d.value }));

  const scoringIds = getScoringDieIds(availableForCheck, {
    isFirstRollOfTurn: isInitialRoll,
    lockedCycleTriples: nextTriples,
  });

  const isFarkle = scoringIds.size === 0;
  const activePlayer = game.players[workingTurn.playerIndex];

  return {
    game: {
      ...game,
      turn: {
        ...workingTurn,
        rollCountInTurn: nextRollCount,
        isFirstRollOfTurn: isInitialRoll,
        dice: rolledDice,
        lockedCycleTriples: nextTriples,
        cycleLockedBatches: nextCycleBatches,
        subPhase: isFarkle ? 'FARKLE_PAUSE' : 'SELECTING_DICE',
        statusMessage: isFarkle
          ? `Nul-slag til ${activePlayer.name}! Ingen pointgivende terninger.`
          : activePlayer.type === 'ai'
            ? `${activePlayer.name} vurderer kastet...`
            : 'Vælg én eller flere pointgivende terninger',
      },
      updatedAt: new Date().toISOString(),
    },
    sound: isFarkle ? 'farkle' : 'roll',
  };
}

function advanceOrEnd(
  updatedPlayers: Player[],
  currentPlayerIndex: number,
  currentRound: number,
  finalRoundTriggered: boolean,
  finalRoundTriggeredByIndex: number | null,
  baseGame: GameState,
  notice?: string
): { game: GameState; gameOver: boolean } {
  const isLastPlayerInRound = currentPlayerIndex === updatedPlayers.length - 1;
  const anyOverGoal = updatedPlayers.some((p) => p.totalScore >= 10000);

  if (isLastPlayerInRound && (finalRoundTriggered || anyOverGoal)) {
    let winnerIdx = 0;
    for (let i = 1; i < updatedPlayers.length; i++) {
      if (updatedPlayers[i].totalScore > updatedPlayers[winnerIdx].totalScore) {
        winnerIdx = i;
      }
    }
    return {
      game: {
        ...baseGame,
        players: updatedPlayers,
        finalRoundTriggered: true,
        finalRoundTriggeredByIndex,
        winnerIndex: winnerIdx,
        updatedAt: new Date().toISOString(),
      },
      gameOver: true,
    };
  }

  const nextIndex = isLastPlayerInRound ? 0 : currentPlayerIndex + 1;
  const nextRound = isLastPlayerInRound ? currentRound + 1 : currentRound;
  const nextPlayer = updatedPlayers[nextIndex];

  return {
    game: {
      ...baseGame,
      players: updatedPlayers,
      finalRoundTriggered,
      finalRoundTriggeredByIndex,
      turn: createFreshTurn(nextIndex, nextRound, nextPlayer.name, notice),
      updatedAt: new Date().toISOString(),
    },
    gameOver: false,
  };
}

export function performBank(
  game: GameState
): { game: GameState; gameOver: boolean; sound: SoundCue | null } {
  let workingTurn = game.turn;

  if (
    workingTurn.subPhase === 'FARKLE_PAUSE' ||
    workingTurn.rollCountInTurn === 0
  ) {
    return { game, gameOver: false, sound: null };
  }

  if (workingTurn.subPhase === 'SELECTING_DICE') {
    const selectedIds = new Set(
      workingTurn.dice.filter((d) => d.status === 'selected').map((d) => d.id)
    );
    if (selectedIds.size === 0) return { game, gameOver: false, sound: null };
    const locked = applySelectionLock(workingTurn, selectedIds);
    if (locked.nextTurn === workingTurn) return { game, gameOver: false, sound: null };
    workingTurn = locked.nextTurn;
  }

  const idx = workingTurn.playerIndex;
  const player = game.players[idx];
  const minRequired = player.isOnBoard ? 350 : 1000;

  if (workingTurn.turnScore < minRequired) {
    return { game, gameOver: false, sound: null };
  }

  const newTotal = player.totalScore + workingTurn.turnScore;
  const updatedPlayer: Player = {
    ...player,
    totalScore: newTotal,
    isOnBoard: true,
    consecutiveZeros: 0,
    roundScores: [...player.roundScores, workingTurn.turnScore],
    bestTurn: Math.max(player.bestTurn, workingTurn.turnScore),
  };

  const updatedPlayers = game.players.map((p, i) =>
    i === idx ? updatedPlayer : p
  );

  const triggeredNow = newTotal >= 10000;
  const nextFinalTriggered = game.finalRoundTriggered || triggeredNow;
  const nextTriggeredBy =
    game.finalRoundTriggeredByIndex ?? (triggeredNow ? idx : null);

  const res = advanceOrEnd(
    updatedPlayers,
    idx,
    workingTurn.roundNumber,
    nextFinalTriggered,
    nextTriggeredBy,
    game
  );

  return {
    game: res.game,
    gameOver: res.gameOver,
    sound: res.gameOver ? 'victory' : 'bank',
  };
}

export function performZeroTurn(
  game: GameState
): { game: GameState; gameOver: boolean; sound: SoundCue | null } {
  if (game.turn.subPhase !== 'FARKLE_PAUSE') {
    return { game, gameOver: false, sound: null };
  }

  const idx = game.turn.playerIndex;
  const current = game.players[idx];
  const nextZeros = current.consecutiveZeros + 1;
  const hitPenalty = nextZeros >= 3;

  const updatedPlayer: Player = {
    ...current,
    totalScore: hitPenalty ? current.totalScore - 1000 : current.totalScore,
    consecutiveZeros: hitPenalty ? 0 : nextZeros,
    roundScores: [...current.roundScores, 0],
  };

  const updatedPlayers = game.players.map((p, i) =>
    i === idx ? updatedPlayer : p
  );

  const nextIdx = idx === updatedPlayers.length - 1 ? 0 : idx + 1;
  const nextPlayer = updatedPlayers[nextIdx];
  const notice = hitPenalty
    ? `${current.name} fik 3 nul-ture i træk (-1.000 pt)! Nu er det ${nextPlayer.name}s tur.`
    : undefined;

  const res = advanceOrEnd(
    updatedPlayers,
    idx,
    game.turn.roundNumber,
    game.finalRoundTriggered,
    game.finalRoundTriggeredByIndex,
    game,
    notice
  );

  return {
    game: res.game,
    gameOver: res.gameOver,
    sound: res.gameOver ? 'victory' : null,
  };
}
