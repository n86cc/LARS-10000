import type {
  AIDifficulty,
  OnlineLobbyPlayer,
  OnlineRoomSnapshot,
  SoundCue,
} from '../types/game.ts';
import {
  createGameFromPlayers,
  performBank,
  performLockSelected,
  performRoll,
  performSelectBest,
  performToggleDie,
  performZeroTurn,
} from '../engine/gameTransitions.ts';
import { decideAIMove } from '../engine/ai.ts';


/** Transport-neutral socket: Node `ws` and Cloudflare WebSocket both fit. */
export interface Sock {
  send(data: string): void;
}

interface ServerRoom {
  roomCode: string;
  hostClientId: string;
  status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  aiDifficulty: AIDifficulty;
  includeLars: boolean;
  lobbyPlayers: OnlineLobbyPlayer[];
  game: ReturnType<typeof createGameFromPlayers> | null;
  clients: Map<string, Sock>;
  timerId: ReturnType<typeof setTimeout> | null;
  lastActivity: number;
}

export const rooms = new Map<string, ServerRoom>();
const socketMeta = new Map<Sock, { clientId: string; roomCode: string | null }>();

function generateRoomCode(): string {
  for (let i = 0; i < 40; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(code)) return code;
  }
  return String(Math.floor(10000 + Math.random() * 90000));
}

function toSnapshot(room: ServerRoom): OnlineRoomSnapshot {
  return {
    roomCode: room.roomCode,
    hostClientId: room.hostClientId,
    status: room.status,
    aiDifficulty: room.aiDifficulty,
    includeLars: room.includeLars,
    lobbyPlayers: room.lobbyPlayers,
    game: room.game,
  };
}

function sendJson(ws: Sock, payload: unknown) {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    /* socket already closed */
  }
}

function broadcastRoom(room: ServerRoom, sound: SoundCue | null = null) {
  room.lastActivity = Date.now();
  const payload = {
    type: 'room:state',
    room: toSnapshot(room),
    sound,
  };
  for (const ws of room.clients.values()) {
    sendJson(ws, payload);
  }
}

function clearRoomTimer(room: ServerRoom) {
  if (room.timerId) {
    clearTimeout(room.timerId);
    room.timerId = null;
  }
}

function scheduleRoomAutomation(room: ServerRoom) {
  clearRoomTimer(room);
  if (room.status !== 'PLAYING' || !room.game) return;

  const game = room.game;
  const activePlayer = game.players[game.turn.playerIndex];

  if (game.turn.subPhase === 'FARKLE_PAUSE') {
    room.timerId = setTimeout(() => {
      if (!room.game || room.status !== 'PLAYING') return;
      const res = performZeroTurn(room.game);
      room.game = res.game;
      if (res.gameOver) {
        room.status = 'GAME_OVER';
      }
      broadcastRoom(room, res.sound);
      scheduleRoomAutomation(room);
    }, 1500);
    return;
  }

  if (activePlayer.type === 'ai') {
    const { turn } = game;
    if (turn.subPhase === 'AWAITING_ROLL' || turn.subPhase === 'HOT_DICE_CHOICE') {
      room.timerId = setTimeout(() => {
        if (!room.game || room.status !== 'PLAYING') return;
        const res = performRoll(room.game);
        room.game = res.game;
        broadcastRoom(room, res.sound);
        scheduleRoomAutomation(room);
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
        allPlayers: game.players,
        finalRoundTriggered: game.finalRoundTriggered,
        difficulty: game.aiDifficulty,
      });

      if (!decision) return;

      if (selected.length === 0) {
        room.timerId = setTimeout(() => {
          if (!room.game || room.status !== 'PLAYING') return;
          const chosenSet = new Set(decision.diceIdsToLock);
          room.game = {
            ...room.game,
            turn: {
              ...room.game.turn,
              dice: room.game.turn.dice.map((d) =>
                chosenSet.has(d.id) ? { ...d, status: 'selected' } : d
              ),
              statusMessage: decision.thoughtText,
            },
          };
          broadcastRoom(room, 'select');
          scheduleRoomAutomation(room);
        }, 650);
      } else {
        room.timerId = setTimeout(() => {
          if (!room.game || room.status !== 'PLAYING') return;
          if (decision.shouldBankAfterLock) {
            const res = performBank(room.game);
            room.game = res.game;
            if (res.gameOver) {
              room.status = 'GAME_OVER';
            }
            broadcastRoom(room, res.sound);
          } else {
            const res = performRoll(room.game);
            room.game = res.game;
            broadcastRoom(room, res.sound);
          }
          scheduleRoomAutomation(room);
        }, 720);
      }
    }
  }
}

function detachClientFromCurrentRoom(ws: Sock, removeFromLobby: boolean) {
  const meta = socketMeta.get(ws);
  if (!meta || !meta.roomCode) return;

  const room = rooms.get(meta.roomCode);
  meta.roomCode = null;
  if (!room) return;

  if (room.clients.get(meta.clientId) === ws) {
    room.clients.delete(meta.clientId);
  }

  if (room.status === 'LOBBY' && removeFromLobby) {
    room.lobbyPlayers = room.lobbyPlayers.filter((p) => p.clientId !== meta.clientId);
    if (room.hostClientId === meta.clientId && room.lobbyPlayers.length > 0) {
      room.hostClientId = room.lobbyPlayers[0].clientId;
      room.lobbyPlayers[0].isHost = true;
    }
  } else {
    room.lobbyPlayers = room.lobbyPlayers.map((p) =>
      p.clientId === meta.clientId ? { ...p, connected: false } : p
    );
    if (room.game) {
      room.game = {
        ...room.game,
        players: room.game.players.map((p) =>
          p.clientId === meta.clientId ? { ...p, connected: false } : p
        ),
      };
    }
  }

  if (room.lobbyPlayers.length === 0 && room.clients.size === 0) {
    clearRoomTimer(room);
    rooms.delete(room.roomCode);
    return;
  }

  broadcastRoom(room);
}

// Cleanup stale rooms every 30 minutes
export function cleanupStaleRooms() {
  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.clients.size === 0 && room.lastActivity < cutoff) {
      clearRoomTimer(room);
      rooms.delete(code);
    }
  }
}

export function handleMessage(ws: Sock, raw: string) {
  try {
    const msg = JSON.parse(raw);
    const clientId = typeof msg.clientId === 'string' ? msg.clientId : '';
    if (!clientId) return;

    const existingMeta = socketMeta.get(ws);
    if (!existingMeta) {
      socketMeta.set(ws, { clientId, roomCode: null });
    }

    if (msg.type === 'room:create') {
      detachClientFromCurrentRoom(ws, true);
      const cleanName = String(msg.playerName || 'Spiller 1').trim().slice(0, 18) || 'Spiller 1';
      const roomCode = generateRoomCode();
      const room: ServerRoom = {
        roomCode,
        hostClientId: clientId,
        status: 'LOBBY',
        aiDifficulty: 'taktisk',
        includeLars: false,
        lobbyPlayers: [
          { clientId, name: cleanName, connected: true, isHost: true },
        ],
        game: null,
        clients: new Map([[clientId, ws]]),
        timerId: null,
        lastActivity: Date.now(),
      };
      rooms.set(roomCode, room);
      socketMeta.set(ws, { clientId, roomCode });
      broadcastRoom(room);
      return;
    }

    if (msg.type === 'room:join') {
      const roomCode = String(msg.roomCode || '').trim();
      const room = rooms.get(roomCode);
      if (!room) {
        sendJson(ws, {
          type: 'room:error',
          message: `Rummet "${roomCode}" blev ikke fundet. Tjek koden og prøv igen.`,
        });
        return;
      }

      const currentMeta = socketMeta.get(ws);
      if (currentMeta?.roomCode && currentMeta.roomCode !== roomCode) {
        detachClientFromCurrentRoom(ws, true);
      }

      const cleanName =
        String(msg.playerName || '').trim().slice(0, 18) ||
        `Spiller ${room.lobbyPlayers.length + 1}`;

      const existingLobbyPlayer = room.lobbyPlayers.find(
        (p) => p.clientId === clientId
      );

      if (!existingLobbyPlayer && room.status !== 'LOBBY') {
        sendJson(ws, {
          type: 'room:error',
          message: 'Spillet i dette rum er allerede i gang.',
        });
        return;
      }

      const maxHumans = room.includeLars ? 3 : 4;
      if (!existingLobbyPlayer && room.lobbyPlayers.length >= maxHumans) {
        sendJson(ws, {
          type: 'room:error',
          message: 'Rummet er fyldt (maks. 4 spillere).',
        });
        return;
      }

      if (existingLobbyPlayer) {
        existingLobbyPlayer.connected = true;
        if (msg.playerName && room.status === 'LOBBY') {
          existingLobbyPlayer.name = cleanName;
        }
      } else {
        room.lobbyPlayers.push({
          clientId,
          name: cleanName,
          connected: true,
          isHost: room.hostClientId === clientId,
        });
      }

      if (room.game) {
        room.game = {
          ...room.game,
          players: room.game.players.map((p) =>
            p.clientId === clientId ? { ...p, connected: true } : p
          ),
        };
      }

      room.clients.set(clientId, ws);
      socketMeta.set(ws, { clientId, roomCode });
      broadcastRoom(room);
      return;
    }

    const meta = socketMeta.get(ws);
    if (!meta?.roomCode) return;
    const room = rooms.get(meta.roomCode);
    if (!room) return;

    if (msg.type === 'room:leave') {
      detachClientFromCurrentRoom(ws, true);
      sendJson(ws, { type: 'room:left' });
      return;
    }

    if (msg.type === 'room:config') {
      if (room.hostClientId !== clientId || room.status !== 'LOBBY') return;
      if (typeof msg.includeLars === 'boolean') {
        if (msg.includeLars && room.lobbyPlayers.length <= 3) {
          room.includeLars = true;
        } else if (!msg.includeLars) {
          room.includeLars = false;
        }
      }
      if (
        msg.aiDifficulty === 'afslappet' ||
        msg.aiDifficulty === 'taktisk' ||
        msg.aiDifficulty === 'mester'
      ) {
        room.aiDifficulty = msg.aiDifficulty;
      }
      broadcastRoom(room);
      return;
    }

    if (msg.type === 'room:start') {
      if (room.hostClientId !== clientId) return;
      const totalCount = room.lobbyPlayers.length + (room.includeLars ? 1 : 0);
      if (totalCount < 2) {
        sendJson(ws, {
          type: 'room:error',
          message: 'Der skal være mindst 2 spillere (eller Lars) for at starte.',
        });
        return;
      }

      const playersList: Array<{
        name: string;
        type: 'human' | 'ai';
        isLars?: boolean;
        clientId?: string;
        connected?: boolean;
      }> = room.lobbyPlayers.map((p) => ({
        name: p.name,
        type: 'human',
        clientId: p.clientId,
        connected: p.connected,
      }));
      if (room.includeLars) {
        playersList.push({
          name: 'Lars',
          type: 'ai',
          isLars: true,
          connected: true,
        });
      }

      room.game = createGameFromPlayers({
        mode: 'online_multiplayer',
        aiDifficulty: room.aiDifficulty,
        roomCode: room.roomCode,
        players: playersList,
      });
      room.status = 'PLAYING';
      broadcastRoom(room);
      scheduleRoomAutomation(room);
      return;
    }

    if (msg.type === 'room:return_lobby') {
      if (room.hostClientId !== clientId) return;
      clearRoomTimer(room);
      room.status = 'LOBBY';
      room.game = null;
      broadcastRoom(room);
      return;
    }

    if (msg.type === 'game:action') {
      if (room.status !== 'PLAYING' || !room.game) return;
      const activePlayer = room.game.players[room.game.turn.playerIndex];
      if (activePlayer.type !== 'human' || activePlayer.clientId !== clientId) {
        return;
      }

      let sound: SoundCue | null = null;
      let gameOver = false;

      if (msg.action === 'toggle_die' && typeof msg.dieId === 'number') {
        const res = performToggleDie(room.game, msg.dieId);
        room.game = res.game;
        sound = res.sound;
      } else if (msg.action === 'select_best') {
        const res = performSelectBest(room.game);
        room.game = res.game;
        sound = res.sound;
      } else if (msg.action === 'lock_selected') {
        const res = performLockSelected(room.game);
        room.game = res.game;
        sound = res.sound;
      } else if (msg.action === 'roll') {
        const res = performRoll(room.game);
        room.game = res.game;
        sound = res.sound;
      } else if (msg.action === 'bank') {
        const res = performBank(room.game);
        room.game = res.game;
        gameOver = res.gameOver;
        sound = res.sound;
      } else {
        return;
      }

      if (gameOver) {
        room.status = 'GAME_OVER';
      }

      broadcastRoom(room, sound);
      scheduleRoomAutomation(room);
    }
  } catch (err) {
    console.error('WebSocket message error:', err);
  }
}

export function handleClose(ws: Sock) {
  detachClientFromCurrentRoom(ws, false);
  socketMeta.delete(ws);
}
