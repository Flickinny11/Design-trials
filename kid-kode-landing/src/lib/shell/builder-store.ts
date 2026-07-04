// PRISM SHELL — BUILDER ENGINE-STATE STORE (SHELL W1, 2026-07-04)
//
// The one Zustand store (spec I3: one store per concern) for the builder's
// view of the engine: mode, selection, prompt-edit state, build-wave chrome,
// errors, and the bidirectional WIRE LOG — every envelope that crosses the
// Prime Boundary, both directions, capped ring-buffer style. The log is the
// W1 gate's "commands+events logged both ways" evidence surface (rendered by
// the dev Contract tab).
//
// ECHO DISCIPLINE (W0 report §6.2): `selection-changed` events update state
// here — including `origin:'command'` echoes of the shell's own writes — but
// NOTHING in this store or its subscribers issues engine commands in
// response to an event. Commands originate exclusively from user-intent
// handlers (via useEngineBridge.sendCommand), so a command→echo→command loop
// is structurally impossible rather than merely filtered.

import { create } from 'zustand';
import type {
  PrismEngineError,
  PrismEngineEvent,
  PrismPromptEditScope,
  PrismViewMode,
} from '../../../packages/shared-interfaces/src/prism-shell';
import type { PrismEngineHostKind } from './engine/engine-host';

export type WireDirection = 'shell→engine' | 'engine→shell';

export interface WireLogEntry {
  readonly seq: number;
  readonly dir: WireDirection;
  /** Command/event discriminant (e.g. 'set-mode', 'selection-changed'). */
  readonly type: string;
  /** Envelope id + sender timestamp (correlation evidence). */
  readonly id: string;
  readonly ts: number;
  /** The full serialized envelope as it crossed the boundary. */
  readonly wire: string;
}

const WIRE_LOG_CAP = 250;

export type EngineStatus = 'idle' | 'booting' | 'ready' | 'unmounted' | 'error';

interface BuilderEngineState {
  engineKind: PrismEngineHostKind | null;
  engineStatus: EngineStatus;
  mode: PrismViewMode;
  /** Mode the shell has requested but the engine has not confirmed yet —
   *  drives the mode switch's in-flight state. */
  pendingMode: PrismViewMode | null;
  selectedNodeId: string | null;
  lastSelectionOrigin: 'user' | 'command' | null;
  promptEditScope: PrismPromptEditScope | null;
  promptEditOpenedAt: number | null;
  cameraFocusedAt: number | null;
  buildWave: { wave: number; status: 'started' | 'completed' | 'failed' } | null;
  mountedNodeIds: readonly string[];
  lastError: PrismEngineError | null;
  wireLog: readonly WireLogEntry[];
  wireSeq: number;

  /** New engine session (a StrictMode dev remount starts a fresh session —
   *  the log documents one session, not the component's replay history). */
  beginEngineSession(kind: PrismEngineHostKind): void;
  logWire(entry: Omit<WireLogEntry, 'seq'>): void;
  applyEngineEvent(event: PrismEngineEvent): void;
  noteModeRequested(mode: PrismViewMode): void;
  clearPromptEdit(): void;
  clearError(): void;
}

export const useBuilderStore = create<BuilderEngineState>((set) => ({
  engineKind: null,
  engineStatus: 'idle',
  mode: 'preview-app',
  pendingMode: null,
  selectedNodeId: null,
  lastSelectionOrigin: null,
  promptEditScope: null,
  promptEditOpenedAt: null,
  cameraFocusedAt: null,
  buildWave: null,
  mountedNodeIds: [],
  lastError: null,
  wireLog: [],
  wireSeq: 0,

  beginEngineSession: (kind) =>
    set({
      engineKind: kind,
      engineStatus: 'booting',
      mode: 'preview-app',
      pendingMode: null,
      selectedNodeId: null,
      lastSelectionOrigin: null,
      promptEditScope: null,
      promptEditOpenedAt: null,
      cameraFocusedAt: null,
      buildWave: null,
      mountedNodeIds: [],
      lastError: null,
      wireLog: [],
      wireSeq: 0,
    }),

  logWire: (entry) =>
    set((s) => {
      const seq = s.wireSeq + 1;
      const next = [...s.wireLog, { ...entry, seq }];
      return {
        wireSeq: seq,
        wireLog: next.length > WIRE_LOG_CAP ? next.slice(next.length - WIRE_LOG_CAP) : next,
      };
    }),

  applyEngineEvent: (event) =>
    set((s) => {
      switch (event.type) {
        case 'mounted':
          return { engineStatus: 'ready' as const, mode: event.mode };
        case 'unmounted':
          return { engineStatus: 'unmounted' as const };
        case 'mode-changed':
          return { mode: event.mode, pendingMode: null };
        case 'camera-focused':
          return { cameraFocusedAt: Date.now() };
        case 'selection-changed':
          // State is applied for BOTH origins; no command is ever issued from
          // here (see the echo-discipline note in the header).
          return {
            selectedNodeId: event.nodeId,
            lastSelectionOrigin: event.origin,
          };
        case 'node-verified':
          return {};
        case 'node-mounted':
          return s.mountedNodeIds.includes(event.nodeId)
            ? {}
            : { mountedNodeIds: [...s.mountedNodeIds, event.nodeId] };
        case 'build-wave':
          return { buildWave: { wave: event.wave, status: event.status } };
        case 'prompt-edit-opened':
          return { promptEditScope: event.scope, promptEditOpenedAt: Date.now() };
        case 'error':
          return {
            lastError: event.error,
            // An error also settles any in-flight mode request — the pending
            // bead must never pulse forever on a failed transition (criteria
            // judge W1 should-fix, pre-real-engine hardening).
            pendingMode: null,
            ...(event.error.recoverable ? {} : { engineStatus: 'error' as const }),
          };
        default:
          return {};
      }
    }),

  noteModeRequested: (mode) => set({ pendingMode: mode }),
  clearPromptEdit: () => set({ promptEditScope: null, promptEditOpenedAt: null }),
  clearError: () => set({ lastError: null }),
}));
