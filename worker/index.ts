import { DurableObject } from 'cloudflare:workers';
import { cleanupStaleRooms, handleClose, handleMessage, rooms, type Sock } from '../src/server/rooms.ts';

interface Env {
  ASSETS: Fetcher;
  LOBBY: DurableObjectNamespace<Lobby>;
}

/**
 * One instance owns every room, exactly like the single Node process did.
 * Plain (non-hibernating) sockets keep it alive while anyone is connected,
 * so the AI/farkle setTimeout automation in rooms.ts works unchanged.
 */
export class Lobby extends DurableObject<Env> {
  private sweeper: ReturnType<typeof setInterval> | null = null;

  async fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname === '/api/health') {
      return Response.json({ ok: true, rooms: rooms.size });
    }
    if (req.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    const sock: Sock = server;
    // Keep idle connections from being dropped; the client ignores unknown types.
    const ping = setInterval(() => {
      try {
        server.send('{"type":"ping"}');
      } catch {
        clearInterval(ping);
      }
    }, 25_000);
    this.sweeper ??= setInterval(cleanupStaleRooms, 30 * 60 * 1000);

    server.addEventListener('message', (e) => {
      if (typeof e.data === 'string') handleMessage(sock, e.data);
    });
    const close = () => {
      clearInterval(ping);
      handleClose(sock);
    };
    server.addEventListener('close', close);
    server.addEventListener('error', close);
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === '/ws' || pathname === '/api/health') {
      return env.LOBBY.get(env.LOBBY.idFromName('lobby')).fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
