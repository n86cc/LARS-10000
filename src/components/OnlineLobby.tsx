import { useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Play,
  Share2,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { AIDifficulty, OnlineRoomSnapshot } from '../types/game';
import { AVATAR_COLORS } from '../engine/gameTransitions';
import { LarsAvatar, PlayerAvatar } from './LarsAvatar';

interface OnlineLobbyProps {
  room: OnlineRoomSnapshot;
  localClientId: string;
  isConnected: boolean;
  errorMessage: string | null;
  onUpdateConfig: (config: { includeLars?: boolean; aiDifficulty?: AIDifficulty }) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export function OnlineLobby({
  room,
  localClientId,
  isConnected,
  errorMessage,
  onUpdateConfig,
  onStartGame,
  onLeaveRoom,
}: OnlineLobbyProps) {
  const [copied, setCopied] = useState(false);

  const isHost = room.hostClientId === localClientId;
  const totalPlayers = room.lobbyPlayers.length + (room.includeLars ? 1 : 0);
  const canStart = isHost && totalPlayers >= 2 && isConnected;

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${room.roomCode}`
      : `?room=${room.roomCode}`;

  const handleCopyInvite = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'LARS:10000 — Spil med!',
          text: `Deltag i mit LARS:10000 rum med kode ${room.roomCode}`,
          url: inviteUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyInvite();
    }
  };

  return (
    <div className="min-h-[100dvh] board-felt flex flex-col justify-between px-4 py-5 sm:px-8 sm:py-6">
      {/* Top Bar */}
      <div className="w-full max-w-3xl mx-auto flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onLeaveRoom}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/85 dark:bg-[#0d2749]/90 hover:bg-white dark:hover:bg-[#13335e] text-slate-800 dark:text-white border border-slate-200/80 dark:border-sky-700/50 shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Forlad rum
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Wifi className="w-4 h-4" />
              Forbundet
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <WifiOff className="w-4 h-4" />
              Genopretter forbindelse...
            </span>
          )}
        </div>
      </div>

      {/* Center Lobby Card */}
      <main className="w-full max-w-2xl mx-auto my-auto py-6">
        <div className="p-6 sm:p-8 rounded-2xl bg-white/95 dark:bg-[#0d2749]/95 border border-slate-200 dark:border-sky-800/60 shadow-2xl space-y-6">
          {/* Room Code Header */}
          <div className="text-center space-y-2 pb-5 border-b border-slate-200 dark:border-sky-800/50">
            <p className="text-xs font-semibold tracking-wide text-sky-600 dark:text-sky-300">
              Online Spillerum · Del koden med din ven
            </p>
            <div className="font-mono tabular-nums text-4xl sm:text-5xl font-extrabold tracking-[0.2em] text-slate-900 dark:text-white">
              {room.roomCode}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCopyInvite}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#143763] dark:hover:bg-[#194378] text-slate-800 dark:text-white transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Link kopieret!' : 'Kopiér invitationslink'}
              </button>
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Del med telefon
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-medium text-center">
              {errorMessage}
            </div>
          )}

          {/* Connected Players List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-sky-200/80">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Spillere i rummet ({totalPlayers}/4)
              </span>
              <span>Turrækkefølge</span>
            </div>

            <div className="space-y-2">
              {room.lobbyPlayers.map((p, idx) => {
                const isMe = p.clientId === localClientId;
                return (
                  <div
                    key={p.clientId}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#081b34] border border-slate-200/80 dark:border-sky-800/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-slate-400 w-4">
                        {idx + 1}.
                      </span>
                      <PlayerAvatar
                        name={p.name}
                        avatarColor={AVATAR_COLORS[idx % AVATAR_COLORS.length]}
                        sizeClass="w-9 h-9"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {p.name}
                          {isMe && (
                            <span className="ml-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">
                              (Dig)
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-sky-200/70">
                          {p.isHost ? 'Vært' : 'Gæst'} ·{' '}
                          {p.connected ? 'Forbundet' : 'Afbrudt'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {room.includeLars && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/30">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400 w-4">
                      {room.lobbyPlayers.length + 1}.
                    </span>
                    <LarsAvatar sizeClass="w-9 h-9" />
                    <div>
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">
                        Lars (AI)
                      </p>
                      <p className="text-[11px] text-sky-700 dark:text-sky-300">
                        Sværhedsgrad: {room.aiDifficulty}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Host Controls */}
          {isHost ? (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-sky-800/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ includeLars: !room.includeLars })}
                  disabled={!room.includeLars && room.lobbyPlayers.length >= 4}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-40 ${
                    room.includeLars
                      ? 'bg-sky-500/15 border-sky-500 text-sky-700 dark:text-sky-300'
                      : 'bg-slate-50 dark:bg-[#081b34] border-slate-200 dark:border-sky-800/60 text-slate-700 dark:text-sky-100'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  {room.includeLars ? 'Fjern Lars (AI)' : '+ Tilføj Lars (AI)'}
                </button>

                {room.includeLars && (
                  <div className="flex items-center gap-1.5">
                    {(['afslappet', 'taktisk', 'mester'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onUpdateConfig({ aiDifficulty: lvl })}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                          room.aiDifficulty === lvl
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-100 dark:bg-[#13335e] text-slate-600 dark:text-sky-200/80'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onStartGame}
                disabled={!canStart}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-display font-bold text-base bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-5 h-5 fill-current" />
                {totalPlayers < 2
                  ? 'Venter på mindst 1 spiller mere...'
                  : 'Start online spil'}
              </button>
            </div>
          ) : (
            <div className="py-3 text-center text-sm font-medium text-slate-600 dark:text-sky-200/80 border-t border-slate-200 dark:border-sky-800/50">
              Venter på at værten starter spillet...
            </div>
          )}
        </div>
      </main>

      <footer className="w-full max-w-3xl mx-auto text-center text-xs text-slate-500 dark:text-sky-200/60">
        Åbn samme link på den anden telefon og tast rumkoden ind for at spille live
      </footer>
    </div>
  );
}
