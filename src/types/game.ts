export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export type DieStatus = 'ready' | 'available' | 'selected' | 'locked';

export interface DieState {
  id: number;
  value: DieValue;
  status: DieStatus;
  /** Used to stagger & re-trigger roll animation */
  rollNonce: number;
}

export interface LockedBatch {
  id: string;
  rollNumber: number;
  diceValues: DieValue[];
  points: number;
  labels: string[];
  isDoubling?: boolean;
}

export type AIDifficulty = 'afslappet' | 'taktisk' | 'mester';

export type PlayerType = 'human' | 'ai';

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  isLars?: boolean;
  avatarColor: string;
  totalScore: number;
  isOnBoard: boolean;
  consecutiveZeros: number;
  roundScores: number[];
  bestTurn: number;
}

export type TurnSubPhase =
  | 'AWAITING_ROLL'
  | 'SELECTING_DICE'
  | 'HOT_DICE_CHOICE'
  | 'FARKLE_PAUSE'
  | 'AI_THINKING';

export interface TurnState {
  playerIndex: number;
  roundNumber: number;
  rollCountInTurn: number;
  isFirstRollOfTurn: boolean;
  turnScore: number;
  dice: DieState[];
  /** Counts of values that already reached >= 3-of-a-kind in the current 6-dice cycle */
  lockedCycleTriples: Partial<Record<DieValue, number>>;
  /** Batches locked in the current 6-dice cycle (shown in staircase) */
  cycleLockedBatches: LockedBatch[];
  /** All batches locked in the whole turn (for summary/history) */
  allTurnBatches: LockedBatch[];
  subPhase: TurnSubPhase;
  statusMessage: string;
}

export type GameMode = 'vs_lars' | 'local_multiplayer';

export type GamePhase = 'TITLE' | 'PLAYING' | 'GAME_OVER';

export interface GameState {
  id: string;
  mode: GameMode;
  aiDifficulty: AIDifficulty;
  players: Player[];
  turn: TurnState;
  finalRoundTriggered: boolean;
  finalRoundTriggeredByIndex: number | null;
  winnerIndex: number | null;
  startedAt: string;
  updatedAt: string;
}

export interface CompletedGamePlayer {
  name: string;
  type: PlayerType;
  isLars?: boolean;
  totalScore: number;
  bestTurn: number;
  roundsPlayed: number;
}

export interface CompletedGameRecord {
  id: string;
  finishedAt: string;
  mode: GameMode;
  aiDifficulty?: AIDifficulty;
  totalRounds: number;
  winnerName: string;
  winnerScore: number;
  players: CompletedGamePlayer[];
}

export interface HighscorePlayerStat {
  name: string;
  isAI: boolean;
  wins: number;
  gamesPlayed: number;
  highestGameScore: number;
  bestSingleTurn: number;
}

export interface ScoringEvaluation {
  isValid: boolean;
  score: number;
  labels: string[];
  isDoubling: boolean;
  /** Values whose existing locked >=3-of-a-kind group gets extended by this selection */
  extendedTripleCounts: Partial<Record<DieValue, number>>;
  /** New >=3-of-a-kind groups formed within this selection itself */
  newTripleCounts: Partial<Record<DieValue, number>>;
}

export type ThemeMode = 'dark' | 'light';
