import { useMemo } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  Dices,
  Lock,
  Moon,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  AlertTriangle,
} from 'lucide-react';
import type { GameState, ThemeMode } from '../types/game';
import {
  analyzeAvailableDice,
  evaluateSelection,
} from '../engine/scoring';
import { Die3D } from './Die3D';
import { CircularGauge } from './CircularGauge';
import { PlayerAvatar } from './LarsAvatar';

interface GameBoardProps {
  game: GameState;
  theme: ThemeMode;
  isMuted: boolean;
  localClientId?: string;
  isSocketConnected?: boolean;
  onToggleTheme: () => void;
  onToggleMute: () => void;
  onExitToTitle: () => void;
  onOpenRules: () => void;
  onOpenHighscores: () => void;
  onRoll: () => void;
  onToggleDie: (dieId: number) => void;
  onSelectBest: () => void;
  onLockSelected: () => void;
  onBank: () => void;
}

export function GameBoard({
  game,
  theme,
  isMuted,
  localClientId,
  isSocketConnected = true,
  onToggleTheme,
  onToggleMute,
  onExitToTitle,
  onOpenRules,
  onOpenHighscores,
  onRoll,
  onToggleDie,
  onSelectBest,
  onLockSelected,
  onBank,
}: GameBoardProps) {
  const { players, turn, finalRoundTriggered } = game;
  const activePlayer = players[turn.playerIndex];
  const isOnline = game.mode === 'online_multiplayer';
  const isHumanTurn =
    activePlayer.type === 'human' &&
    (!isOnline || activePlayer.clientId === localClientId);
  const minRequired = activePlayer.isOnBoard ? 350 : 1000;

  const availableDice = useMemo(
    () => turn.dice.filter((d) => d.status === 'available' || d.status === 'selected'),
    [turn.dice]
  );

  const selectedDice = useMemo(
    () => turn.dice.filter((d) => d.status === 'selected'),
    [turn.dice]
  );

  const lockedDice = useMemo(
    () => turn.dice.filter((d) => d.status === 'locked'),
    [turn.dice]
  );

  const arenaDice = useMemo(
    () => turn.dice.filter((d) => d.status !== 'locked'),
    [turn.dice]
  );

  // Single-pass scoring analysis for both scoring die glow and "Markér bedste"
  const { scoringDieIds, bestSubset } = useMemo(() => {
    if (turn.subPhase !== 'SELECTING_DICE') {
      return { scoringDieIds: new Set<number>(), bestSubset: null };
    }
    return analyzeAvailableDice(
      availableDice.map((d) => ({ id: d.id, value: d.value })),
      {
        isFirstRollOfTurn: turn.isFirstRollOfTurn,
        lockedCycleTriples: turn.lockedCycleTriples,
      }
    );
  }, [availableDice, turn.subPhase, turn.isFirstRollOfTurn, turn.lockedCycleTriples]);

  const selectionEval = useMemo(() => {
    if (selectedDice.length === 0) return null;
    return evaluateSelection(
      selectedDice.map((d) => d.value),
      {
        isFirstRollOfTurn: turn.isFirstRollOfTurn,
        lockedCycleTriples: turn.lockedCycleTriples,
      }
    );
  }, [selectedDice, turn.isFirstRollOfTurn, turn.lockedCycleTriples]);

  const projectedTurnScore =
    turn.turnScore + (selectionEval?.isValid ? selectionEval.score : 0);
  const progressPct = Math.min(100, Math.round((projectedTurnScore / minRequired) * 100));

  const canLock =
    isHumanTurn &&
    turn.subPhase === 'SELECTING_DICE' &&
    Boolean(selectionEval?.isValid && selectionEval.score > 0);

  const canRoll =
    isHumanTurn &&
    (turn.subPhase === 'AWAITING_ROLL' ||
      turn.subPhase === 'HOT_DICE_CHOICE' ||
      canLock);

  const canBank =
    isHumanTurn &&
    (turn.subPhase === 'HOT_DICE_CHOICE' ||
      (turn.subPhase === 'AWAITING_ROLL' && turn.turnScore >= minRequired) ||
      (turn.subPhase === 'SELECTING_DICE' &&
        selectedDice.length > 0 &&
        Boolean(selectionEval?.isValid && projectedTurnScore >= minRequired))) &&
    projectedTurnScore >= minRequired;

  const recentRounds = activePlayer.roundScores.slice(-4);
  const startRoundIdx = Math.max(1, activePlayer.roundScores.length - recentRounds.length + 1);
  const lockedCountInCycle = lockedDice.length;
  const canClickDice = isHumanTurn && turn.subPhase === 'SELECTING_DICE';

  return (
    <div className="min-h-[100dvh] board-felt flex flex-col">
      {/* Top HUD Bar */}
      <header className="w-full max-w-[1440px] mx-auto flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 pt-2.5 pb-1.5">
        <button
          type="button"
          onClick={onExitToTitle}
          aria-label={isOnline ? 'Forlad rum' : 'Tilbage til startskærm'}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-800 dark:text-white border border-slate-200/80 dark:border-sky-700/50 shadow-xs text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{isOnline ? 'Forlad' : 'Menu'}</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-sky-100 truncate">
          <span className="font-display font-bold tracking-tight">LARS:10000</span>
          {isOnline && game.roomCode && (
            <>
              <span aria-hidden="true" className="text-slate-400 dark:text-sky-400/50">·</span>
              <span className="font-mono tabular-nums text-sky-600 dark:text-sky-300">
                Rum {game.roomCode}
              </span>
            </>
          )}
          <span aria-hidden="true" className="text-slate-400 dark:text-sky-400/50">·</span>
          <span className="font-mono tabular-nums">Runde {turn.roundNumber}</span>
          {finalRoundTriggered && (
            <>
              <span aria-hidden="true" className="text-slate-400 dark:text-sky-400/50">·</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                Sidste runde
              </span>
            </>
          )}
          {isOnline && !isSocketConnected && (
            <>
              <span aria-hidden="true" className="text-slate-400 dark:text-sky-400/50">·</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                Genopretter...
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenHighscores}
            aria-label="Highscore og historik"
            title="Highscore og historik"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            <Award className="w-4 h-4 text-sky-500" />
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Slå lyd til' : 'Slå lyd fra'}
            title={isMuted ? 'Slå lyd til' : 'Slå lyd fra'}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Skift til lyst tema' : 'Skift til mørkt tema'}
            title={theme === 'dark' ? 'Skift til lyst tema' : 'Skift til mørkt tema'}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onOpenRules}
            aria-label="Åbn spilleregler"
            title="Spilleregler"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-amber-500" />
          </button>
        </div>
      </header>

      {/* Mobile Compact Players Scoreboard (always visible above dice, zero scroll needed) */}
      <div className="lg:hidden w-full max-w-[1440px] mx-auto px-3 pb-1.5">
        <div
          className={`grid gap-1.5 ${
            players.length === 2
              ? 'grid-cols-2'
              : players.length === 3
                ? 'grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-4'
          }`}
        >
          {players.map((p, idx) => {
            const isCurrent = idx === turn.playerIndex;
            const isMe = isOnline && p.clientId === localClientId;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border transition-colors ${
                  isCurrent
                    ? 'bg-white dark:bg-[#11335e] border-amber-400 ring-1 ring-amber-400/50 shadow-sm'
                    : 'bg-white/75 dark:bg-[#081f3c]/85 border-slate-200/80 dark:border-sky-800/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PlayerAvatar
                    name={p.name}
                    isLars={p.isLars}
                    avatarColor={p.avatarColor}
                    sizeClass="w-7 h-7"
                    className={isCurrent ? 'ring-1 ring-amber-400' : ''}
                  />
                  <div className="min-w-0 leading-tight">
                    <p className="font-display font-bold text-xs text-slate-900 dark:text-white truncate">
                      {p.name}
                      {isMe && (
                        <span className="ml-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          (Dig)
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-sky-200/65 truncate">
                      {p.isOnBoard ? 'På tavlen' : 'Åbner (1.000)'}
                      {p.consecutiveZeros > 0 ? ` · ${p.consecutiveZeros}/3` : ''}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono tabular-nums text-sm font-extrabold shrink-0 ${
                    p.totalScore < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : p.totalScore >= 10000
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {p.totalScore.toLocaleString('da-DK')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 3-Zone Responsive Game Table */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 py-1.5 sm:py-3 grid grid-cols-1 lg:grid-cols-[260px_1fr_290px] gap-3 sm:gap-5 items-stretch">
        {/* LEFT PANEL: Round/Score history, Radial Gauge, Locked Staircase */}
        <section
          aria-label="Turstatus og låste terninger"
          className="order-2 lg:order-1 flex flex-col justify-between gap-4 p-4 rounded-2xl bg-white/85 dark:bg-[#071f3d]/90 border border-slate-200/90 dark:border-sky-800/50 shadow-lg"
        >
          {/* Active Player Round Log */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-500 dark:text-sky-200/70 uppercase">
              <span>Runde</span>
              <span>Score</span>
            </div>

            {recentRounds.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-sky-200/60 py-2">
                Ingen afsluttede runder endnu for {activePlayer.name}.
              </p>
            ) : (
              <div className="space-y-1">
                {recentRounds.map((sc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm font-mono tabular-nums"
                  >
                    <span className="text-slate-500 dark:text-sky-200/70">
                      {startRoundIdx + idx}
                    </span>
                    <span
                      className={
                        sc === 0
                          ? 'font-bold text-amber-500'
                          : sc < 0
                            ? 'font-bold text-rose-500'
                            : 'font-bold text-slate-900 dark:text-white'
                      }
                    >
                      {sc.toLocaleString('da-DK')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activePlayer.consecutiveZeros > 0 && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Nul-ture i træk: <strong className="font-mono">{activePlayer.consecutiveZeros}/3</strong>
                </span>
              </div>
            )}
          </div>

          {/* Radial Gauge + Tur-værdi */}
          <div className="flex flex-col items-center py-2 border-y border-slate-200/80 dark:border-sky-800/40">
            <CircularGauge
              currentValue={projectedTurnScore}
              targetValue={minRequired}
              label={
                activePlayer.isOnBoard
                  ? 'Minimum pr. tur (350)'
                  : 'Åbningskrav (1.000)'
              }
            />
            <div className="mt-3 w-full flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-sky-200/70 font-medium">Tur-score</span>
              <span className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
                {projectedTurnScore.toLocaleString('da-DK')}
              </span>
            </div>
          </div>

          {/* Staircase / Locked Dice in Current Cycle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-sky-200/70">
              <span className="font-medium">Låst i denne runde</span>
              <span className="font-mono tabular-nums">{lockedCountInCycle}/6</span>
            </div>

            {turn.cycleLockedBatches.length === 0 ? (
              <div className="grid grid-cols-6 gap-1.5 py-1" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 rounded-lg bg-slate-200/70 dark:bg-sky-900/40 border border-slate-300/50 dark:border-sky-800/40"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {turn.cycleLockedBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-100/80 dark:bg-[#0d2a4f] border border-slate-200/70 dark:border-sky-800/40"
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      {batch.diceValues.map((v, i) => (
                        <Die3D key={`${batch.id}-${i}`} value={v} size="sm" isLocked />
                      ))}
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0 pr-1">
                      +{batch.points.toLocaleString('da-DK')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CENTER ARENA: Turn Progress + Dice + Unified Roll/Lock/Bank Dock */}
        <section
          aria-label="Terningebord"
          className="order-1 lg:order-2 flex flex-col items-center justify-between gap-3 py-3 sm:py-5 px-3 sm:px-6 rounded-2xl border border-slate-200/60 dark:border-sky-800/30 bg-white/35 dark:bg-[#081f3c]/45"
        >
          {/* Turn Banner + Live Tur-score bar (visible right above dice so mobile needs no scrolling) */}
          <div className="w-full max-w-lg space-y-2">
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/80 dark:bg-[#071f3d]/85 border border-slate-200/80 dark:border-sky-800/40">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 truncate">
                  <span className="truncate">{activePlayer.name}s tur</span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0">
                    {activePlayer.isOnBoard ? 'Min. 350' : 'Åbner 1.000'}
                  </span>
                </div>
                <p
                  className={`text-xs sm:text-sm font-semibold truncate ${
                    turn.subPhase === 'FARKLE_PAUSE'
                      ? 'text-rose-600 dark:text-rose-400'
                      : turn.subPhase === 'HOT_DICE_CHOICE'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-800 dark:text-white'
                  }`}
                >
                  {turn.statusMessage}
                </p>
              </div>

              <div className="text-right shrink-0 pl-2 border-l border-slate-200/80 dark:border-sky-800/50">
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-sky-200/65">
                  Tur-score
                </span>
                <span
                  className={`font-mono tabular-nums text-base sm:text-lg font-extrabold leading-tight ${
                    projectedTurnScore >= minRequired
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {projectedTurnScore.toLocaleString('da-DK')}
                  <span className="text-[11px] font-medium text-slate-400 dark:text-sky-200/60">
                    /{minRequired.toLocaleString('da-DK')}
                  </span>
                </span>
              </div>
            </div>

            {/* Slim mobile progress bar */}
            <div className="lg:hidden h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-sky-950/80 overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  projectedTurnScore >= minRequired ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Dice Grid */}
          <div className="my-auto py-2 sm:py-4 flex flex-col items-center justify-center w-full">
            {arenaDice.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 max-w-[260px] sm:max-w-md">
                {arenaDice.map((die, idx) => {
                  const isScoring = scoringDieIds.has(die.id);
                  const isSelected = die.status === 'selected';
                  const isReady = die.status === 'ready';

                  return (
                    <Die3D
                      key={die.id}
                      dieId={die.id}
                      value={die.value}
                      size="lg"
                      isInteractive
                      isScoring={isScoring}
                      isSelected={isSelected}
                      isDimmed={
                        isReady ||
                        (turn.subPhase === 'SELECTING_DICE' && !isScoring && !isSelected)
                      }
                      rollNonce={die.rollNonce}
                      staggerIndex={idx}
                      disabled={!canClickDice}
                      onSelect={onToggleDie}
                      ariaLabel={`Terning ${idx + 1}: værdi ${die.value}${
                        isScoring ? ', pointgivende' : ''
                      }${isSelected ? ', valgt' : ''}`}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5 py-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Alle 6 terninger gav point! Kast alle 6 igen eller gem din score.
                </p>
              </div>
            )}
          </div>

          {/* Live Selection Preview + Markér Bedste */}
          <div className="w-full max-w-lg min-h-[40px] flex flex-wrap items-center justify-center gap-2">
            {turn.subPhase === 'SELECTING_DICE' && isHumanTurn && (
              <>
                {selectedDice.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <span className="text-xs text-slate-600 dark:text-sky-200/75">
                      Klik på de lysende terninger
                    </span>
                    {bestSubset && (
                      <button
                        type="button"
                        onClick={onSelectBest}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Markér bedste (+{bestSubset.evalResult.score.toLocaleString('da-DK')})
                      </button>
                    )}
                  </div>
                ) : selectionEval?.isValid ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold">
                    <span className="font-mono tabular-nums font-bold">
                      +{selectionEval.score.toLocaleString('da-DK')} pt
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectionEval.labels.join(' + ')}</span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-medium">
                    En eller flere valgte terninger giver ingen point alene
                  </div>
                )}
              </>
            )}
          </div>

          {/* UNIFIED ACTION DOCK: Directly below dice so players never scroll up and down */}
          <div className="w-full max-w-lg p-2.5 sm:p-3 rounded-2xl bg-white/90 dark:bg-[#071f3d]/95 border border-slate-200/90 dark:border-sky-800/50 shadow-lg space-y-2">
            <div className="grid grid-cols-[auto_1fr_auto] items-stretch gap-2">
              <button
                type="button"
                onClick={onLockSelected}
                disabled={!canLock}
                title="Lås valgte terninger"
                className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 rounded-xl font-display font-bold text-xs sm:text-sm bg-slate-200 hover:bg-slate-300 dark:bg-[#143968] dark:hover:bg-[#1b4a85] text-slate-900 dark:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Lock className="w-4 h-4" />
                <span>LÅS</span>
              </button>

              <button
                type="button"
                onClick={onRoll}
                disabled={!canRoll}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-display font-extrabold text-sm sm:text-base tracking-wide bg-sky-500 hover:bg-sky-400 active:scale-[0.98] text-slate-950 shadow-md shadow-sky-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Dices className="w-5 h-5 shrink-0" />
                <span>
                  {turn.subPhase === 'HOT_DICE_CHOICE'
                    ? 'KAST ALLE 6'
                    : canLock
                      ? 'LÅS & KAST'
                      : 'KAST'}
                </span>
              </button>

              <button
                type="button"
                onClick={onBank}
                disabled={!canBank}
                className={`flex items-center justify-center gap-1.5 px-3.5 sm:px-5 py-3 rounded-xl font-display font-extrabold text-xs sm:text-sm tracking-wide border-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${
                  canBank
                    ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 shadow-md shadow-amber-500/25'
                    : 'bg-slate-100 dark:bg-[#0b2342] border-slate-300 dark:border-amber-500/35 text-slate-500 dark:text-sky-100/70'
                }`}
              >
                <span>
                  {canBank
                    ? `GEM (${projectedTurnScore.toLocaleString('da-DK')})`
                    : 'GEM'}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-sky-200/65 px-1">
              <span>
                {isHumanTurn
                  ? 'Mellemrum: Kast · Enter: Gem point'
                  : activePlayer.type === 'ai'
                    ? `${activePlayer.name} tænker...`
                    : `Venter på ${activePlayer.name}...`}
              </span>
              <span className="font-mono tabular-nums lg:hidden">
                Låst: {lockedCountInCycle}/6
              </span>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL (Desktop): Full Players Roster */}
        <section
          aria-label="Spillere"
          className="hidden lg:flex lg:order-3 flex-col justify-between gap-4"
        >
          <div className="space-y-2.5">
            {players.map((p, idx) => {
              const isCurrent = idx === turn.playerIndex;
              const isMe = isOnline && p.clientId === localClientId;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-white dark:bg-[#11335e] border-amber-400 shadow-md ring-2 ring-amber-400/35'
                      : 'bg-white/75 dark:bg-[#081f3c]/85 border-slate-200/80 dark:border-sky-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatar
                      name={p.name}
                      isLars={p.isLars}
                      avatarColor={p.avatarColor}
                      sizeClass="w-11 h-11"
                      className={isCurrent ? 'ring-2 ring-amber-400' : ''}
                    />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm text-slate-900 dark:text-white truncate">
                        {p.name}
                        {isMe && (
                          <span className="ml-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            (Dig)
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-sky-200/70">
                        {p.isOnBoard ? 'På tavlen' : 'Ikke på tavlen'}
                        {p.consecutiveZeros > 0 ? ` · ${p.consecutiveZeros}/3 nul` : ''}
                        {isOnline && p.type === 'human' && p.connected === false ? ' · Afbrudt' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono tabular-nums text-lg font-extrabold ${
                        p.totalScore < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : p.totalScore >= 10000
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {p.totalScore.toLocaleString('da-DK')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#071f3d]/85 border border-slate-200/90 dark:border-sky-800/50 text-xs text-slate-600 dark:text-sky-200/80 space-y-1.5">
            <p className="font-display font-bold text-slate-800 dark:text-white">
              Hurtigt overblik
            </p>
            <p>Mål: Først over 10.000 point vinder runden.</p>
            <p>Åbning: 1.000 point · Derefter min. 350 point.</p>
            <p>3 nul-ture i træk giver -1.000 point.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
