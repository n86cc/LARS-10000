import { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  History,
  Moon,
  Play,
  Plus,
  RotateCcw,
  Smartphone,
  Sun,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Bot,
} from 'lucide-react';
import type { AIDifficulty, GameMode, GameState, ThemeMode } from '../types/game';
import { LarsAvatar } from './LarsAvatar';

export interface StartGameConfig {
  mode: GameMode;
  aiDifficulty: AIDifficulty;
  players: Array<{ name: string; type: 'human' | 'ai'; isLars?: boolean }>;
}

interface TitleScreenProps {
  savedGame: GameState | null;
  theme: ThemeMode;
  isMuted: boolean;
  historyCount: number;
  initialPlayerName: string;
  initialRoomCode?: string;
  onlineError?: string | null;
  isSocketConnected: boolean;
  onToggleTheme: () => void;
  onToggleMute: () => void;
  onResumeGame: () => void;
  onDiscardSavedGame: () => void;
  onStartNewGame: (config: StartGameConfig) => void;
  onCreateOnlineRoom: (playerName: string) => void;
  onJoinOnlineRoom: (roomCode: string, playerName: string) => void;
  onOpenRules: () => void;
  onOpenHighscores: () => void;
  onOpenHistory: () => void;
}

const DEFAULT_HUMAN_NAMES = ['Spiller 1', 'Spiller 2', 'Spiller 3', 'Spiller 4'];

export function TitleScreen({
  savedGame,
  theme,
  isMuted,
  historyCount,
  initialPlayerName,
  initialRoomCode = '',
  onlineError,
  isSocketConnected,
  onToggleTheme,
  onToggleMute,
  onResumeGame,
  onDiscardSavedGame,
  onStartNewGame,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onOpenRules,
  onOpenHighscores,
  onOpenHistory,
}: TitleScreenProps) {
  const [mode, setMode] = useState<GameMode>(
    initialRoomCode ? 'online_multiplayer' : 'vs_lars'
  );
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('taktisk');
  const [soloPlayerName, setSoloPlayerName] = useState(initialPlayerName || 'Dig');
  const [onlineName, setOnlineName] = useState(initialPlayerName || '');
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [larsGoesFirst, setLarsGoesFirst] = useState(false);

  const [mpPlayers, setMpPlayers] = useState<Array<{ name: string; type: 'human' | 'ai'; isLars?: boolean }>>([
    { name: 'Spiller 1', type: 'human' },
    { name: 'Spiller 2', type: 'human' },
  ]);

  useEffect(() => {
    if (initialRoomCode) {
      setMode('online_multiplayer');
      setJoinCode(initialRoomCode);
    }
  }, [initialRoomCode]);

  const handleAddPlayer = () => {
    if (mpPlayers.length >= 4) return;
    const nextIdx = mpPlayers.length;
    setMpPlayers([...mpPlayers, { name: DEFAULT_HUMAN_NAMES[nextIdx] ?? `Spiller ${nextIdx + 1}`, type: 'human' }]);
  };

  const handleToggleLarsInMp = () => {
    const hasLars = mpPlayers.some((p) => p.isLars);
    if (hasLars) {
      if (mpPlayers.length <= 2) return;
      setMpPlayers(mpPlayers.filter((p) => !p.isLars));
    } else if (mpPlayers.length < 4) {
      setMpPlayers([...mpPlayers, { name: 'Lars', type: 'ai', isLars: true }]);
    }
  };

  const handleRemovePlayer = (index: number) => {
    if (mpPlayers.length <= 2) return;
    setMpPlayers(mpPlayers.filter((_, i) => i !== index));
  };

  const handleNameChange = (index: number, value: string) => {
    setMpPlayers(
      mpPlayers.map((p, i) => (i === index ? { ...p, name: value } : p))
    );
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'vs_lars') {
      const cleanName = soloPlayerName.trim() || 'Dig';
      const players = larsGoesFirst
        ? [
            { name: 'Lars', type: 'ai' as const, isLars: true },
            { name: cleanName, type: 'human' as const },
          ]
        : [
            { name: cleanName, type: 'human' as const },
            { name: 'Lars', type: 'ai' as const, isLars: true },
          ];
      onStartNewGame({ mode: 'vs_lars', aiDifficulty, players });
    } else {
      const cleaned = mpPlayers.map((p, i) => ({
        ...p,
        name: p.name.trim() || `Spiller ${i + 1}`,
      }));
      onStartNewGame({ mode: 'local_multiplayer', aiDifficulty, players: cleaned });
    }
  };

  const hasLarsInMp = mpPlayers.some((p) => p.isLars);

  return (
    <div className="min-h-[100dvh] board-felt flex flex-col justify-between px-4 py-4 sm:px-8 sm:py-6">
      {/* Compact Game Shell Utility Strip */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenRules}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#13335e] text-slate-800 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-amber-500" />
            Spilleregler
          </button>
          <button
            type="button"
            onClick={onOpenHighscores}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#13335e] text-slate-800 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <Award className="w-4 h-4 text-sky-500" />
            Highscore
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#13335e] text-slate-800 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            <History className="w-4 h-4 text-emerald-500" />
            Historik{historyCount > 0 ? ` (${historyCount})` : ''}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Slå lyd til' : 'Slå lyd fra'}
            title={isMuted ? 'Slå lyd til' : 'Slå lyd fra'}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#13335e] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Skift til lyst tema' : 'Skift til mørkt tema'}
            title={theme === 'dark' ? 'Skift til lyst tema' : 'Skift til mørkt tema'}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#13335e] text-slate-700 dark:text-sky-100 border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Centerpiece: Lars Host + Game Setup */}
      <main className="w-full max-w-5xl mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-8 items-center">
        {/* Left: Bespoke SVG Title Lockup & Lars Host Portrait */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
          <div className="relative">
            <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-3xl overflow-hidden border-2 border-amber-400/70 shadow-[0_20px_50px_rgba(2,12,27,0.45)] bg-[#0d2749]">
              <img
                src="/assets/aistudio/lars_47c49d6d.png"
                alt="Lars — vært for LARS:10000"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
            </div>
            {/* Decorative mini die badge anchored cleanly */}
            <div
              aria-hidden="true"
              className="absolute -bottom-3 -right-3 w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-lg flex items-center justify-center rotate-6"
            >
              <svg viewBox="0 0 100 100" className="w-9 h-9">
                <circle cx="28" cy="28" r="9" fill="#0f172a" />
                <circle cx="72" cy="28" r="9" fill="#0f172a" />
                <circle cx="50" cy="50" r="10" fill="#dc2626" />
                <circle cx="28" cy="72" r="9" fill="#0f172a" />
                <circle cx="72" cy="72" r="9" fill="#0f172a" />
              </svg>
            </div>
          </div>

          <div className="space-y-3 max-w-md">
            {/* Custom SVG Title Lockup */}
            <svg
              viewBox="0 0 360 64"
              className="w-72 sm:w-80 h-auto mx-auto lg:mx-0"
              role="img"
              aria-label="LARS:10000"
            >
              <text
                x="0"
                y="49"
                fill="currentColor"
                className="text-slate-900 dark:text-white font-display"
                style={{ fontWeight: 800, fontSize: '48px', letterSpacing: '-0.03em' }}
              >
                LARS
              </text>
              <text
                x="128"
                y="49"
                fill="#f59e0b"
                className="font-display"
                style={{ fontWeight: 800, fontSize: '48px' }}
              >
                :
              </text>
              <text
                x="148"
                y="49"
                fill="currentColor"
                className="text-sky-600 dark:text-sky-400 font-mono"
                style={{ fontWeight: 700, fontSize: '46px', letterSpacing: '-0.04em' }}
              >
                10000
              </text>
            </svg>

            <p className="text-sm sm:text-base text-slate-600 dark:text-sky-100/80 leading-relaxed text-balance">
              Det taktiske terningespil med officielle særregler: åbning på 1.000, fordobling på 3 ens, Cameron og tre nul-ture med strafpoint.
            </p>
          </div>
        </div>

        {/* Right: Mode Selection & Saved Game Card */}
        <div className="space-y-4">
          {savedGame && (
            <div className="p-4 rounded-2xl bg-white/95 dark:bg-[#0d2749]/95 border border-amber-400/70 shadow-lg flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Gemt spil fundet · Runde {savedGame.turn.roundNumber}
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {savedGame.players.map((p) => `${p.name} (${p.totalScore.toLocaleString('da-DK')})`).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onResumeGame}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Fortsæt spil
                </button>
                <button
                  type="button"
                  onClick={onDiscardSavedGame}
                  aria-label="Slet gemt spil"
                  title="Slet gemt spil"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-600 dark:text-sky-200/70 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-sky-900/50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <form
            onSubmit={handleStart}
            className="p-6 rounded-2xl bg-white/95 dark:bg-[#0d2749]/95 border border-slate-200/90 dark:border-sky-800/60 shadow-xl space-y-5"
          >
            {/* Mode Segmented Selector */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#081b34]">
              <button
                type="button"
                onClick={() => setMode('vs_lars')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'vs_lars'
                    ? 'bg-white dark:bg-[#163d70] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-sky-200/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span>Mod Lars</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('local_multiplayer')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'local_multiplayer'
                    ? 'bg-white dark:bg-[#163d70] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-sky-200/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Samme skærm</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('online_multiplayer')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'online_multiplayer'
                    ? 'bg-white dark:bg-[#163d70] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-sky-200/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Telefoner</span>
              </button>
            </div>

            {mode === 'vs_lars' ? (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="solo-player-name"
                    className="block text-xs font-semibold text-slate-600 dark:text-sky-100/80 mb-1.5"
                  >
                    Dit spillernavn
                  </label>
                  <input
                    id="solo-player-name"
                    type="text"
                    maxLength={18}
                    value={soloPlayerName}
                    onChange={(e) => setSoloPlayerName(e.target.value)}
                    placeholder="Indtast dit navn"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium bg-slate-50 dark:bg-[#081b34] border border-slate-200 dark:border-sky-800/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-600 dark:text-sky-100/80 mb-1.5">
                    Lars' spillestil (AI)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'afslappet', label: 'Afslappet' },
                        { id: 'taktisk', label: 'Taktisk' },
                        { id: 'mester', label: 'Mester' },
                      ] as const
                    ).map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setAiDifficulty(lvl.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                          aiDifficulty === lvl.id
                            ? 'bg-sky-500/15 border-sky-500 text-sky-700 dark:text-sky-300'
                            : 'bg-slate-50 dark:bg-[#081b34] border-slate-200 dark:border-sky-800/60 text-slate-600 dark:text-sky-200/75 hover:border-slate-300 dark:hover:border-sky-700'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2.5">
                    <LarsAvatar sizeClass="w-8 h-8" />
                    <span className="text-xs text-slate-600 dark:text-sky-100/80">
                      {larsGoesFirst ? 'Lars starter (du har sidste tur)' : 'Du starter (Lars har sidste tur)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLarsGoesFirst((v) => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#13335e] dark:hover:bg-[#194378] text-slate-700 dark:text-sky-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Byt rækkefølge
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-display font-bold text-base bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start spil
                </button>
              </div>
            ) : mode === 'local_multiplayer' ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-sky-100/80">
                      Spillere ({mpPlayers.length}/4) · Samme enhed
                    </span>
                    <div className="flex items-center gap-2">
                      {mpPlayers.length < 4 && (
                        <button
                          type="button"
                          onClick={handleAddPlayer}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#13335e] dark:hover:bg-[#194378] text-slate-700 dark:text-sky-100 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Tilføj ven
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleToggleLarsInMp}
                        disabled={!hasLarsInMp && mpPlayers.length >= 4}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                          hasLarsInMp
                            ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#13335e] dark:hover:bg-[#194378] text-slate-700 dark:text-sky-100'
                        }`}
                      >
                        {hasLarsInMp ? 'Fjern Lars' : '+ Tilføj Lars'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {mpPlayers.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400 w-4">{idx + 1}.</span>
                        {p.isLars ? (
                          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sm font-semibold text-sky-800 dark:text-sky-200">
                            <LarsAvatar sizeClass="w-6 h-6" />
                            <span>Lars (AI · {aiDifficulty})</span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            maxLength={18}
                            value={p.name}
                            onChange={(e) => handleNameChange(idx, e.target.value)}
                            placeholder={`Spiller ${idx + 1}`}
                            className="flex-1 px-3 py-2 rounded-xl text-sm font-medium bg-slate-50 dark:bg-[#081b34] border border-slate-200 dark:border-sky-800/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        )}
                        {mpPlayers.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePlayer(idx)}
                            aria-label={`Fjern ${p.name}`}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-sky-900/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-display font-bold text-base bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start spil
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="online-player-name"
                    className="block text-xs font-semibold text-slate-600 dark:text-sky-100/80 mb-1.5"
                  >
                    Dit spillernavn (på denne telefon)
                  </label>
                  <input
                    id="online-player-name"
                    type="text"
                    maxLength={18}
                    value={onlineName}
                    onChange={(e) => setOnlineName(e.target.value)}
                    placeholder="F.eks. Mikkel eller Mette"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium bg-slate-50 dark:bg-[#081b34] border border-slate-200 dark:border-sky-800/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {onlineError && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-medium">
                    {onlineError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!isSocketConnected}
                  onClick={() =>
                    onCreateOnlineRoom(onlineName.trim() || 'Spiller 1')
                  }
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-display font-bold text-base bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Plus className="w-5 h-5" />
                  Opret nyt spillerum
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-slate-200 dark:border-sky-800/60" />
                  <span className="px-3 text-xs font-medium text-slate-400 dark:text-sky-200/60">
                    eller deltag med rumkode
                  </span>
                  <div className="flex-grow border-t border-slate-200 dark:border-sky-800/60" />
                </div>

                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Rumkode (f.eks. 4829)"
                    aria-label="Indtast rumkode"
                    className="flex-1 px-3.5 py-2.5 rounded-xl text-sm font-mono font-bold tracking-widest bg-slate-50 dark:bg-[#081b34] border border-slate-200 dark:border-sky-800/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <button
                    type="button"
                    disabled={!isSocketConnected || joinCode.trim().length < 4}
                    onClick={() =>
                      onJoinOnlineRoom(
                        joinCode.trim(),
                        onlineName.trim() || 'Spiller 2'
                      )
                    }
                    className="px-5 py-2.5 rounded-xl font-display font-bold text-sm bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    Deltag
                  </button>
                </div>

                {!isSocketConnected && (
                  <p className="text-[11px] text-center text-amber-600 dark:text-amber-300">
                    Forbinder til spilserveren...
                  </p>
                )}
              </div>
            )}
          </form>
        </div>
      </main>

      {/* Single flat control-hint line */}
      <footer className="w-full max-w-6xl mx-auto text-center text-xs text-slate-500 dark:text-sky-200/60">
        Klik terninger for at vælge · Mellemrum: Kast · Enter: Gem point
      </footer>
    </div>
  );
}
