'use client';

// PRISM SHELL — ENGINE FRAME BRIDGE (SHELL W2 TASK 0, 2026-07-04)
//
// The engine-side half of the real-engine transport (deviation W2-D1). This
// component mounts NEXT TO the unmodified `/` page component inside the
// /app/engine-frame document and translates between serialized prism-shell
// envelopes (postMessage carriers from RealEngineHost) and the prototype's
// OWN published control surface:
//
//   window.__PRISM_EDITOR_SET_VIEW_MODE__  — the page's sanctioned mode hook
//   window.__PRISM_DEBUG_STORES__          — the page's store handles
//
// No engine-interior module is imported and no engine file changes: the
// bridge drives the same hooks the repo's verification harness has always
// driven. Emission discipline mirrors the stub host: `mounted` only after
// the graph is loaded AND the scene canvas painted; `mode-changed` /
// `selection-changed` from store subscriptions (so user actions INSIDE the
// prototype round-trip to the shell exactly like shell commands do);
// selection echo origin discipline via an expected-echo latch.
//
// Standalone opens (open-in-new-tab / direct navigation) have no parent to
// speak to: the bridge stays inert and the prototype simply runs.

import { useEffect } from 'react';
import {
  parseShellCommand,
  serializeEngineEvent,
  type PrismEngineEvent,
  type PrismShellCommand,
  type PrismViewMode,
} from '../../../../packages/shared-interfaces/src/prism-shell';
import type {
  FrameToShellCarrier,
  ShellToFrameCarrier,
} from '@/lib/shell/engine/real-engine-adapter';

// ── The prototype's published window surface (shapes only — no imports) ──────

interface EditorStoreSlice {
  viewMode: PrismViewMode;
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;
  flyToNode: (id: string) => void;
  flyToHub: (hubId: string) => void;
  closeInspector: () => void;
}

interface SourceStoreSlice {
  ready: boolean;
}

interface StoreHandle<T> {
  getState: () => T;
  subscribe: (listener: (state: T, prev: T) => void) => () => void;
}

interface PrototypeWindow extends Window {
  __PRISM_EDITOR_SET_VIEW_MODE__?: (mode: string) => void;
  __PRISM_DEBUG_STORES__?: {
    graphSource: StoreHandle<SourceStoreSlice>;
    graphEditor: StoreHandle<EditorStoreSlice>;
  };
}

/** Camera settle window for the W2-D2 `camera-focused` heuristic (ms). */
const CAMERA_SETTLE_MS = 750;
/** Poll cadence while waiting for the prototype to finish booting (ms). */
const READY_POLL_MS = 120;

export default function EngineFrameBridge() {
  useEffect(() => {
    const win = window as PrototypeWindow;
    // Standalone document (no embedding shell) — stay inert.
    if (window.parent === window) return;
    const parent = window.parent;
    const origin = window.location.origin;

    let disposed = false;
    let mountedEmitted = false;
    let graphRef: string | undefined;
    let expectedSelectionEcho: { nodeId: string | null } | null = null;
    const pendingCommands: PrismShellCommand[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let unsubscribeStores: (() => void) | null = null;

    const emit = (event: PrismEngineEvent) => {
      if (disposed) return;
      const carrier: FrameToShellCarrier = {
        __prismEngineWire: serializeEngineEvent(event),
      };
      parent.postMessage(carrier, origin);
    };

    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    const stores = () => win.__PRISM_DEBUG_STORES__;
    const editor = () => stores()?.graphEditor;

    const setMode = (mode: PrismViewMode) => {
      const hook = win.__PRISM_EDITOR_SET_VIEW_MODE__;
      if (hook) {
        hook(mode);
        return true;
      }
      return false;
    };

    /** The prototype is "mounted" (contract sense) once its graph is loaded
     *  and the one continuous scene has a painted canvas. */
    const isReady = () =>
      Boolean(
        stores()?.graphSource.getState().ready &&
          win.__PRISM_EDITOR_SET_VIEW_MODE__ &&
          document.querySelector('canvas'),
      );

    const apply = (command: PrismShellCommand) => {
      const ed = editor();
      switch (command.type) {
        case 'mount': {
          graphRef = command.graphRef;
          if (command.initialMode) setMode(command.initialMode);
          if (!mountedEmitted) {
            mountedEmitted = true;
            // Let the requested mode land before reporting it back.
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const mode = editor()?.getState().viewMode ?? 'preview-app';
                emit({ type: 'mounted', mode, ...(graphRef ? { graphRef } : {}) });
              }),
            );
          }
          return;
        }
        case 'unmount': {
          emit({ type: 'unmounted' });
          return;
        }
        case 'set-mode': {
          const current = ed?.getState().viewMode;
          if (current === command.mode) {
            // Already there — ack so the shell's pending bead settles.
            emit({ type: 'mode-changed', mode: command.mode });
            return;
          }
          if (!setMode(command.mode)) {
            emit({
              type: 'error',
              error: {
                code: 'MODE_HOOK_UNAVAILABLE',
                message: 'the prototype mode hook is not installed',
                source: 'engine',
                recoverable: true,
              },
            });
          }
          // mode-changed rides the store subscription.
          return;
        }
        case 'set-selection': {
          if (!ed) return;
          expectedSelectionEcho = { nodeId: command.nodeId };
          ed.getState().selectNode(command.nodeId);
          // If the store value did not change, the subscription won't fire —
          // echo directly so the shell still gets its ack.
          if (ed.getState().selectedNodeId === command.nodeId && expectedSelectionEcho) {
            const still = expectedSelectionEcho;
            expectedSelectionEcho = null;
            emit({
              type: 'selection-changed',
              nodeId: still.nodeId,
              origin: 'command',
            });
          }
          return;
        }
        case 'focus-camera': {
          if (!ed) return;
          if (command.target.kind === 'node') {
            ed.getState().flyToNode(command.target.nodeId);
          } else {
            ed.getState().flyToHub(command.target.hubId);
          }
          // W2-D2: no arrival callback exists engine-side; settle-timed ack.
          const target = command.target;
          later(CAMERA_SETTLE_MS, () => emit({ type: 'camera-focused', target }));
          return;
        }
        case 'open-prompt-edit': {
          if (command.scope.kind !== 'node') {
            emit({
              type: 'error',
              error: {
                code: 'PROMPT_EDIT_SCOPE_UNSUPPORTED',
                message: `prompt-edit scope '${command.scope.kind}' is not yet drivable over the bridge (node scope only)`,
                source: 'engine',
                recoverable: true,
              },
            });
            return;
          }
          if (!ed) return;
          // The prototype's prompt-edit surface (NodeAgentPanel) self-gates
          // on canvas mode + a selected node, and hides behind the Inspector
          // dock — this is the surface's own documented open path.
          const nodeId = command.scope.nodeId;
          setMode('canvas');
          expectedSelectionEcho = { nodeId };
          ed.getState().selectNode(nodeId);
          ed.getState().closeInspector();
          const scope = command.scope;
          requestAnimationFrame(() => emit({ type: 'prompt-edit-opened', scope }));
          return;
        }
        default:
          return;
      }
    };

    const applyOrQueue = (command: PrismShellCommand) => {
      if (isReady()) {
        apply(command);
      } else {
        pendingCommands.push(command);
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (disposed) return;
      if (event.origin !== origin || event.source !== parent) return;
      const data = event.data as ShellToFrameCarrier | null;
      if (!data || typeof data !== 'object') return;
      if (typeof data.__prismShellWire !== 'string') return;
      try {
        const envelope = parseShellCommand(data.__prismShellWire);
        applyOrQueue(envelope.command);
      } catch {
        emit({
          type: 'error',
          error: {
            code: 'CONTRACT_PARSE_FAILED',
            message: 'engine frame could not parse an inbound command envelope',
            source: 'contract',
            recoverable: true,
          },
        });
      }
    };

    const subscribeStores = () => {
      const handle = stores();
      if (!handle) return;
      const unsub = handle.graphEditor.subscribe((state, prev) => {
        if (state.viewMode !== prev.viewMode) {
          emit({ type: 'mode-changed', mode: state.viewMode });
        }
        if (state.selectedNodeId !== prev.selectedNodeId) {
          const echo =
            expectedSelectionEcho &&
            expectedSelectionEcho.nodeId === state.selectedNodeId;
          expectedSelectionEcho = null;
          emit({
            type: 'selection-changed',
            nodeId: state.selectedNodeId,
            origin: echo ? 'command' : 'user',
          });
        }
      });
      unsubscribeStores = unsub;
    };

    // Boot: say hello immediately (commands queue shell-side until then is
    // not needed — the host queues until hello; we queue until ready), then
    // poll for prototype readiness and flush.
    window.addEventListener('message', onMessage);
    const hello: FrameToShellCarrier = { __prismEngineHello: true };
    parent.postMessage(hello, origin);

    const pollReady = () => {
      if (disposed) return;
      if (isReady()) {
        subscribeStores();
        const pending = pendingCommands.splice(0, pendingCommands.length);
        for (const command of pending) apply(command);
        return;
      }
      later(READY_POLL_MS, pollReady);
    };
    pollReady();

    return () => {
      disposed = true;
      window.removeEventListener('message', onMessage);
      unsubscribeStores?.();
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
  }, []);

  return null;
}
