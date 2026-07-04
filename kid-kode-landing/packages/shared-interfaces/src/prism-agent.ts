// PRISM SHELL — CHAT AGENT CONTRACT — prism-agent.ts (SHELL W1, 2026-07-04)
//
// Contract-first (spec I4) shapes for the builder shell's chat agentic loop
// (spec §10 S4: "Chat agentic loop streams with collapsible tool steps;
// interruptible at all times"). The W1 endpoint behind these shapes is a
// local echo/stub agent (tRPC v11 streaming procedure); the REAL build
// orchestrator lands in W5 behind this same contract — the shapes below are
// the seam, so they are written for the real thing, not the stub.
//
// Transport note (I1): the stream rides a tRPC async-generator response over
// httpBatchStreamLink — a plain fetch response stream. No WebSocket, no
// polling. Interruption is client-side (AbortSignal): the consumer aborts the
// fetch and marks the message interrupted; no server event is required for a
// user stop, which is why `message-end.reason` has no 'interrupted' variant.
//
// E4 (PRISM-SHELL-ENHANCEMENTS-2026-07-04): tool steps are the surface where
// W5's Verify phase streams its evidence (frames, checks) into chat as
// collapsible steps. W1 renders the collapsible-step UI; the stub agent
// exercises it with scripted steps.
//
// Discipline: ADDITIVE ONLY — never remove or repurpose a variant or field.

import { z } from 'zod';

/** Contract version. Stamped on `message-start` so a future orchestrator can
 *  negotiate; at v1 consumers may assert equality. */
export const PRISM_AGENT_CONTRACT_VERSION = 1 as const;

// ── Request ──────────────────────────────────────────────────────────────────

export const agentChatRoleSchema = z.enum(['user', 'assistant']);
export type AgentChatRole = z.infer<typeof agentChatRoleSchema>;

/** Attachment METADATA only — names/sizes, never inline bytes and never any
 *  credential-like content (I5). Real upload plumbing is a later wave; the
 *  contract deliberately has no field a raw file body could ride in. */
export const agentAttachmentSchema = z
  .object({
    name: z.string().min(1).max(200),
    sizeBytes: z.number().int().nonnegative(),
    mimeType: z.string().min(1).max(120).optional(),
  })
  // strict(): an unknown key (e.g. a base64 `data` field) is REJECTED, not
  // stripped — the no-inline-bytes property must fail loudly at the edge.
  .strict();
export type AgentAttachment = z.infer<typeof agentAttachmentSchema>;

/** One prior conversation turn, replayed for context. Tool-step bodies are
 *  NOT replayed — they are presentation, not conversation state. */
export const agentTurnSchema = z.object({
  role: agentChatRoleSchema,
  text: z.string().max(20000),
});
export type AgentTurn = z.infer<typeof agentTurnSchema>;

export const agentChatRequestSchema = z.object({
  projectId: z.string().min(1).max(120),
  /** Requested model id. The server validates against the model-config
   *  registry (spec 7.4) and falls back to the configured default rather
   *  than trusting a stale persisted string; the resolved id comes back on
   *  `message-start.modelId`. */
  modelId: z.string().min(1).max(120),
  prompt: z.string().min(1).max(8000),
  history: z.array(agentTurnSchema).max(64).default([]),
  attachments: z.array(agentAttachmentSchema).max(8).default([]),
});
export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>;
/** The pre-parse (client-side) shape, where defaulted fields are optional. */
export type AgentChatRequestInput = z.input<typeof agentChatRequestSchema>;

// ── Stream events (server → client, in order) ───────────────────────────────
//
// Lifecycle: exactly one `message-start`, then any interleaving of
// `text-delta` and tool-step events (steps may nest deltas between their
// start/end), then exactly one `message-end` — unless the client aborts,
// in which case the stream simply ends early (interruption is client-owned).

export const agentStreamEventSchema = z.discriminatedUnion('type', [
  /** Stream opened. `modelId` is the RESOLVED model actually driving the
   *  turn (see agentChatRequestSchema.modelId). */
  z.object({
    type: z.literal('message-start'),
    v: z.literal(PRISM_AGENT_CONTRACT_VERSION),
    messageId: z.string().min(1),
    modelId: z.string().min(1),
  }),
  /** Assistant prose, appended verbatim in arrival order. */
  z.object({
    type: z.literal('text-delta'),
    delta: z.string(),
  }),
  /** A tool step opened (collapsible row in chat — E4). `title` is the
   *  user-facing verb line; `detail` is an optional mono subline. */
  z.object({
    type: z.literal('tool-step-start'),
    stepId: z.string().min(1),
    title: z.string().min(1).max(200),
    detail: z.string().max(400).optional(),
  }),
  /** Streamed body of a tool step (logs, checks, evidence lines). */
  z.object({
    type: z.literal('tool-step-delta'),
    stepId: z.string().min(1),
    delta: z.string(),
  }),
  /** Tool step settled. An 'error' step does not necessarily end the
   *  message — the agent narrates recovery in prose. */
  z.object({
    type: z.literal('tool-step-end'),
    stepId: z.string().min(1),
    status: z.enum(['ok', 'error']),
  }),
  /** Stream closed by the server. 'error' carries a user-presentable
   *  message; transport-level failures surface as thrown errors instead. */
  z.object({
    type: z.literal('message-end'),
    reason: z.enum(['complete', 'error']),
    errorMessage: z.string().max(2000).optional(),
  }),
]);
export type AgentStreamEvent = z.infer<typeof agentStreamEventSchema>;

// ── Parse helpers (pure; no transport) ───────────────────────────────────────

/** Validate an untrusted value as a chat request (server edge). */
export function parseAgentChatRequest(value: unknown): AgentChatRequest {
  return agentChatRequestSchema.parse(value);
}

/** Validate an untrusted value as a stream event (client edge — the consumer
 *  re-validates each yielded value instead of trusting transport typing). */
export function parseAgentStreamEvent(value: unknown): AgentStreamEvent {
  return agentStreamEventSchema.parse(value);
}
