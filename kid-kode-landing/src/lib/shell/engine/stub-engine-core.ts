// PRISM SHELL — STUB ENGINE PROTOCOL CORE (SHELL W1, 2026-07-04)
//
// The DOM-free half of the W1 engine stand-in: a state machine that receives
// serialized PrismShellCommandEnvelopes and answers with serialized
// PrismEngineEventEnvelopes, honoring the contract's semantics exactly —
// most importantly the selection echo discipline (a shell `set-selection`
// is answered with `selection-changed{origin:'command'}`, a user click with
// `origin:'user'`), so the shell's no-echo-loop handling is exercised for
// real before the engine session merges its adapter.
//
// The canvas renderer (stub-engine.ts) wraps this core; unit tests drive the
// core directly (tests/unit/shell-stub-engine.test.ts). The scheduler is
// injectable so tests run synchronously.

import {
  parseShellCommand,
  serializeEngineEvent,
  type PrismEngineEvent,
  type PrismViewMode,
} from '../../../../packages/shared-interfaces/src/prism-shell';
import { stubNodeIds } from './stub-graph';

export type StubSchedule = (fn: () => void, ms: number) => void;

export interface StubEngineHooks {
  /** The mount command arrived — attach the visual into #containerId, then
   *  call core.markPainted() once the first frame is up. */
  onMountRequest?: (containerId: string) => void;
  /** The unmount command arrived — tear the visual down. */
  onUnmountRequest?: () => void;
  /** Presentation nudge: mode target changed (renderer animates the morph). */
  onModeTarget?: (mode: PrismViewMode) => void;
  /** Presentation nudge: camera focus pulse toward a node/hub. */
  onFocusPulse?: (targetId: string) => void;
  /** Presentation nudge: a node just materialized (wave hydration) — the
   *  renderer gives it a mount glow so hydration reads on screen. */
  onNodeMounted?: (nodeId: string) => void;
}

/** Matches the engine's boot default (RA-17: preview-app on app boot). */
const BOOT_MODE: PrismViewMode = 'preview-app';

const MODE_TRANSITION_MS = 650;
const FOCUS_FLIGHT_MS = 420;
const WAVE_STAGGER_MS = 260;

export class StubEngineCore {
  mode: PrismViewMode = BOOT_MODE;
  selectedNodeId: string | null = null;
  graphRef: string | undefined;
  painted = false;
  private disposed = false;
  private readonly nodeIds = new Set(stubNodeIds());

  constructor(
    private readonly emitWire: (wire: string) => void,
    private readonly hooks: StubEngineHooks = {},
    private readonly schedule: StubSchedule = (fn, ms) => {
      setTimeout(fn, ms);
    },
  ) {}

  dispose(): void {
    this.disposed = true;
  }

  private emit(event: PrismEngineEvent): void {
    if (this.disposed) return;
    this.emitWire(serializeEngineEvent(event));
  }

  private later(ms: number, fn: () => void): void {
    this.schedule(() => {
      if (!this.disposed) fn();
    }, ms);
  }

  /** Deliver one serialized command envelope (the only inbound surface). */
  receive(wire: string): void {
    if (this.disposed) return;
    let command;
    try {
      command = parseShellCommand(wire).command;
    } catch {
      // Malformed traffic fails LOUDLY as a structured contract error — the
      // contract forbids half-applying or silently dropping (prism-shell.ts).
      this.emit({
        type: 'error',
        error: {
          code: 'CONTRACT_PARSE_FAILED',
          message: 'stub engine could not parse the inbound command envelope',
          source: 'contract',
          recoverable: true,
        },
      });
      return;
    }

    switch (command.type) {
      case 'mount': {
        this.graphRef = command.graphRef;
        this.mode = command.initialMode ?? BOOT_MODE;
        if (this.hooks.onMountRequest) {
          this.hooks.onMountRequest(command.containerId);
        } else {
          // Headless (unit-test) path: no visual to wait for.
          this.markPainted();
        }
        break;
      }
      case 'unmount': {
        this.hooks.onUnmountRequest?.();
        this.painted = false;
        this.emit({ type: 'unmounted' });
        break;
      }
      case 'set-mode': {
        this.mode = command.mode;
        this.hooks.onModeTarget?.(command.mode);
        // The event means "the scene FINISHED a mode transition" — emitted
        // after the morph settles, like the real engine will.
        this.later(MODE_TRANSITION_MS, () =>
          this.emit({ type: 'mode-changed', mode: command.mode }),
        );
        break;
      }
      case 'focus-camera': {
        const targetId =
          command.target.kind === 'hub' ? command.target.hubId : command.target.nodeId;
        this.hooks.onFocusPulse?.(targetId);
        this.later(command.animate === false ? 0 : FOCUS_FLIGHT_MS, () =>
          this.emit({ type: 'camera-focused', target: command.target }),
        );
        break;
      }
      case 'set-selection': {
        if (command.nodeId !== null && !this.nodeIds.has(command.nodeId)) {
          this.emit({
            type: 'error',
            error: {
              code: 'NODE_NOT_FOUND',
              message: `no node '${command.nodeId}' in the mounted graph`,
              source: 'node',
              recoverable: true,
              nodeId: command.nodeId,
            },
          });
          return;
        }
        this.selectedNodeId = command.nodeId;
        // THE ECHO: origin 'command' tells the shell this is its own write
        // coming back — the shell must not re-issue set-selection off it.
        this.emit({
          type: 'selection-changed',
          nodeId: command.nodeId,
          origin: 'command',
        });
        break;
      }
      case 'open-prompt-edit': {
        this.emit({ type: 'prompt-edit-opened', scope: command.scope });
        break;
      }
    }
  }

  /** The renderer calls this after the first real frame; headless mounts call
   *  it directly. Emits `mounted` and then a short scripted wave-0 hydration
   *  so the shell's build chrome + wire log see those event types in W1. */
  markPainted(): void {
    if (this.disposed || this.painted) return;
    this.painted = true;
    this.emit({ type: 'mounted', mode: this.mode, graphRef: this.graphRef });
    const waveNodes = stubNodeIds().slice(0, 3);
    this.later(WAVE_STAGGER_MS, () =>
      this.emit({ type: 'build-wave', wave: 0, status: 'started' }),
    );
    waveNodes.forEach((nodeId, i) => {
      this.later(WAVE_STAGGER_MS * (i + 2), () => {
        this.emit({ type: 'node-verified', nodeId, wave: 0 });
        this.emit({ type: 'node-mounted', nodeId, wave: 0 });
        this.hooks.onNodeMounted?.(nodeId);
      });
    });
    this.later(WAVE_STAGGER_MS * (waveNodes.length + 2), () =>
      this.emit({ type: 'build-wave', wave: 0, status: 'completed' }),
    );
  }

  /** A user click inside the stub scene (origin 'user' — never an echo). */
  userSelect(nodeId: string | null): void {
    if (this.disposed) return;
    this.selectedNodeId = nodeId;
    this.emit({ type: 'selection-changed', nodeId, origin: 'user' });
  }
}
