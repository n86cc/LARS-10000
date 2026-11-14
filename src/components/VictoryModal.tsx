import { RotateCcw, Trophy } from 'lucide-react';
import type { GameState } from '../types/game';
import { PlayerAvatar } from './LarsAvatar';

interface VictoryModalProps {
  game: GameState;
  isOnlineHost?: boolean;
  onPlayAgain: () => void;
  onReturnToTitle: () => void;
}

export function VictoryModal({
  game,
  isOnlineHost = true,
  onPlayAgain,
  onReturnToTitle,
}: VictoryModalProps) {
  const sorted = [...game.players].sort((a, b) => b.totalScore - a.totalScore);
  const winner = sorted[0];
  const isOnline = game.mode === 'online_multiplayer';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0d2749] border border-slate-200 dark:border-sky-700/60 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="px-6 pt-7 pb-5 text-center bg-gradient-to-b from-amber-500/15 to-transparent border-b border-slate-200 dark:border-sky-800/50">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg mb-4">
            <Trophy className="w-7 h-7" />
          </div>
          <p className="text-xs font-semibold tracking-wide text-amber-600 dark:text-amber-400">
            Spillet er slut · {game.turn.roundNumber} runder spillet
          </p>
          <h2 id="victory-title" className="font-display text-2xl sm:text-3xl font-extrabold mt-1">
            {winner.name} vinder!
          </h2>
          <p className="mt-1 font-mono tabular-nums text-lg font-bold text-slate-700 dark:text-sky-200">
            {winner.totalScore.toLocaleString('da-DK')} point
          </p>
        </div>

        <div className="p-6 space-y-3">
          {sorted.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${
                index === 0
                  ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-300 dark:border-amber-400/50'
                  : 'bg-slate-50 dark:bg-[#112e54] border-slate-200 dark:border-sky-800/40'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono tabular-nums text-sm font-bold text-slate-500 dark:text-sky-200/70 w-5">
                  {index + 1}.
                </span>
                <PlayerAvatar
                  name={player.name}
                  isLars={player.isLars}
                  avatarColor={player.avatarColor}
                  sizeClass="w-10 h-10"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{player.name}</p>
                  <p className="text-xs text-slate-500 dark:text-sky-200/70">
                    Bedste tur: {player.bestTurn.toLocaleString('da-DK')} pt
                  </p>
                </div>
              </div>
              <span className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
                {player.totalScore.toLocaleString('da-DK')}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 px-6 pb-6">
          {!isOnline || isOnlineHost ? (
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-display font-bold text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Spil igen
            </button>
          ) : (
            <div className="flex-1 flex items-center justify-center px-4 py-3 rounded-xl text-xs font-medium text-slate-500 dark:text-sky-200/70 bg-slate-100 dark:bg-[#112e54]">
              Venter på at værten starter nyt spil...
            </div>
          )}
          <button
            type="button"
            onClick={onReturnToTitle}
            className="flex-1 px-5 py-3 rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-[#143763] dark:hover:bg-[#194378] text-slate-800 dark:text-white transition-colors cursor-pointer"
          >
            {isOnline ? 'Forlad rum' : 'Til startskærm'}
          </button>
        </div>
      </div>
    </div>
  );
}
