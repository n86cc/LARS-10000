import type {
  CompletedGameRecord,
  GameState,
  HighscorePlayerStat,
  ThemeMode,
} from '../types/game';

const KEYS = {
  THEME: 'lars10000_theme',
  MUTED: 'lars10000_muted',
  ACTIVE_GAME: 'lars10000_active_game_v1',
  HISTORY: 'lars10000_history_v1',
};

export function loadTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(KEYS.THEME);
    return raw === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(KEYS.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch {
    // ignore storage errors
  }
}

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(KEYS.MUTED) === 'true';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEYS.MUTED, String(muted));
  } catch {
    // ignore
  }
}

export function loadActiveGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEYS.ACTIVE_GAME);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || !Array.isArray(parsed.players) || !parsed.turn) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveGame(state: GameState | null): void {
  try {
    if (!state) {
      localStorage.removeItem(KEYS.ACTIVE_GAME);
    } else {
      localStorage.setItem(KEYS.ACTIVE_GAME, JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}

export function loadGameHistory(): CompletedGameRecord[] {
  try {
    const raw = localStorage.getItem(KEYS.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompletedGameRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendGameHistory(record: CompletedGameRecord): CompletedGameRecord[] {
  const existing = loadGameHistory();
  // Avoid duplicate saves for the same game ID
  const filtered = existing.filter((r) => r.id !== record.id);
  const next = [record, ...filtered].slice(0, 100);
  try {
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearGameHistory(): void {
  try {
    localStorage.removeItem(KEYS.HISTORY);
  } catch {
    // ignore
  }
}

export function deriveHighscores(history: CompletedGameRecord[]): {
  topGames: Array<{
    gameId: string;
    playerName: string;
    isAI: boolean;
    score: number;
    bestTurn: number;
    finishedAt: string;
    mode: CompletedGameRecord['mode'];
  }>;
  playerStats: HighscorePlayerStat[];
} {
  const topGames: Array<{
    gameId: string;
    playerName: string;
    isAI: boolean;
    score: number;
    bestTurn: number;
    finishedAt: string;
    mode: CompletedGameRecord['mode'];
  }> = [];

  const statsMap = new Map<string, HighscorePlayerStat>();

  for (const game of history) {
    for (const p of game.players) {
      topGames.push({
        gameId: game.id,
        playerName: p.name,
        isAI: p.type === 'ai',
        score: p.totalScore,
        bestTurn: p.bestTurn,
        finishedAt: game.finishedAt,
        mode: game.mode,
      });

      const key = `${p.name.trim().toLowerCase()}_${p.type}`;
      const existing = statsMap.get(key) ?? {
        name: p.name,
        isAI: p.type === 'ai',
        wins: 0,
        gamesPlayed: 0,
        highestGameScore: p.totalScore,
        bestSingleTurn: p.bestTurn,
      };
      existing.gamesPlayed += 1;
      if (p.name === game.winnerName && p.totalScore === game.winnerScore) {
        existing.wins += 1;
      }
      if (p.totalScore > existing.highestGameScore) {
        existing.highestGameScore = p.totalScore;
      }
      if (p.bestTurn > existing.bestSingleTurn) {
        existing.bestSingleTurn = p.bestTurn;
      }
      statsMap.set(key, existing);
    }
  }

  topGames.sort((a, b) => b.score - a.score);
  const playerStats = Array.from(statsMap.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.highestGameScore - a.highestGameScore;
  });

  return {
    topGames: topGames.slice(0, 20),
    playerStats,
  };
}
