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
  evaluateSelection,
  findBestScoringSubset,
  getScoringDieIds,
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

  const scoringDieIds = useMemo(() => {
    if (turn.subPhase !== 'SELECTING_DICE') return new Set<number>();
    return getScoringDieIds(
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

  const bestSubset = useMemo(() => {
    if (turn.subPhase !== 'SELECTING_DICE') return null;
    return findBestScoringSubset(
      availableDice.map((d) => ({ id: d.id, value: d.value })),
      {
        isFirstRollOfTurn: turn.isFirstRollOfTurn,
        lockedCycleTriples: turn.lockedCycleTriples,
      }
    );
  }, [availableDice, turn.subPhase, turn.isFirstRollOfTurn, turn.lockedCycleTriples]);

  const projectedTurnScore =
    turn.turnScore + (selectionEval?.isValid ? selectionEval.score : 0);

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

  // Build visible recent round rows for active player (like ROUND / SCORE in farkle.png)
  const recentRounds = activePlayer.roundScores.slice(-4);
  const startRoundIdx = Math.max(1, activePlayer.roundScores.length - recentRounds.length + 1);

  // Staircase rows: 1 to 6 slots or grouped batches locked in this cycle
  const lockedCountInCycle = lockedDice.length;

  return (
    <div className="min-h-[100dvh] board-felt flex flex-col justify-between">
      {/* Top HUD Bar */}
      <header className="w-full max-w-[1440px] mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 pt-3 pb-2">
        <button
          type="button"
          onClick={onExitToTitle}
          aria-label={isOnline ? 'Forlad rum' : 'Tilbage til startskærm'}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-800 dark:text-white border border-slate-200/80 dark:border-sky-700/50 shadow-xs text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{isOnline ? 'Forlad' : 'Menu'}</span>
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-sky-100">
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

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenHighscores}
            aria-label="Highscore og historik"
            title="Highscore og historik"
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            <Award className="w-4 h-4 text-sky-500" />
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Slå lyd til' : 'Slå lyd fra'}
            title={isMuted ? 'Slå lyd til' : 'Slå lyd fra'}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Skift til lyst tema' : 'Skift til mørkt tema'}
            title={theme === 'dark' ? 'Skift til lyst tema' : 'Skift til mørkt tema'}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onOpenRules}
            aria-label="Åbn spilleregler"
            title="Spilleregler"
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#143763] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-amber-500" />
          </button>
        </div>
      </header>

      {/* Main 3-Zone Responsive Game Table */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-3 grid grid-cols-1 lg:grid-cols-[260px_1fr_290px] gap-4 sm:gap-6 items-stretch">
        {/* LEFT PANEL: Round/Score history, Radial Gauge, Locked Staircase, BANK button */}
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

          {/* BANK / GEM button (inspired by BANK button in farkle.png) */}
          <button
            type="button"
            onClick={onBank}
            disabled={!canBank}
            className={`w-full py-3 px-4 rounded-xl font-display font-extrabold text-base tracking-wide border-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              canBank
                ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/25'
                : 'bg-slate-200 dark:bg-[#0b2342] border-slate-300 dark:border-amber-500/40 text-slate-600 dark:text-sky-100/70'
            }`}
          >
            GEM POINT
          </button>
        </section>

        {/* CENTER ARENA: Rolled Dice & Live Scoring Feedback */}
        <section
          aria-label="Terningebord"
          className="order-1 lg:order-2 flex flex-col items-center justify-between py-4 sm:py-6 px-3 sm:px-6 rounded-2xl border border-slate-200/60 dark:border-sky-800/30 bg-white/30 dark:bg-[#081f3c]/40 min-h-[340px] sm:min-h-[440px]"
        >
          {/* Turn Banner */}
          <div className="w-full max-w-lg text-center space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-300">
              <span>{activePlayer.name}s tur</span>
              <span aria-hidden="true">·</span>
              <span>
                {activePlayer.isOnBoard ? 'På tavlen (min. 350)' : 'Åbning (kræver 1.000)'}
              </span>
            </div>
            <p
              className={`text-sm sm:text-base font-semibold min-h-[24px] ${
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

          {/* Dice Grid */}
          <div className="my-auto py-6 flex flex-col items-center justify-center w-full">
            {arenaDice.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-5 max-w-md">
                {arenaDice.map((die, idx) => {
                  const isScoring = scoringDieIds.has(die.id);
                  const isSelected = die.status === 'selected';
                  const isReady = die.status === 'ready';
                  const canClick =
                    isHumanTurn && turn.subPhase === 'SELECTING_DICE';

                  return (
                    <Die3D
                      key={die.id}
                      value={die.value}
                      size="lg"
                      isScoring={isScoring}
                      isSelected={isSelected}
                      isDimmed={
                        isReady ||
                        (turn.subPhase === 'SELECTING_DICE' && !isScoring && !isSelected)
                      }
                      rollNonce={die.rollNonce}
                      staggerIndex={idx}
                      disabled={!canClick}
                      onClick={canClick ? () => onToggleDie(die.id) : undefined}
                      ariaLabel={`Terning ${idx + 1}: værdi ${die.value}${
                        isScoring ? ', pointgivende' : ''
                      }${isSelected ? ', valgt' : ''}`}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 flex items-center justify-center">
                  <Sparkles className="w-7 h-7" />
                </div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Alle 6 terninger gav point! Kast alle 6 igen eller gem din score.
                </p>
              </div>
            )}
          </div>

          {/* Live Selection Preview + Markér Bedste */}
          <div className="w-full max-w-lg min-h-[52px] flex flex-wrap items-center justify-center gap-3">
            {turn.subPhase === 'SELECTING_DICE' && isHumanTurn && (
              <>
                {selectedDice.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <span className="text-xs sm:text-sm text-slate-600 dark:text-sky-200/75">
                      Klik på de lysende terninger for at vælge point
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
                  <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-semibold">
                    <span className="font-mono tabular-nums font-bold">
                      +{selectionEval.score.toLocaleString('da-DK')} pt
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectionEval.labels.join(' + ')}</span>
                  </div>
                ) : (
                  <div className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-medium">
                    En eller flere valgte terninger giver ingen point alene
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: Players List & Roll/Lock Controls */}
        <section
          aria-label="Spillere og handlinger"
          className="order-3 flex flex-col justify-between gap-4"
        >
          {/* Players Roster */}
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

          {/* Action Buttons (Bottom-right like farkle.png: Lock + Roll) */}
          <div className="p-4 rounded-2xl bg-white/85 dark:bg-[#071f3d]/90 border border-slate-200/90 dark:border-sky-800/50 shadow-lg space-y-2.5">
            <div className="flex items-stretch gap-2.5">
              <button
                type="button"
                onClick={onLockSelected}
                disabled={!canLock}
                title="Lås valgte terninger"
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-display font-bold text-sm bg-slate-200 hover:bg-slate-300 dark:bg-[#143968] dark:hover:bg-[#1b4a85] text-slate-900 dark:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Lock className="w-4 h-4" />
                <span>LÅS</span>
              </button>

              <button
                type="button"
                onClick={onRoll}
                disabled={!canRoll}
                className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl font-display font-extrabold text-base tracking-wide bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-slate-950 shadow-lg shadow-sky-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Dices className="w-5 h-5" />
                <span>
                  {turn.subPhase === 'HOT_DICE_CHOICE'
                    ? 'KAST ALLE 6'
                    : canLock
                      ? 'LÅS & KAST'
                      : 'KAST'}
                </span>
              </button>
            </div>

            <p className="text-[11px] text-center text-slate-500 dark:text-sky-200/65">
              {isHumanTurn
                ? 'Mellemrum: Kast · Enter: Gem point'
                : activePlayer.type === 'ai'
                  ? `${activePlayer.name} tænker...`
                  : `Venter på ${activePlayer.name}...`}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
