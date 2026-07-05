// PRISM COLLABROOM CONTRACT — prism-collab.ts (SHELL W0, decision E, 2026-07-04)
//
// TYPES ONLY. Decision E (PRISM-SHELL-DECISIONS-2026-07-04.md, founder lock
// 10:38 CDT) amends the SSE-only law with ONE scoped channel: a per-project
// CollabRoom Durable Object over Cloudflare's hibernatable WebSocket API,
// carrying presence + co-editing ops only. W0 ships the SHAPES of that
// channel so W7 can wire it without inventing wire formats; W0 ships ZERO
// transport — no Durable Object, no WebSocket, no polling, nothing that opens
// a connection. Importing this module must never create network activity.
//
// Co-editing model (E.3 — the Figma model, not CRDT-everything):
//   - Graph mutations keep flowing through the existing additive-schema path.
//   - In shared sessions the room sequences ops: per-property last-writer-wins,
//     the server (room DO) is the ordering authority, committed ops broadcast,
//     clients apply optimistically and reconcile on commit.
//   - Per-node soft locks reduce conflicts socially; undo is per-user.
//   - Character-level CRDT is deferred past v1 (NOT represented here).
//
// Presence model (E.2): live cursors, selections, camera ghosts,
// who's-editing-which-node badges. Ephemeral, throttled, never persisted,
// zero data-model changes.

import { z } from 'zod';

// ── Version ──────────────────────────────────────────────────────────────────

/** Wire version of the CollabRoom contract (independent of prism-shell.ts). */
export const PRISM_COLLAB_CONTRACT_VERSION = 1 as const;

// ── Actors ───────────────────────────────────────────────────────────────────

/** A collaborator identity as the room sees it. Display-only data — auth is
 *  Better Auth's concern (I2); no tokens or emails cross this channel. */
export const collabActorSchema = z.object({
  actorId: z.string().min(1),
  displayName: z.string().min(1),
  /** Deterministic hue seed for cursor/badge tinting (client renders). */
  colorSeed: z.number().int().nonnegative(),
});
export type CollabActor = z.infer<typeof collabActorSchema>;

// ── Presence (E.2 — ephemeral, throttled, never persisted) ──────────────────

/** A camera ghost: enough of a pose to draw a translucent frustum marker. */
export const collabCameraGhostSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
  mode: z.enum(['galaxy', 'canvas', 'preview-app']),
});
export type CollabCameraGhost = z.infer<typeof collabCameraGhostSchema>;

export const presenceStateSchema = z.object({
  actor: collabActorSchema,
  /** Normalized viewport cursor (0..1 each axis); absent when off-surface. */
  cursor: z.object({ x: z.number(), y: z.number() }).optional(),
  /** Node ids this actor currently has selected. */
  selection: z.array(z.string().min(1)),
  /** Node id this actor is actively editing (drives the "editing" badge). */
  editingNodeId: z.string().min(1).optional(),
  camera: collabCameraGhostSchema.optional(),
  /** Sender wall-clock, unix ms — receivers expire stale presence locally. */
  updatedAt: z.number().int().nonnegative(),
});
export type PresenceState = z.infer<typeof presenceStateSchema>;

// ── Co-editing ops (E.3 — per-property LWW) ──────────────────────────────────

/** JSON value for op payloads — structured clone-safe, never functions. */
export const collabJsonValueSchema: z.ZodType<CollabJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(collabJsonValueSchema),
    z.record(z.string(), collabJsonValueSchema),
  ]),
);
export type CollabJsonValue =
  | string
  | number
  | boolean
  | null
  | CollabJsonValue[]
  | { [key: string]: CollabJsonValue };

/** One per-property last-writer-wins mutation. `seq` is assigned by the room
 *  (the ordering authority) at commit; clients send ops with seq omitted and
 *  receive them back sequenced. */
export const collabOpSchema = z.object({
  nodeId: z.string().min(1),
  /** Dot-path of the property inside the node's additive schema
   *  (e.g. "caption", "scenePosition.x", "keyframes.3.value"). */
  path: z.string().min(1),
  value: collabJsonValueSchema,
  /** Room-assigned commit sequence — the LWW tiebreaker. Optional on the
   *  client→room leg; always present on the room→client broadcast. */
  seq: z.number().int().nonnegative().optional(),
  actor: z.string().min(1),
  /** Sender wall-clock, unix ms (diagnostic; seq, not ts, decides LWW). */
  ts: z.number().int().nonnegative(),
});
export type CollabOp = z.infer<typeof collabOpSchema>;

// ── Soft locks (E.3 — social, per-node) ──────────────────────────────────────

export const collabSoftLockSchema = z.object({
  nodeId: z.string().min(1),
  actor: z.string().min(1),
  acquiredAt: z.number().int().nonnegative(),
});
export type CollabSoftLock = z.infer<typeof collabSoftLockSchema>;

// ── Room events (room → clients) ─────────────────────────────────────────────

export const roomEventSchema = z.discriminatedUnion('type', [
  /** Full room state on join/rejoin: who's here, live locks, last seq. */
  z.object({
    type: z.literal('room-snapshot'),
    presence: z.array(presenceStateSchema),
    locks: z.array(collabSoftLockSchema),
    lastSeq: z.number().int().nonnegative(),
  }),
  /** A collaborator's throttled presence heartbeat. */
  z.object({
    type: z.literal('presence-updated'),
    presence: presenceStateSchema,
  }),
  /** A collaborator left (or their presence expired server-side). */
  z.object({
    type: z.literal('presence-left'),
    actorId: z.string().min(1),
  }),
  /** The room committed an op (seq now assigned) and is broadcasting it. */
  z.object({
    type: z.literal('op-committed'),
    op: collabOpSchema,
  }),
  /** A per-node soft lock was taken. */
  z.object({
    type: z.literal('lock-acquired'),
    lock: collabSoftLockSchema,
  }),
  /** A per-node soft lock was released (explicitly or by disconnect). */
  z.object({
    type: z.literal('lock-released'),
    nodeId: z.string().min(1),
    actor: z.string().min(1),
  }),
]);
export type RoomEvent = z.infer<typeof roomEventSchema>;

// ── Client → room messages (W7 additive; W0 shaped only room→client) ─────────

/** What a client sends up the CollabRoom channel. `hello` is the first frame
 *  after connect (identity + optional initial presence); the room replies with
 *  a `room-snapshot`. Ops omit `seq` (the room assigns it). */
export const collabClientMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('hello'),
    actor: collabActorSchema,
    presence: presenceStateSchema.optional(),
  }),
  z.object({ kind: z.literal('presence'), presence: presenceStateSchema }),
  z.object({ kind: z.literal('op'), op: collabOpSchema }),
  z.object({
    kind: z.literal('lock'),
    nodeId: z.string().min(1),
    acquire: z.boolean(),
  }),
  /** Per-user undo — revert this actor's most recent own op (E.3). */
  z.object({ kind: z.literal('undo') }),
]);
export type CollabClientMessage = z.infer<typeof collabClientMessageSchema>;

// ── Versioned envelope ───────────────────────────────────────────────────────

export const roomEventEnvelopeSchema = z.object({
  v: z.literal(PRISM_COLLAB_CONTRACT_VERSION),
  kind: z.literal('prism-room-event'),
  roomId: z.string().min(1),
  ts: z.number().int().nonnegative(),
  event: roomEventSchema,
});
export type RoomEventEnvelope = z.infer<typeof roomEventEnvelopeSchema>;
