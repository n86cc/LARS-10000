import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AIDifficulty,
  CompletedGameRecord,
  GamePhase,
  GameState,
  OnlineRoomSnapshot,
  SoundCue,
  ThemeMode,
} from './types/game';
import {
  createGameFromPlayers,
  performBank,
  performLockSelected,
  performRoll,
  performSelectBest,
  performToggleDie,
  performZeroTurn,
} from './engine/gameTransitions';
import { decideAIMove } from './engine/ai';
import { soundEngine } from './audio/soundEngine';
import {
  appendGameHistory,
  clearGameHistory,
  getOrCreateClientId,
  loadActiveGame,
  loadGameHistory,
  loadMuted,
  loadSavedOnlineRoom,
  loadSavedPlayerName,
  loadTheme,
  saveActiveGame,
  saveMuted,
  saveOnlineRoom,
  savePlayerName,
  saveTheme,
} from './storage/persistence';
import { TitleScreen, type StartGameConfig } from './components/TitleScreen';
import { OnlineLobby } from './components/OnlineLobby';
import { GameBoard } from './components/GameBoard';
import { RulesModal } from './components/RulesModal';
import { HighscoreModal } from './components/HighscoreModal';
import { VictoryModal } from './components/VictoryModal';

function playSoundCue(cue: SoundCue | null | undefined) {
  if (!cue) return;
  switch (cue) {
    case 'roll':
      soundEngine.playRoll();
      break;
    case 'select':
      soundEngine.playSelect(true);
      break;
    case 'deselect':
      soundEngine.playSelect(false);
      break;
    case 'lock':
      soundEngine.playLock(false);
      break;
    case 'doubling':
      soundEngine.playLock(true);
      break;
    case 'bank':
      soundEngine.playBank();
      break;
    case 'farkle':
      soundEngine.playFarkle();
      break;
    case 'victory':
      soundEngine.playVictory();
      break;
  }
}

function toCompletedRecord(game: GameState): CompletedGameRecord {
  const sorted = [...game.players].sort((a, b) => b.totalScore - a.totalScore);
  const winner =
    game.winnerIndex !== null && game.players[game.winnerIndex]
      ? game.players[game.winnerIndex]
      : sorted[0];

  return {
    id: game.id,
    finishedAt: game.updatedAt,
    mode: game.mode,
    aiDifficulty:
      game.mode === 'vs_lars' || game.mode === 'online_multiplayer'
        ? game.aiDifficulty
        : undefined,
    totalRounds: game.turn.roundNumber,
    winnerName: winner.name,
    winnerScore: winner.totalScore,
    players: game.players.map((p) => ({
      name: p.name,
      type: p.type,
      isLars: p.isLars,
      totalScore: p.totalScore,
      bestTurn: p.bestTurn,
      roundsPlayed: p.roundScores.length,
    })),
  };
}

export default function App() {
  const localClientId = useMemo(() => getOrCreateClientId(), []);
  const urlRoomCode = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').replace(/\D/g, '').slice(0, 6);
  }, []);

  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const m = loadMuted();
    soundEngine.setMuted(m);
    return m;
  });

  const [savedGame, setSavedGame] = useState<GameState | null>(() => loadActiveGame());
  const [history, setHistory] = useState<CompletedGameRecord[]>(() => loadGameHistory());
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [phase, setPhase] = useState<GamePhase>('TITLE');
  const [lastConfig, setLastConfig] = useState<StartGameConfig | null>(null);

  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [highscoreModal, setHighscoreModal] = useState<{
    open: boolean;
    tab: 'highscores' | 'history';
  }>({ open: false, tab: 'highscores' });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const recordedGamesRef = useRef<Set<string>>(new Set());

  const recordFinishedGame = useCallback((finished: GameState) => {
    if (recordedGamesRef.current.has(finished.id)) return;
    recordedGamesRef.current.add(finished.id);
    const nextHistory = appendGameHistory(toCompletedRecord(finished));
    setHistory(nextHistory);
  }, []);

  // Sync theme to document root
  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  // Persist local (offline) active game whenever it updates
  useEffect(() => {
    if (phase === 'PLAYING' && activeGame && activeGame.mode !== 'online_multiplayer') {
      saveActiveGame(activeGame);
      setSavedGame(activeGame);
    }
  }, [activeGame, phase]);

  // WebSocket connection for online phone-to-phone multiplayer
  useEffect(() => {
    let disposed = false;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        attempt = 0;
        setIsSocketConnected(true);

        // Auto-rejoin an active online session if this phone refreshed/unlocked
        const savedSession = loadSavedOnlineRoom();
        if (savedSession && !urlRoomCode) {
          ws.send(
            JSON.stringify({
              type: 'room:join',
              clientId: localClientId,
              roomCode: savedSession.roomCode,
              playerName: savedSession.playerName,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'room:error') {
            setOnlineError(msg.message || 'Der opstod en fejl i rummet.');
            // If auto-rejoin failed because room expired, clear saved room
            const saved = loadSavedOnlineRoom();
            if (saved && String(msg.message || '').includes('blev ikke fundet')) {
              saveOnlineRoom(null);
            }
            return;
          }

          if (msg.type === 'room:left') {
            saveOnlineRoom(null);
            setOnlineRoom(null);
            setActiveGame(null);
            setPhase('TITLE');
            return;
          }

          if (msg.type === 'room:state' && msg.room) {
            const room = msg.room as OnlineRoomSnapshot;
            setOnlineError(null);
            setOnlineRoom(room);

            const meInRoom = room.lobbyPlayers.find(
              (p) => p.clientId === localClientId
            );
            if (meInRoom) {
              saveOnlineRoom({ roomCode: room.roomCode, playerName: meInRoom.name });
            }

            if (msg.sound) {
              playSoundCue(msg.sound as SoundCue);
            }

            if (room.status === 'LOBBY') {
              setActiveGame(null);
              setPhase('ONLINE_LOBBY');
            } else if (room.status === 'PLAYING' && room.game) {
              setActiveGame(room.game);
              setPhase('PLAYING');
            } else if (room.status === 'GAME_OVER' && room.game) {
              setActiveGame(room.game);
              setPhase('GAME_OVER');
              recordFinishedGame(room.game);
            }
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setIsSocketConnected(false);
        const delay = Math.min(5000, 800 * Math.pow(1.4, attempt));
        attempt += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [localClientId, recordFinishedGame, urlRoomCode]);

  const sendSocket = useCallback(
    (payload: Record<string, unknown>) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setOnlineError('Ingen forbindelse til serveren endnu — prøv igen om et øjeblik.');
        return false;
      }
      ws.send(JSON.stringify({ ...payload, clientId: localClientId }));
      return true;
    },
    [localClientId]
  );

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

  const handleCreateOnlineRoom = useCallback(
    (playerName: string) => {
      setOnlineError(null);
      savePlayerName(playerName);
      sendSocket({ type: 'room:create', playerName });
    },
    [sendSocket]
  );

  const handleJoinOnlineRoom = useCallback(
    (roomCode: string, playerName: string) => {
      setOnlineError(null);
      savePlayerName(playerName);
      sendSocket({ type: 'room:join', roomCode, playerName });
    },
    [sendSocket]
  );

  const handleUpdateOnlineConfig = useCallback(
    (config: { includeLars?: boolean; aiDifficulty?: AIDifficulty }) => {
      sendSocket({ type: 'room:config', ...config });
    },
    [sendSocket]
  );

  const handleStartOnlineGame = useCallback(() => {
    sendSocket({ type: 'room:start' });
  }, [sendSocket]);

  const handleLeaveOnlineRoom = useCallback(() => {
    saveOnlineRoom(null);
    if (typeof window !== 'undefined' && window.location.search.includes('room=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    sendSocket({ type: 'room:leave' });
    setOnlineRoom(null);
    setActiveGame(null);
    setPhase('TITLE');
  }, [sendSocket]);

  // Local game start / resume
  const handleStartNewGame = useCallback((config: StartGameConfig) => {
    setLastConfig(config);
    const fresh = createGameFromPlayers({
      mode: config.mode,
      aiDifficulty: config.aiDifficulty,
      players: config.players,
    });
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
    if (activeGame?.mode === 'online_multiplayer') {
      sendSocket({ type: 'room:start' });
      return;
    }

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
  }, [lastConfig, activeGame, handleStartNewGame, sendSocket]);

  // Local Farkle auto-advance (online rooms run this on server)
  useEffect(() => {
    if (
      phase !== 'PLAYING' ||
      !activeGame ||
      activeGame.mode === 'online_multiplayer'
    ) {
      return;
    }
    if (activeGame.turn.subPhase !== 'FARKLE_PAUSE') return;

    const timer = window.setTimeout(() => {
      setActiveGame((prev) => {
        if (!prev || prev.mode === 'online_multiplayer') return prev;
        const res = performZeroTurn(prev);
        if (res.sound) playSoundCue(res.sound);
        if (res.gameOver) {
          saveActiveGame(null);
          setSavedGame(null);
          recordFinishedGame(res.game);
          setPhase('GAME_OVER');
        }
        return res.game;
      });
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    phase,
    activeGame?.mode,
    activeGame?.turn.subPhase,
    activeGame?.turn.rollCountInTurn,
    recordFinishedGame,
  ]);

  // Game action handlers (route to WebSocket when online, or local state when offline)
  const handleToggleDie = useCallback(
    (dieId: number) => {
      if (activeGame?.mode === 'online_multiplayer') {
        sendSocket({ type: 'game:action', action: 'toggle_die', dieId });
        return;
      }
      setActiveGame((prev) => {
        if (!prev) return prev;
        const res = performToggleDie(prev, dieId);
        if (res.sound) playSoundCue(res.sound);
        return res.game;
      });
    },
    [activeGame?.mode, sendSocket]
  );

  const handleSelectBest = useCallback(() => {
    if (activeGame?.mode === 'online_multiplayer') {
      sendSocket({ type: 'game:action', action: 'select_best' });
      return;
    }
    setActiveGame((prev) => {
      if (!prev) return prev;
      const res = performSelectBest(prev);
      if (res.sound) playSoundCue(res.sound);
      return res.game;
    });
  }, [activeGame?.mode, sendSocket]);

  const handleLockSelected = useCallback(() => {
    if (activeGame?.mode === 'online_multiplayer') {
      sendSocket({ type: 'game:action', action: 'lock_selected' });
      return;
    }
    setActiveGame((prev) => {
      if (!prev) return prev;
      const res = performLockSelected(prev);
      if (res.sound) playSoundCue(res.sound);
      return res.game;
    });
  }, [activeGame?.mode, sendSocket]);

  const handleRoll = useCallback(() => {
    if (activeGame?.mode === 'online_multiplayer') {
      sendSocket({ type: 'game:action', action: 'roll' });
      return;
    }
    setActiveGame((prev) => {
      if (!prev) return prev;
      const res = performRoll(prev);
      if (res.sound) playSoundCue(res.sound);
      return res.game;
    });
  }, [activeGame?.mode, sendSocket]);

  const handleBank = useCallback(() => {
    if (activeGame?.mode === 'online_multiplayer') {
      sendSocket({ type: 'game:action', action: 'bank' });
      return;
    }
    setActiveGame((prev) => {
      if (!prev) return prev;
      const res = performBank(prev);
      if (res.sound) playSoundCue(res.sound);
      if (res.gameOver) {
        saveActiveGame(null);
        setSavedGame(null);
        recordFinishedGame(res.game);
        setPhase('GAME_OVER');
      }
      return res.game;
    });
  }, [activeGame?.mode, sendSocket, recordFinishedGame]);

  // Local Lars AI orchestration (online rooms run Lars AI on server)
  const aiTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (aiTimerRef.current) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    if (
      phase !== 'PLAYING' ||
      !activeGame ||
      activeGame.mode === 'online_multiplayer'
    ) {
      return;
    }

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
  }, [phase, activeGame, handleRoll, handleBank]);

  // Keyboard shortcuts during active play
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
      const isMyTurn =
        activePlayer.type === 'human' &&
        (activeGame.mode !== 'online_multiplayer' ||
          activePlayer.clientId === localClientId);

      if (!isMyTurn) return;

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
  }, [
    phase,
    activeGame,
    localClientId,
    rulesOpen,
    highscoreModal.open,
    handleRoll,
    handleBank,
  ]);

  const handleClearHistory = useCallback(() => {
    clearGameHistory();
    setHistory([]);
  }, []);

  const handleExitFromBoard = useCallback(() => {
    if (activeGame?.mode === 'online_multiplayer') {
      handleLeaveOnlineRoom();
    } else {
      setPhase('TITLE');
    }
  }, [activeGame?.mode, handleLeaveOnlineRoom]);

  return (
    <>
      {phase === 'TITLE' && (
        <TitleScreen
          savedGame={savedGame}
          theme={theme}
          isMuted={isMuted}
          historyCount={history.length}
          initialPlayerName={loadSavedPlayerName()}
          initialRoomCode={urlRoomCode}
          onlineError={onlineError}
          isSocketConnected={isSocketConnected}
          onToggleTheme={handleToggleTheme}
          onToggleMute={handleToggleMute}
          onResumeGame={handleResumeGame}
          onDiscardSavedGame={handleDiscardSavedGame}
          onStartNewGame={handleStartNewGame}
          onCreateOnlineRoom={handleCreateOnlineRoom}
          onJoinOnlineRoom={handleJoinOnlineRoom}
          onOpenRules={() => setRulesOpen(true)}
          onOpenHighscores={() => setHighscoreModal({ open: true, tab: 'highscores' })}
          onOpenHistory={() => setHighscoreModal({ open: true, tab: 'history' })}
        />
      )}

      {phase === 'ONLINE_LOBBY' && onlineRoom && (
        <OnlineLobby
          room={onlineRoom}
          localClientId={localClientId}
          isConnected={isSocketConnected}
          errorMessage={onlineError}
          onUpdateConfig={handleUpdateOnlineConfig}
          onStartGame={handleStartOnlineGame}
          onLeaveRoom={handleLeaveOnlineRoom}
        />
      )}

      {(phase === 'PLAYING' || phase === 'GAME_OVER') && activeGame && (
        <GameBoard
          game={activeGame}
          theme={theme}
          isMuted={isMuted}
          localClientId={localClientId}
          isSocketConnected={isSocketConnected}
          onToggleTheme={handleToggleTheme}
          onToggleMute={handleToggleMute}
          onExitToTitle={handleExitFromBoard}
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
          isOnlineHost={
            activeGame.mode !== 'online_multiplayer' ||
            onlineRoom?.hostClientId === localClientId
          }
          onPlayAgain={handlePlayAgain}
          onReturnToTitle={handleExitFromBoard}
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
