import { useEffect, useState } from 'react';
import { Award, History, Trash2, X } from 'lucide-react';
import type { CompletedGameRecord } from '../types/game';
import { deriveHighscores } from '../storage/persistence';

interface HighscoreModalProps {
  isOpen: boolean;
  initialTab?: 'highscores' | 'history';
  history: CompletedGameRecord[];
  onClearHistory: () => void;
  onClose: () => void;
}

export function HighscoreModal({
  isOpen,
  initialTab = 'highscores',
  history,
  onClearHistory,
  onClose,
}: HighscoreModalProps) {
  const [tab, setTab] = useState<'highscores' | 'history'>(initialTab);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setConfirmClear(false);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const { topGames, playerStats } = deriveHighscores(history);

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('da-DK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hs-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88dvh] flex flex-col rounded-2xl bg-white dark:bg-[#0d2749] border border-slate-200 dark:border-sky-800/60 shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-sky-800/50">
          <div>
            <h2 id="hs-modal-title" className="font-display text-xl font-bold">
              Highscore & Spilhistorik
            </h2>
            <p className="text-xs text-slate-500 dark:text-sky-200/70">
              Gemmes lokalt i din browser · {history.length} afsluttede spil
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk vindue"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-sky-200/70 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented tabs + Clear */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-50 dark:bg-[#0a203d] border-b border-slate-200 dark:border-sky-800/40">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/80 dark:bg-[#13335e]">
            <button
              type="button"
              onClick={() => setTab('highscores')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'highscores'
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-sky-100/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Highscoreliste
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'history'
                  ? 'bg-white dark:bg-sky-500 text-slate-900 dark:text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-sky-100/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Afsluttede spil ({history.length})
            </button>
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-2">
              {confirmClear ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistory();
                      setConfirmClear(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 transition-colors cursor-pointer"
                  >
                    Bekræft sletning
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-sky-200 hover:bg-slate-200 dark:hover:bg-sky-900/50 transition-colors cursor-pointer"
                  >
                    Annuller
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-sky-200/80 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-sky-900/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Ryd historik
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {history.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="font-display text-lg font-bold text-slate-700 dark:text-sky-100">
                Ingen afsluttede spil endnu
              </p>
              <p className="text-sm text-slate-500 dark:text-sky-200/70 max-w-md mx-auto">
                Når et spil afsluttes over 10.000 point, registreres resultaterne automatisk her i både highscorelisten og spilhistorikken.
              </p>
            </div>
          ) : tab === 'highscores' ? (
            <>
              <div>
                <h3 className="font-display text-base font-bold mb-3">
                  Spillerstatistik (Flest sejre & rekorder)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-sky-800/50">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-[#143763] text-xs text-slate-600 dark:text-sky-100/80">
                        <th className="py-2.5 px-3.5 font-semibold">#</th>
                        <th className="py-2.5 px-3.5 font-semibold">Spiller</th>
                        <th className="py-2.5 px-3.5 font-semibold text-right">Sejre</th>
                        <th className="py-2.5 px-3.5 font-semibold text-right">Kampe</th>
                        <th className="py-2.5 px-3.5 font-semibold text-right">Højeste score</th>
                        <th className="py-2.5 px-3.5 font-semibold text-right">Bedste tur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-sky-800/40">
                      {playerStats.map((stat, idx) => (
                        <tr key={`${stat.name}-${stat.isAI}`} className="bg-white dark:bg-[#0b213f]">
                          <td className="py-2.5 px-3.5 font-mono tabular-nums text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3.5 font-semibold">
                            {stat.name}
                            {stat.isAI && (
                              <span className="ml-1.5 text-xs font-normal text-sky-600 dark:text-sky-300">
                                · AI
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                            {stat.wins}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-600 dark:text-sky-100/80">
                            {stat.gamesPlayed}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                            {stat.highestGameScore.toLocaleString('da-DK')}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-700 dark:text-sky-100">
                            {stat.bestSingleTurn.toLocaleString('da-DK')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="font-display text-base font-bold mb-3">
                  Top 20 enkeltresultater
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-sky-800/50">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-[#143763] text-xs text-slate-600 dark:text-sky-100/80">
                        <th className="py-2.5 px-3.5 font-semibold">Plads</th>
                        <th className="py-2.5 px-3.5 font-semibold">Spiller</th>
                        <th className="py-2.5 px-3.5 font-semibold">Tilstand</th>
                        <th className="py-2.5 px-3.5 font-semibold text-right">Slutscore</th>
                        <th className="py-2.5 px-3.5 font-semibold text-right">Dato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-sky-800/40">
                      {topGames.map((entry, idx) => (
                        <tr key={`${entry.gameId}-${entry.playerName}-${idx}`} className="bg-white dark:bg-[#0b213f]">
                          <td className="py-2.5 px-3.5 font-mono tabular-nums font-bold text-slate-500 dark:text-sky-200/70">
                            {idx + 1}.
                          </td>
                          <td className="py-2.5 px-3.5 font-semibold">
                            {entry.playerName}
                            {entry.isAI && (
                              <span className="ml-1.5 text-xs font-normal text-sky-600 dark:text-sky-300">
                                · AI
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-xs text-slate-500 dark:text-sky-200/70">
                            {entry.mode === 'vs_lars' ? 'Mod Lars' : 'Multiplayer'}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                            {entry.score.toLocaleString('da-DK')}
                          </td>
                          <td className="py-2.5 px-3.5 text-right text-xs text-slate-500 dark:text-sky-200/70 whitespace-nowrap">
                            {formatDate(entry.finishedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {history.map((game) => {
                const sortedPlayers = [...game.players].sort((a, b) => b.totalScore - a.totalScore);
                return (
                  <div
                    key={game.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b213f] border border-slate-200 dark:border-sky-800/50 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-sky-200/70">
                      <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-sky-100">
                        <span>{game.mode === 'vs_lars' ? 'Mod Lars (AI)' : 'Lokal Multiplayer'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{game.totalRounds} runder</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Vinder: {game.winnerName}
                        </span>
                      </div>
                      <span>{formatDate(game.finishedAt)}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sortedPlayers.map((p, i) => (
                        <div
                          key={`${game.id}-${p.name}-${i}`}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-[#112e54] border border-slate-200/80 dark:border-sky-800/40"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                              {i + 1}. {p.name}
                            </span>
                            <span className="block text-[11px] text-slate-500 dark:text-sky-200/70">
                              Bedste tur: {p.bestTurn.toLocaleString('da-DK')} pt
                            </span>
                          </div>
                          <span className="font-mono tabular-nums font-bold text-base text-amber-600 dark:text-amber-400">
                            {p.totalScore.toLocaleString('da-DK')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
