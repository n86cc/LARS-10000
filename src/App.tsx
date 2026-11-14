import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CompletedGameRecord,
  DieState,
  DieValue,
  GamePhase,
  GameState,
  LockedBatch,
  Player,
  ThemeMode,
  TurnState,
} from './types/game';
import {
  evaluateSelection,
  findBestScoringSubset,
  getScoringDieIds,
  rollDieValue,
} from './engine/scoring';
import { decideAIMove } from './engine/ai';
import { soundEngine } from './audio/soundEngine';
import {
  appendGameHistory,
  clearGameHistory,
  loadActiveGame,
  loadGameHistory,
  loadMuted,
  loadTheme,
  saveActiveGame,
  saveMuted,
  saveTheme,
} from './storage/persistence';
import { TitleScreen, type StartGameConfig } from './components/TitleScreen';
import { GameBoard } from './components/GameBoard';
import { RulesModal } from './components/RulesModal';
import { HighscoreModal } from './components/HighscoreModal';
import { VictoryModal } from './components/VictoryModal';

const AVATAR_COLORS = ['#0284c7', '#d97706', '#059669', '#7c3aed'];

function createInitialDice(status: DieState['status'] = 'ready'): DieState[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: i,
    value: ((i % 6) + 1) as DieValue,
    status,
    rollNonce: 0,
  }));
}

function createFreshTurn(
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

function createNewGameState(config: StartGameConfig): GameState {
  const players: Player[] = config.players.map((p, idx) => ({
    id: `p-${idx}-${Date.now()}`,
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
    mode: config.mode,
    aiDifficulty: config.aiDifficulty,
    players,
    turn: createFreshTurn(0, 1, players[0].name),
    finalRoundTriggered: false,
    finalRoundTriggeredByIndex: null,
    winnerIndex: null,
    startedAt: now,
    updatedAt: now,
  };
}

function applySelectionLock(turn: TurnState, selectedIds: Set<number>): {
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
    id: `b-${turn.rollCountInTurn}-${Date.now()}`,
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

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const m = loadMuted();
    soundEngine.setMuted(m);
    return m;
  });

  const [savedGame, setSavedGame] = useState<GameState | null>(() => loadActiveGame());
  const [history, setHistory] = useState<CompletedGameRecord[]>(() => loadGameHistory());
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [phase, setPhase] = useState<GamePhase>('TITLE');
  const [lastConfig, setLastConfig] = useState<StartGameConfig | null>(null);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [highscoreModal, setHighscoreModal] = useState<{
    open: boolean;
    tab: 'highscores' | 'history';
  }>({ open: false, tab: 'highscores' });

  // Sync theme to document root
  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  // Persist active game whenever it updates
  useEffect(() => {
    if (phase === 'PLAYING' && activeGame) {
      saveActiveGame(activeGame);
      setSavedGame(activeGame);
    }
  }, [activeGame, phase]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      saveMuted(next);
      return next;
    });
  }, []);

  const advanceOrFinishGame = useCallback(
    (
      updatedPlayers: Player[],
      currentPlayerIndex: number,
      currentRound: number,
      finalRoundTriggered: boolean,
      finalRoundTriggeredByIndex: number | null,
      baseGame: GameState,
      notice?: string
    ) => {
      const isLastPlayerInRound = currentPlayerIndex === updatedPlayers.length - 1;
      const anyOverGoal = updatedPlayers.some((p) => p.totalScore >= 10000);

      if (isLastPlayerInRound && (finalRoundTriggered || anyOverGoal)) {
        // Determine winner (highest score)
        let winnerIdx = 0;
        for (let i = 1; i < updatedPlayers.length; i++) {
          if (updatedPlayers[i].totalScore > updatedPlayers[winnerIdx].totalScore) {
            winnerIdx = i;
          }
        }
        const winner = updatedPlayers[winnerIdx];
        const finishedGame: GameState = {
          ...baseGame,
          players: updatedPlayers,
          finalRoundTriggered: true,
          finalRoundTriggeredByIndex,
          winnerIndex: winnerIdx,
          updatedAt: new Date().toISOString(),
        };

        const record: CompletedGameRecord = {
          id: finishedGame.id,
          finishedAt: finishedGame.updatedAt,
          mode: finishedGame.mode,
          aiDifficulty: finishedGame.mode === 'vs_lars' ? finishedGame.aiDifficulty : undefined,
          totalRounds: currentRound,
          winnerName: winner.name,
          winnerScore: winner.totalScore,
          players: updatedPlayers.map((p) => ({
            name: p.name,
            type: p.type,
            isLars: p.isLars,
            totalScore: p.totalScore,
            bestTurn: p.bestTurn,
            roundsPlayed: p.roundScores.length,
          })),
        };

        const nextHistory = appendGameHistory(record);
        setHistory(nextHistory);
        saveActiveGame(null);
        setSavedGame(null);
        setActiveGame(finishedGame);
        setPhase('GAME_OVER');
        soundEngine.playVictory();
        return;
      }

      const nextIndex = isLastPlayerInRound ? 0 : currentPlayerIndex + 1;
      const nextRound = isLastPlayerInRound ? currentRound + 1 : currentRound;
      const nextPlayer = updatedPlayers[nextIndex];

      const nextGame: GameState = {
        ...baseGame,
        players: updatedPlayers,
        finalRoundTriggered,
        finalRoundTriggeredByIndex,
        turn: createFreshTurn(nextIndex, nextRound, nextPlayer.name, notice),
        updatedAt: new Date().toISOString(),
      };
      setActiveGame(nextGame);
    },
    []
  );

  const finishTurnWithZero = useCallback(() => {
    setActiveGame((prev) => {
      if (!prev) return prev;
      const idx = prev.turn.playerIndex;
      const current = prev.players[idx];
      const nextZeros = current.consecutiveZeros + 1;
      const hitPenalty = nextZeros >= 3;

      const updatedPlayer: Player = {
        ...current,
        totalScore: hitPenalty ? current.totalScore - 1000 : current.totalScore,
        consecutiveZeros: hitPenalty ? 0 : nextZeros,
        roundScores: [...current.roundScores, 0],
      };

      const updatedPlayers = prev.players.map((p, i) =>
        i === idx ? updatedPlayer : p
      );

      const nextIdx =
        idx === updatedPlayers.length - 1 ? 0 : idx + 1;
      const nextPlayer = updatedPlayers[nextIdx];
      const notice = hitPenalty
        ? `${current.name} fik 3 nul-ture i træk (-1.000 pt)! Nu er det ${nextPlayer.name}s tur.`
        : undefined;

      // Defer transition cleanly via state update logic
      const isLastPlayerInRound = idx === updatedPlayers.length - 1;
      const anyOverGoal = updatedPlayers.some((p) => p.totalScore >= 10000);

      if (isLastPlayerInRound && (prev.finalRoundTriggered || anyOverGoal)) {
        let winnerIdx = 0;
        for (let i = 1; i < updatedPlayers.length; i++) {
          if (updatedPlayers[i].totalScore > updatedPlayers[winnerIdx].totalScore) {
            winnerIdx = i;
          }
        }
        const winner = updatedPlayers[winnerIdx];
        const finishedGame: GameState = {
          ...prev,
          players: updatedPlayers,
          winnerIndex: winnerIdx,
          updatedAt: new Date().toISOString(),
        };
        const record: CompletedGameRecord = {
          id: finishedGame.id,
          finishedAt: finishedGame.updatedAt,
          mode: finishedGame.mode,
          aiDifficulty: finishedGame.mode === 'vs_lars' ? finishedGame.aiDifficulty : undefined,
          totalRounds: prev.turn.roundNumber,
          winnerName: winner.name,
          winnerScore: winner.totalScore,
          players: updatedPlayers.map((p) => ({
            name: p.name,
            type: p.type,
            isLars: p.isLars,
            totalScore: p.totalScore,
            bestTurn: p.bestTurn,
            roundsPlayed: p.roundScores.length,
          })),
        };
        setTimeout(() => {
          const nextHistory = appendGameHistory(record);
          setHistory(nextHistory);
          saveActiveGame(null);
          setSavedGame(null);
          setPhase('GAME_OVER');
          soundEngine.playVictory();
        }, 0);
        return finishedGame;
      }

      const nextRound = isLastPlayerInRound
        ? prev.turn.roundNumber + 1
        : prev.turn.roundNumber;

      return {
        ...prev,
        players: updatedPlayers,
        turn: createFreshTurn(nextIdx, nextRound, nextPlayer.name, notice),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  // Auto-advance after FARKLE_PAUSE
  useEffect(() => {
    if (phase !== 'PLAYING' || !activeGame) return;
    if (activeGame.turn.subPhase !== 'FARKLE_PAUSE') return;

    const timer = window.setTimeout(() => {
      finishTurnWithZero();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [phase, activeGame?.turn.subPhase, activeGame?.turn.rollCountInTurn, finishTurnWithZero]);

  const handleStartNewGame = useCallback((config: StartGameConfig) => {
    setLastConfig(config);
    const fresh = createNewGameState(config);
    setActiveGame(fresh);
    setPhase('PLAYING');
  }, []);

  const handleResumeGame = useCallback(() => {
    if (!savedGame) return;
    setActiveGame(savedGame);
    setPhase('PLAYING');
  }, [savedGame]);

  const handleDiscardSavedGame = useCallback(() => {
    saveActiveGame(null);
    setSavedGame(null);
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (lastConfig) {
      handleStartNewGame(lastConfig);
    } else if (activeGame) {
      const rebuilt: StartGameConfig = {
        mode: activeGame.mode,
        aiDifficulty: activeGame.aiDifficulty,
        players: activeGame.players.map((p) => ({
          name: p.name,
          type: p.type,
          isLars: p.isLars,
        })),
      };
      handleStartNewGame(rebuilt);
    }
  }, [lastConfig, activeGame, handleStartNewGame]);

  const handleToggleDie = useCallback((dieId: number) => {
    setActiveGame((prev) => {
      if (!prev || prev.turn.subPhase !== 'SELECTING_DICE') return prev;
      const die = prev.turn.dice.find((d) => d.id === dieId);
      if (!die || (die.status !== 'available' && die.status !== 'selected')) return prev;

      const willSelect = die.status === 'available';
      soundEngine.playSelect(willSelect);

      const nextDice: DieState[] = prev.turn.dice.map((d) =>
        d.id === dieId
          ? { ...d, status: willSelect ? 'selected' : 'available' }
          : d
      );

      return {
        ...prev,
        turn: {
          ...prev.turn,
          dice: nextDice,
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleSelectBest = useCallback(() => {
    setActiveGame((prev) => {
      if (!prev || prev.turn.subPhase !== 'SELECTING_DICE') return prev;
      const available = prev.turn.dice.filter(
        (d) => d.status === 'available' || d.status === 'selected'
      );
      const best = findBestScoringSubset(
        available.map((d) => ({ id: d.id, value: d.value })),
        {
          isFirstRollOfTurn: prev.turn.isFirstRollOfTurn,
          lockedCycleTriples: prev.turn.lockedCycleTriples,
        }
      );
      if (!best) return prev;
      const bestIds = new Set(best.ids);
      soundEngine.playSelect(true);

      return {
        ...prev,
        turn: {
          ...prev.turn,
          dice: prev.turn.dice.map((d) =>
            d.status === 'locked'
              ? d
              : { ...d, status: bestIds.has(d.id) ? 'selected' : 'available' }
          ),
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleLockSelected = useCallback(() => {
    setActiveGame((prev) => {
      if (!prev || prev.turn.subPhase !== 'SELECTING_DICE') return prev;
      const selectedIds = new Set(
        prev.turn.dice.filter((d) => d.status === 'selected').map((d) => d.id)
      );
      if (selectedIds.size === 0) return prev;

      const { nextTurn, isDoubling } = applySelectionLock(prev.turn, selectedIds);
      if (nextTurn === prev.turn) return prev;

      soundEngine.playLock(isDoubling);
      return {
        ...prev,
        turn: nextTurn,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleRoll = useCallback(() => {
    setActiveGame((prev) => {
      if (!prev) return prev;
      let workingTurn = prev.turn;

      // If player has valid dice selected during SELECTING_DICE, lock them first
      if (workingTurn.subPhase === 'SELECTING_DICE') {
        const selectedIds = new Set(
          workingTurn.dice.filter((d) => d.status === 'selected').map((d) => d.id)
        );
        if (selectedIds.size === 0) return prev;
        const locked = applySelectionLock(workingTurn, selectedIds);
        if (locked.nextTurn === workingTurn) return prev;
        workingTurn = locked.nextTurn;
      }

      const isHotDiceReset = workingTurn.subPhase === 'HOT_DICE_CHOICE';
      const isInitialRoll = workingTurn.rollCountInTurn === 0;

      if (
        workingTurn.subPhase !== 'AWAITING_ROLL' &&
        workingTurn.subPhase !== 'HOT_DICE_CHOICE'
      ) {
        return prev;
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
      if (isFarkle) {
        soundEngine.playFarkle();
      } else {
        soundEngine.playRoll();
      }

      const activePlayer = prev.players[workingTurn.playerIndex];

      return {
        ...prev,
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
      };
    });
  }, []);

  const handleBank = useCallback(() => {
    if (!activeGame) return;
    let workingTurn = activeGame.turn;

    if (
      workingTurn.subPhase === 'FARKLE_PAUSE' ||
      workingTurn.rollCountInTurn === 0
    ) {
      return;
    }

    // Auto-lock any valid selected dice before banking; must select >= 1 if in SELECTING_DICE
    if (workingTurn.subPhase === 'SELECTING_DICE') {
      const selectedIds = new Set(
        workingTurn.dice.filter((d) => d.status === 'selected').map((d) => d.id)
      );
      if (selectedIds.size === 0) return;
      const locked = applySelectionLock(workingTurn, selectedIds);
      if (locked.nextTurn === workingTurn) return;
      workingTurn = locked.nextTurn;
    }

    const idx = workingTurn.playerIndex;
    const player = activeGame.players[idx];
    const minRequired = player.isOnBoard ? 350 : 1000;

    if (workingTurn.turnScore < minRequired) return;

    const newTotal = player.totalScore + workingTurn.turnScore;
    const updatedPlayer: Player = {
      ...player,
      totalScore: newTotal,
      isOnBoard: true,
      consecutiveZeros: 0,
      roundScores: [...player.roundScores, workingTurn.turnScore],
      bestTurn: Math.max(player.bestTurn, workingTurn.turnScore),
    };

    const updatedPlayers = activeGame.players.map((p, i) =>
      i === idx ? updatedPlayer : p
    );

    const triggeredNow = newTotal >= 10000;
    const nextFinalTriggered = activeGame.finalRoundTriggered || triggeredNow;
    const nextTriggeredBy =
      activeGame.finalRoundTriggeredByIndex ?? (triggeredNow ? idx : null);

    soundEngine.playBank();

    advanceOrFinishGame(
      updatedPlayers,
      idx,
      workingTurn.roundNumber,
      nextFinalTriggered,
      nextTriggeredBy,
      activeGame
    );
  }, [activeGame, advanceOrFinishGame]);

  // Lars AI turn orchestration
  const aiTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (aiTimerRef.current) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    if (phase !== 'PLAYING' || !activeGame) return;
    const activePlayer = activeGame.players[activeGame.turn.playerIndex];
    if (activePlayer.type !== 'ai') return;

    const { turn } = activeGame;

    if (turn.subPhase === 'AWAITING_ROLL' || turn.subPhase === 'HOT_DICE_CHOICE') {
      aiTimerRef.current = window.setTimeout(() => {
        handleRoll();
      }, 650);
    } else if (turn.subPhase === 'SELECTING_DICE') {
      const selected = turn.dice.filter((d) => d.status === 'selected');
      const available = turn.dice.filter(
        (d) => d.status === 'available' || d.status === 'selected'
      );

      const decision = decideAIMove({
        availableDice: available.map((d) => ({ id: d.id, value: d.value })),
        isFirstRollOfTurn: turn.isFirstRollOfTurn,
        lockedCycleTriples: turn.lockedCycleTriples,
        currentTurnScore: turn.turnScore,
        aiPlayer: activePlayer,
        allPlayers: activeGame.players,
        finalRoundTriggered: activeGame.finalRoundTriggered,
        difficulty: activeGame.aiDifficulty,
      });

      if (!decision) return;

      if (selected.length === 0) {
        // Step 1: Select the dice visually and show Lars' thought
        aiTimerRef.current = window.setTimeout(() => {
          const chosenSet = new Set(decision.diceIdsToLock);
          soundEngine.playSelect(true);
          setActiveGame((prev) => {
            if (!prev || prev.turn.subPhase !== 'SELECTING_DICE') return prev;
            return {
              ...prev,
              turn: {
                ...prev.turn,
                dice: prev.turn.dice.map((d) =>
                  chosenSet.has(d.id) ? { ...d, status: 'selected' } : d
                ),
                statusMessage: decision.thoughtText,
              },
            };
          });
        }, 650);
      } else {
        // Step 2: Bank or Roll onwards
        aiTimerRef.current = window.setTimeout(() => {
          if (decision.shouldBankAfterLock) {
            handleBank();
          } else {
            handleRoll();
          }
        }, 720);
      }
    }

    return () => {
      if (aiTimerRef.current) {
        window.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [
    phase,
    activeGame,
    handleRoll,
    handleBank,
  ]);

  // Keyboard shortcuts during active play (Space = Roll, Enter = Bank, Escape = Close Modals)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rulesOpen) setRulesOpen(false);
        if (highscoreModal.open) setHighscoreModal((s) => ({ ...s, open: false }));
        return;
      }

      if (rulesOpen || highscoreModal.open || phase !== 'PLAYING' || !activeGame) {
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const activePlayer = activeGame.players[activeGame.turn.playerIndex];
      if (activePlayer.type !== 'human') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleRoll();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        handleBank();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, activeGame, rulesOpen, highscoreModal.open, handleRoll, handleBank]);

  const handleClearHistory = useCallback(() => {
    clearGameHistory();
    setHistory([]);
  }, []);

  return (
    <>
      {phase === 'TITLE' && (
        <TitleScreen
          savedGame={savedGame}
          theme={theme}
          isMuted={isMuted}
          historyCount={history.length}
          onToggleTheme={handleToggleTheme}
          onToggleMute={handleToggleMute}
          onResumeGame={handleResumeGame}
          onDiscardSavedGame={handleDiscardSavedGame}
          onStartNewGame={handleStartNewGame}
          onOpenRules={() => setRulesOpen(true)}
          onOpenHighscores={() => setHighscoreModal({ open: true, tab: 'highscores' })}
          onOpenHistory={() => setHighscoreModal({ open: true, tab: 'history' })}
        />
      )}

      {(phase === 'PLAYING' || phase === 'GAME_OVER') && activeGame && (
        <GameBoard
          game={activeGame}
          theme={theme}
          isMuted={isMuted}
          onToggleTheme={handleToggleTheme}
          onToggleMute={handleToggleMute}
          onExitToTitle={() => setPhase('TITLE')}
          onOpenRules={() => setRulesOpen(true)}
          onOpenHighscores={() => setHighscoreModal({ open: true, tab: 'highscores' })}
          onRoll={handleRoll}
          onToggleDie={handleToggleDie}
          onSelectBest={handleSelectBest}
          onLockSelected={handleLockSelected}
          onBank={handleBank}
        />
      )}

      {phase === 'GAME_OVER' && activeGame && (
        <VictoryModal
          game={activeGame}
          onPlayAgain={handlePlayAgain}
          onReturnToTitle={() => setPhase('TITLE')}
        />
      )}

      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />

      <HighscoreModal
        isOpen={highscoreModal.open}
        initialTab={highscoreModal.tab}
        history={history}
        onClearHistory={handleClearHistory}
        onClose={() => setHighscoreModal((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
