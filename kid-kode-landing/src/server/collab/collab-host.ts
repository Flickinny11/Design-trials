// PRISM SHELL — COLLABROOM WEBSOCKET HOST (SHELL W7, deviation W7-D1)
//
// The LOCAL host that stands the CollabRoom core up over a real WebSocket so
// the channel is verifiable under `next dev`. It is the single Decision-E
// exception to the SSE-only law (I1): it carries presence + co-editing ops
// ONLY, on its own port, and never touches the tRPC/SSE transport.
//
// Every connection is gated server-side BEFORE the socket is accepted:
//   1. Better Auth session resolved from the cookie (auth-bridge) — else 401.
//   2. resolveProjectAccess(user, projectId) — the audited cross-tenant seam.
//   3. The owning org must be ENTERPRISE tier and the role must permit
//      `collaborate` (capabilitiesFor) — else 403. This is where
//      "non-enterprise tenants see no multiplayer surface" is enforced at the
//      transport, not merely hidden in the UI.
//
// Identity is server-authoritative: the host stamps every inbound presence/op
// with the CONNECTION's resolved userId, so a client cannot impersonate
// another actor by claiming a different actorId.
//
// In production a Cloudflare Durable Object replaces this file 1:1 (same
// CollabRoom core; `state.acceptWebSocket()` for hibernation). Documented seam.

import { createHash, randomUUID } from 'node:crypto';
import http from 'node:http';
import type { Duplex } from 'node:stream';
import {
  PRISM_COLLAB_CONTRACT_VERSION,
  collabClientMessageSchema,
  roomEventEnvelopeSchema,
  type CollabActor,
  type RoomEvent,
} from '../../../packages/shared-interfaces/src/prism-collab';
import { capabilitiesFor } from '../../../packages/shared-interfaces/src/prism-sharing';
import { resolveSessionUser } from './auth-bridge';
import { CollabRoom } from './collab-room';
import { orgPlanTier, resolveProjectAccess } from '../tenancy/org-store';
import {
  FrameDecoder,
  acceptKey,
  encodeClose,
  encodePing,
  encodePong,
  encodeText,
} from './ws-frame';

const DEFAULT_PORT = Number(process.env.PRISM_COLLAB_PORT ?? 4790);
const IDLE_EVICT_MS = 30_000;
const PING_MS = 25_000;

interface Conn {
  id: string;
  socket: Duplex;
  actor: CollabActor;
  projectId: string;
  decoder: FrameDecoder;
  alive: boolean;
}

interface Room {
  room: CollabRoom;
  conns: Set<Conn>;
  evictTimer: NodeJS.Timeout | null;
}

/** Deterministic non-negative color seed from a stable id (presence tinting). */
function colorSeed(id: string): number {
  const h = createHash('sha1').update(id).digest();
  return h.readUInt32BE(0);
}

export interface CollabHostHandle {
  port: number;
  close: () => Promise<void>;
  /** Live room/connection counts (verification introspection). */
  stats: () => { rooms: number; connections: number };
}

export function startCollabHost(
  opts: { port?: number } = {},
): Promise<CollabHostHandle> {
  const port = opts.port ?? DEFAULT_PORT;
  const rooms = new Map<string, Room>();

  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('prism-collab ok');
      return;
    }
    res.writeHead(426, { 'content-type': 'text/plain' });
    res.end('Upgrade Required');
  });

  function getRoom(projectId: string): Room {
    let r = rooms.get(projectId);
    if (!r) {
      r = { room: new CollabRoom(projectId), conns: new Set(), evictTimer: null };
      rooms.set(projectId, r);
    }
    if (r.evictTimer) {
      clearTimeout(r.evictTimer);
      r.evictTimer = null;
    }
    return r;
  }

  function send(conn: Conn, roomId: string, event: RoomEvent): void {
    const envelope = {
      v: PRISM_COLLAB_CONTRACT_VERSION,
      kind: 'prism-room-event' as const,
      roomId,
      ts: Date.now(),
      event,
    };
    try {
      roomEventEnvelopeSchema.parse(envelope);
      conn.socket.write(encodeText(JSON.stringify(envelope)));
    } catch {
      /* malformed event never leaves the host */
    }
  }

  function broadcast(
    r: Room,
    roomId: string,
    events: RoomEvent[],
    opts2: { exclude?: Conn } = {},
  ): void {
    for (const event of events) {
      for (const c of r.conns) {
        if (opts2.exclude && c === opts2.exclude) continue;
        send(c, roomId, event);
      }
    }
  }

  function dropConn(conn: Conn): void {
    const r = rooms.get(conn.projectId);
    if (!r || !r.conns.has(conn)) return;
    r.conns.delete(conn);
    const events = r.room.leave(conn.actor.actorId);
    broadcast(r, conn.projectId, events);
    if (r.conns.size === 0) {
      // Emulate DO hibernation: evict the empty room after an idle window.
      r.evictTimer = setTimeout(() => {
        if (r.conns.size === 0) rooms.delete(conn.projectId);
      }, IDLE_EVICT_MS);
    }
  }

  function onMessage(conn: Conn, text: string): void {
    let parsed;
    try {
      parsed = collabClientMessageSchema.safeParse(JSON.parse(text));
    } catch {
      return;
    }
    if (!parsed.success) return;
    const msg = parsed.data;
    const r = rooms.get(conn.projectId);
    if (!r) return;
    const roomId = conn.projectId;
    const actorId = conn.actor.actorId;

    switch (msg.kind) {
      case 'hello': {
        r.room.ensureActor(conn.actor);
        // Reply with the full room snapshot to THIS connection only.
        send(conn, roomId, r.room.snapshot());
        if (msg.presence) {
          const presence = { ...msg.presence, actor: conn.actor };
          broadcast(r, roomId, [r.room.applyPresence(presence)]);
        } else {
          // Announce arrival even without a cursor yet.
          broadcast(
            r,
            roomId,
            [r.room.applyPresence({ actor: conn.actor, selection: [], updatedAt: Date.now() })],
            { exclude: conn },
          );
        }
        break;
      }
      case 'presence': {
        // Server-authoritative identity: override the claimed actor.
        const presence = { ...msg.presence, actor: conn.actor };
        broadcast(r, roomId, [r.room.applyPresence(presence)]);
        break;
      }
      case 'op': {
        const op = { ...msg.op, actor: actorId };
        broadcast(r, roomId, [r.room.commitOp(op)]);
        break;
      }
      case 'lock': {
        const ev = msg.acquire
          ? r.room.acquireLock(msg.nodeId, actorId, Date.now())
          : r.room.releaseLock(msg.nodeId, actorId);
        if (ev) broadcast(r, roomId, [ev]);
        break;
      }
      case 'undo': {
        const ev = r.room.undo(actorId);
        if (ev) broadcast(r, roomId, [ev]);
        break;
      }
    }
  }

  function reject(socket: Duplex, status: number, reason: string): void {
    try {
      socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
    } catch {
      /* ignore */
    }
    socket.destroy();
  }

  server.on('upgrade', (req, socket: Duplex, _head) => {
    void handleUpgrade(req, socket);
  });

  async function handleUpgrade(
    req: http.IncomingMessage,
    socket: Duplex,
  ): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const match = url.pathname.match(/^\/collab\/([^/]+)$/);
    if (!match) return reject(socket, 404, 'Not Found');
    const projectId = decodeURIComponent(match[1]);

    const wsKey = req.headers['sec-websocket-key'];
    if (typeof wsKey !== 'string') return reject(socket, 400, 'Bad Request');

    // 1. Session.
    const user = resolveSessionUser(req.headers.cookie);
    if (!user) return reject(socket, 401, 'Unauthorized');

    // 2. Audited access + 3. enterprise/collaborate gate.
    let access;
    try {
      access = await resolveProjectAccess(user.id, projectId);
    } catch {
      return reject(socket, 500, 'Server Error');
    }
    if (access.role === 'none' || !access.orgId) {
      return reject(socket, 403, 'Forbidden');
    }
    const tier = await orgPlanTier(access.orgId).catch(() => null);
    const enterprise = tier === 'enterprise';
    const caps = capabilitiesFor(access.role, enterprise);
    if (!caps.collaborate) return reject(socket, 403, 'Forbidden');

    // Handshake — accept the socket.
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey(wsKey)}\r\n\r\n`,
    );

    const actor: CollabActor = {
      actorId: user.id,
      displayName: user.name,
      colorSeed: colorSeed(user.id),
    };
    const conn: Conn = {
      id: randomUUID(),
      socket,
      actor,
      projectId,
      decoder: new FrameDecoder(),
      alive: true,
    };
    const r = getRoom(projectId);
    r.conns.add(conn);

    socket.on('data', (chunk: Buffer) => {
      let messages;
      try {
        messages = conn.decoder.push(chunk);
      } catch {
        dropConn(conn);
        socket.destroy();
        return;
      }
      for (const m of messages) {
        if (m.type === 'text') onMessage(conn, m.data);
        else if (m.type === 'ping') socket.write(encodePong(m.data));
        else if (m.type === 'pong') conn.alive = true;
        else if (m.type === 'close') {
          try {
            socket.write(encodeClose(1000));
          } catch {
            /* ignore */
          }
          dropConn(conn);
          socket.end();
        }
      }
    });
    socket.on('close', () => dropConn(conn));
    socket.on('error', () => dropConn(conn));
  }

  const pingTimer = setInterval(() => {
    for (const r of rooms.values()) {
      for (const c of r.conns) {
        if (!c.alive) {
          dropConn(c);
          c.socket.destroy();
          continue;
        }
        c.alive = false;
        try {
          c.socket.write(encodePing());
        } catch {
          /* ignore */
        }
      }
    }
  }, PING_MS);
  pingTimer.unref?.();

  return new Promise((resolve, reject2) => {
    server.on('error', reject2);
    server.listen(port, () => {
      resolve({
        port,
        stats: () => ({
          rooms: rooms.size,
          connections: [...rooms.values()].reduce((n, r) => n + r.conns.size, 0),
        }),
        close: () =>
          new Promise<void>((res) => {
            clearInterval(pingTimer);
            for (const r of rooms.values()) {
              for (const c of r.conns) c.socket.destroy();
            }
            server.close(() => res());
          }),
      });
    });
  });
}
