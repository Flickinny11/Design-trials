'use client';

// PRISM SHELL — COLLAB PRESENCE / CO-EDITING STORE (SHELL W7, decision E)
//
// The ONE Zustand store (spec I3: one store per concern) for the builder's
// view of the CollabRoom channel: connection status, live presence of OTHER
// actors, soft locks, and the local seq. It owns a single native-WebSocket
// client (the browser's own WebSocket — the single Decision-E exception to
// I1); the tRPC/SSE transport is never touched.
//
// Ephemeral discipline (E.2): presence lives ONLY here, expires locally when
// stale, and is gone on disconnect — nothing about presence is persisted.
// Co-editing ops are broadcast for optimistic apply; graph PERSISTENCE stays
// on the existing additive mutation path (tenancy.graph.save), unchanged.

import { useMemo } from 'react';
import { create } from 'zustand';
import type {
  CollabActor,
  CollabClientMessage,
  CollabOp,
  CollabSoftLock,
  PresenceState,
  RoomEventEnvelope,
} from '../../../packages/shared-interfaces/src/prism-collab';
import { getCollabRoomUrl } from './collab-config';

export type CollabStatus = 'idle' | 'connecting' | 'live' | 'closed' | 'error';

/** Remote presence expires locally this long after its last heartbeat. */
const PRESENCE_TTL_MS = 15_000;
const PRESENCE_THROTTLE_MS = 50;

interface CollabState {
  status: CollabStatus;
  /** Server-authoritative identity of THIS client (from the room). */
  selfActorId: string | null;
  /** Other actors' presence, keyed by actorId (self excluded). */
  presence: Record<string, PresenceState>;
  locks: Record<string, CollabSoftLock>;
  lastSeq: number;
  /** The most recent committed op (drives an optimistic apply hook + tests). */
  lastOp: CollabOp | null;

  connect(projectId: string, actor: CollabActor): void;
  disconnect(): void;
  sendCursor(cursor: { x: number; y: number } | undefined, selection: string[], editingNodeId?: string): void;
  sendOp(op: Omit<CollabOp, 'seq'>): void;
  setLock(nodeId: string, acquire: boolean): void;
  undo(): void;
}

// Module-scoped socket (one per store; the store is a singleton).
let sock: WebSocket | null = null;
let selfActor: CollabActor | null = null;
let lastPresenceSentAt = 0;

function sendMessage(msg: CollabClientMessage): void {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify(msg));
  }
}

export const useCollabStore = create<CollabState>((set, get) => ({
  status: 'idle',
  selfActorId: null,
  presence: {},
  locks: {},
  lastSeq: 0,
  lastOp: null,

  connect: (projectId, actor) => {
    const url = getCollabRoomUrl(projectId);
    if (!url) {
      set({ status: 'idle' });
      return;
    }
    // Tear down any prior socket for a clean re-connect.
    if (sock) {
      try {
        sock.close();
      } catch {
        /* ignore */
      }
      sock = null;
    }
    selfActor = actor;
    set({ status: 'connecting', selfActorId: actor.actorId, presence: {}, locks: {} });
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      set({ status: 'error' });
      return;
    }
    sock = ws;
    ws.onopen = () => {
      set({ status: 'live' });
      sendMessage({ kind: 'hello', actor });
    };
    ws.onclose = () => {
      if (sock === ws) sock = null;
      set({ status: 'closed' });
    };
    ws.onerror = () => set({ status: 'error' });
    ws.onmessage = (ev) => {
      let env: RoomEventEnvelope;
      try {
        env = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      if (env?.kind !== 'prism-room-event') return;
      applyEvent(env, set, get);
    };
  },

  disconnect: () => {
    if (sock) {
      try {
        sock.close();
      } catch {
        /* ignore */
      }
      sock = null;
    }
    selfActor = null;
    set({ status: 'idle', selfActorId: null, presence: {}, locks: {} });
  },

  sendCursor: (cursor, selection, editingNodeId) => {
    if (!selfActor) return;
    const now = Date.now();
    if (now - lastPresenceSentAt < PRESENCE_THROTTLE_MS) return;
    lastPresenceSentAt = now;
    const presence: PresenceState = {
      actor: selfActor,
      cursor,
      selection,
      editingNodeId,
      updatedAt: now,
    };
    sendMessage({ kind: 'presence', presence });
  },

  sendOp: (op) => {
    sendMessage({ kind: 'op', op: { ...op, seq: undefined } as CollabOp });
  },

  setLock: (nodeId, acquire) => {
    sendMessage({ kind: 'lock', nodeId, acquire });
  },

  undo: () => sendMessage({ kind: 'undo' }),
}));

/** Presence of everyone except self, freshest first, stale dropped. Selects the
 *  STABLE `presence` reference (only replaced when presence changes) so
 *  useSyncExternalStore's snapshot stays referentially stable — deriving the
 *  array inside the selector would return a fresh array every render and loop. */
export function useOthers(): PresenceState[] {
  const presence = useCollabStore((s) => s.presence);
  const selfActorId = useCollabStore((s) => s.selfActorId);
  return useMemo(() => {
    const now = Date.now();
    return Object.values(presence)
      .filter((p) => p.actor.actorId !== selfActorId)
      .filter((p) => p.updatedAt === 0 || now - p.updatedAt < PRESENCE_TTL_MS)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [presence, selfActorId]);
}

function applyEvent(
  env: RoomEventEnvelope,
  set: (partial: Partial<CollabState>) => void,
  get: () => CollabState,
): void {
  const event = env.event;
  const s = get();
  switch (event.type) {
    case 'room-snapshot': {
      const presence: Record<string, PresenceState> = {};
      for (const p of event.presence) presence[p.actor.actorId] = p;
      const locks: Record<string, CollabSoftLock> = {};
      for (const l of event.locks) locks[l.nodeId] = l;
      set({ presence, locks, lastSeq: event.lastSeq });
      break;
    }
    case 'presence-updated': {
      set({
        presence: { ...s.presence, [event.presence.actor.actorId]: event.presence },
      });
      break;
    }
    case 'presence-left': {
      const next = { ...s.presence };
      delete next[event.actorId];
      set({ presence: next });
      break;
    }
    case 'op-committed': {
      set({
        lastOp: event.op,
        lastSeq: Math.max(s.lastSeq, event.op.seq ?? s.lastSeq),
      });
      break;
    }
    case 'lock-acquired': {
      set({ locks: { ...s.locks, [event.lock.nodeId]: event.lock } });
      break;
    }
    case 'lock-released': {
      const next = { ...s.locks };
      delete next[event.nodeId];
      set({ locks: next });
      break;
    }
  }
}

/** Deterministic presence tint from an actor's colorSeed (client-side render).
 *  Kept out of the wire contract — every client derives the same hue. */
export function colorForSeed(seed: number): string {
  const hue = seed % 360;
  return `hsl(${hue} 72% 58%)`;
}
