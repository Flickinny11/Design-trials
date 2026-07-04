// PRISM SHELL ↔ ENGINE CONTRACT — prism-shell.ts (SHELL W0, 2026-07-04)
//
// The Prime Boundary (PRISM-FRONTEND-SHELL-SPEC.md §0 / I0): the shell is
// React/DOM; the preview-pane interior is the no-DOM Three.js/WebGPU engine.
// They communicate ONLY through this typed command/event surface. Nothing in
// the shell may reach into engine internals; nothing in the engine may render
// shell chrome. This module is the single written form of that boundary.
//
// Direction convention:
//   PrismShellCommand — shell → engine (imperative: mount, switch mode, focus)
//   PrismEngineEvent  — engine → shell (declarative: what happened inside)
//
// Discipline:
//   - ADDITIVE ONLY. Never remove or repurpose a variant or field; add new
//     variants and bump PRISM_SHELL_CONTRACT_VERSION when the wire shape grows.
//   - View-mode literals mirror the engine's canonical 3 exactly
//     ('galaxy' | 'canvas' | 'preview-app' — useGraphEditorStore.ViewMode,
//     INV-24/RA-06b). No other mode literal may ever appear here.
//   - Every message crosses the boundary inside a versioned envelope; parsing
//     is Zod-validated (spec I4: contract-first, Zod). Unknown message types
//     or foreign versions fail parse loudly instead of half-applying.
//   - No transport here. SSE / postMessage / direct dispatch are wiring
//     concerns for W1; W0 defines only the shapes.

import { z } from 'zod';

// ── Version ──────────────────────────────────────────────────────────────────

/** Wire version of the shell↔engine contract. At v1 the policy is EXACT-MATCH:
 *  `z.literal(1)` in the envelopes means parsers reject ANY other version —
 *  older or newer — rather than guessing at unknown shapes. When W1 wires the
 *  transport, an explicit compatibility policy (e.g. accept same-major) must
 *  be encoded IN THE SCHEMA at the same time the version first bumps; until
 *  then, both sides ship from this one module so versions cannot skew. */
export const PRISM_SHELL_CONTRACT_VERSION = 1 as const;

// ── Shared primitives ────────────────────────────────────────────────────────

/** The engine's canonical view modes — states of one continuous scene.
 *  MUST stay literal-identical to useGraphEditorStore.ViewMode. */
export const prismViewModeSchema = z.enum(['galaxy', 'canvas', 'preview-app']);
export type PrismViewMode = z.infer<typeof prismViewModeSchema>;

/** A camera-focus target: a hub (world/section) or a single node. */
export const prismFocusTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hub'), hubId: z.string().min(1) }),
  z.object({ kind: z.literal('node'), nodeId: z.string().min(1) }),
]);
export type PrismFocusTarget = z.infer<typeof prismFocusTargetSchema>;

/** Scope for opening the prompt-edit surface (WS-W3 unified node agent). */
export const prismPromptEditScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('node'), nodeId: z.string().min(1) }),
  z.object({ kind: z.literal('hub'), hubId: z.string().min(1) }),
  z.object({ kind: z.literal('app') }),
]);
export type PrismPromptEditScope = z.infer<typeof prismPromptEditScopeSchema>;

/** Structured error crossing the boundary (engine crash, node failure,
 *  asset failure). `recoverable: false` means the shell should offer a
 *  remount, not a retry of the same command. */
export const prismEngineErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  source: z.enum(['engine', 'node', 'asset', 'contract']),
  recoverable: z.boolean(),
  nodeId: z.string().min(1).optional(),
  hubId: z.string().min(1).optional(),
});
export type PrismEngineError = z.infer<typeof prismEngineErrorSchema>;

// ── Commands: shell → engine ─────────────────────────────────────────────────

export const prismShellCommandSchema = z.discriminatedUnion('type', [
  /** Mount the engine into a shell-owned container. The shell owns the DOM
   *  element; the engine owns everything inside its canvas. */
  z.object({
    type: z.literal('mount'),
    containerId: z.string().min(1),
    /** Opaque reference to the graph/artifact to load (never inline data). */
    graphRef: z.string().min(1).optional(),
    initialMode: prismViewModeSchema.optional(),
  }),
  /** Tear the engine down and release GPU resources. */
  z.object({ type: z.literal('unmount') }),
  /** Switch the continuous scene between its canonical 3 states. */
  z.object({
    type: z.literal('set-mode'),
    mode: prismViewModeSchema,
  }),
  /** Fly the camera to a hub or node (shell side of the selection
   *  round-trip: shell issues focus commands, engine answers with events). */
  z.object({
    type: z.literal('focus-camera'),
    target: prismFocusTargetSchema,
    animate: z.boolean().optional(),
  }),
  /** Set (or clear, with null) the engine selection from the shell. */
  z.object({
    type: z.literal('set-selection'),
    nodeId: z.string().min(1).nullable(),
  }),
  /** Open the prompt-edit surface for a node / hub / the whole app. */
  z.object({
    type: z.literal('open-prompt-edit'),
    scope: prismPromptEditScopeSchema,
  }),
]);
export type PrismShellCommand = z.infer<typeof prismShellCommandSchema>;

// ── Events: engine → shell ───────────────────────────────────────────────────

export const prismEngineEventSchema = z.discriminatedUnion('type', [
  /** Engine finished mounting; first frame is painted. */
  z.object({
    type: z.literal('mounted'),
    mode: prismViewModeSchema,
    graphRef: z.string().min(1).optional(),
  }),
  /** Engine fully unmounted; container is free. */
  z.object({ type: z.literal('unmounted') }),
  /** The scene finished a mode transition (from either side's trigger). */
  z.object({
    type: z.literal('mode-changed'),
    mode: prismViewModeSchema,
  }),
  /** Camera arrived at a focus target. */
  z.object({
    type: z.literal('camera-focused'),
    target: prismFocusTargetSchema,
  }),
  /** Selection changed inside the engine (engine side of the round-trip).
   *  origin distinguishes a user click in-canvas from an echo of a shell
   *  `set-selection` command, so the shell never loops its own writes. */
  z.object({
    type: z.literal('selection-changed'),
    nodeId: z.string().min(1).nullable(),
    origin: z.enum(['user', 'command']),
  }),
  /** Build-wave hydration: a node's generated artifact passed verification. */
  z.object({
    type: z.literal('node-verified'),
    nodeId: z.string().min(1),
    wave: z.number().int().nonnegative(),
  }),
  /** Build-wave hydration: a verified node materialized in the scene. */
  z.object({
    type: z.literal('node-mounted'),
    nodeId: z.string().min(1),
    wave: z.number().int().nonnegative(),
  }),
  /** A whole build wave opened or settled (shell progress chrome reads this). */
  z.object({
    type: z.literal('build-wave'),
    wave: z.number().int().nonnegative(),
    status: z.enum(['started', 'completed', 'failed']),
  }),
  /** Prompt-edit surface actually opened for the requested scope. */
  z.object({
    type: z.literal('prompt-edit-opened'),
    scope: prismPromptEditScopeSchema,
  }),
  /** Structured error surface (never a bare string, never a silent drop). */
  z.object({
    type: z.literal('error'),
    error: prismEngineErrorSchema,
  }),
]);
export type PrismEngineEvent = z.infer<typeof prismEngineEventSchema>;

// ── Versioned envelopes ──────────────────────────────────────────────────────

const envelopeBase = {
  /** Contract version — see PRISM_SHELL_CONTRACT_VERSION. */
  v: z.literal(PRISM_SHELL_CONTRACT_VERSION),
  /** Sender-unique message id (correlation / dedupe). */
  id: z.string().min(1),
  /** Sender wall-clock, unix ms. */
  ts: z.number().int().nonnegative(),
};

export const prismShellCommandEnvelopeSchema = z.object({
  ...envelopeBase,
  kind: z.literal('prism-shell-command'),
  command: prismShellCommandSchema,
});
export type PrismShellCommandEnvelope = z.infer<typeof prismShellCommandEnvelopeSchema>;

export const prismEngineEventEnvelopeSchema = z.object({
  ...envelopeBase,
  kind: z.literal('prism-engine-event'),
  event: prismEngineEventSchema,
});
export type PrismEngineEventEnvelope = z.infer<typeof prismEngineEventEnvelopeSchema>;

// ── Serialization helpers (pure; no transport) ──────────────────────────────

let seq = 0;
/** Monotonic-ish default id; callers with real correlation needs pass their own. */
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq.toString(36)}`;
}

/** Wrap a command in a versioned envelope and serialize to the wire string. */
export function serializeShellCommand(
  command: PrismShellCommand,
  opts?: { id?: string; ts?: number },
): string {
  const envelope: PrismShellCommandEnvelope = {
    v: PRISM_SHELL_CONTRACT_VERSION,
    kind: 'prism-shell-command',
    id: opts?.id ?? nextId('cmd'),
    ts: opts?.ts ?? Date.now(),
    command,
  };
  return JSON.stringify(envelope);
}

/** Parse + validate a wire string as a command envelope. Throws ZodError on
 *  malformed input, unknown command type, or foreign version. */
export function parseShellCommand(wire: string): PrismShellCommandEnvelope {
  return prismShellCommandEnvelopeSchema.parse(JSON.parse(wire));
}

/** Wrap an event in a versioned envelope and serialize to the wire string. */
export function serializeEngineEvent(
  event: PrismEngineEvent,
  opts?: { id?: string; ts?: number },
): string {
  const envelope: PrismEngineEventEnvelope = {
    v: PRISM_SHELL_CONTRACT_VERSION,
    kind: 'prism-engine-event',
    id: opts?.id ?? nextId('evt'),
    ts: opts?.ts ?? Date.now(),
    event,
  };
  return JSON.stringify(envelope);
}

/** Parse + validate a wire string as an event envelope. Throws ZodError on
 *  malformed input, unknown event type, or foreign version. */
export function parseEngineEvent(wire: string): PrismEngineEventEnvelope {
  return prismEngineEventEnvelopeSchema.parse(JSON.parse(wire));
}
