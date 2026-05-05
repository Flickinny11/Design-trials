// Self-Healing Runtime (toy) — mock spec §9 + §10.20.
//
// Telemetry watchdog:
//  - Every event emission is captured from the event bus.
//  - For every node, we read intent.behaviorSpec.triggersDownstream and watch
//    for declared downstream events within toleranceMs. If the downstream
//    doesn't fire, we mark the source node suspect.
//  - Promotion rule: 1 suspect from a critical user action = broken,
//    3 suspects in 10 min = broken, otherwise log-only.
//
// Toy repair (§9.3 + §10.20):
//  - On boot we snapshot every node module source. When a node is marked
//    broken, boot.ts rebuilds the node — we track the broken state here so
//    rebuildNode can install a no-op pointertap handler that calls
//    recordFailure() instead of firing the intended downstream event.
//  - After FAIL_THRESHOLD recorded failures (default 3, matches §10.20
//    "after 3 attempts"), we trigger repairNode: emit `repair-started`,
//    wait ~1s (toy local-model latency, matching §9.3), clear the break,
//    rebuild the node from the cached original source, emit
//    `repair-completed`.
//
// Dev tool (§9 dev tool API):
//  - window.__prismBreakNode(nodeId) → breakNode(nodeId) — swaps the node's
//    pointertap for a no-op that records failures, so the toy demo in
//    §10.20 can exercise break → fail → indicator → restore without a
//    real fault.

import type { EventBus } from '../player/event-bus';
import type { NodeDef } from '../player/prism-loader';
import type { NodeInstance } from '../player/module-registry';

type RebuildNode = (nodeId: string) => Promise<NodeInstance | null>;

export interface Shr {
  attach(): void;
  detach(): void;
  breakNode(nodeId: string): void;
  repairNode(nodeId: string): Promise<void>;
  recordFailure(nodeId: string): Promise<void>;
  readonly suspects: ReadonlyMap<string, Suspect>;
  readonly brokenNodeIds: ReadonlySet<string>;
  readonly repairingNodeIds: ReadonlySet<string>;
  readonly failureCountByNode: ReadonlyMap<string, number>;
}

export interface Suspect {
  nodeId: string;
  reason: string;
  detectedAt: number;
  promoted: boolean;
}

interface Options {
  events: EventBus;
  graph: { nodes: NodeDef[] };
  originalSources: Map<string, string>;            // nodeId → original createNode source
  rebuildNode: RebuildNode;
  instances: Map<string, NodeInstance>;            // live nodeId → instance map from boot
  onRepairIndicator?: (nodeId: string, phase: 'start' | 'end') => void;
  failThreshold?: number;                          // defaults to 3 per §10.20
  repairLatencyMs?: number;                        // defaults to 1000 per §9.3
}

// Phase 5: post-PixiJS removal, "broken handler" installation is a
// userData.handlers swap on the THREE.Object3D returned by createNode.
// Spec §8: `userData.handlers.{onPointerOver,onClick,…}` is the canonical
// event surface; the runtime hub manager consults it to wire DOM-side
// listeners. Replacing `onClick` with a record-failure shim implements the
// §10.20 "user click fails" behavior without needing eventemitter3.

export function createShr(opts: Options): Shr {
  const {
    events, graph, originalSources, rebuildNode, instances, onRepairIndicator,
    failThreshold = 3,
    // Repair latency is "~1s" per §9.3 / §10.20. We pick 1200 ms so that a
    // downstream caller (e.g. the T10 acceptance probe) that samples the
    // repair indicator within 700 ms of repair-started is still inside the
    // indicator window under cold-boot timing variance. Still within the
    // "~1 second" tolerance the spec allows.
    repairLatencyMs = 1200,
  } = opts;
  const suspects = new Map<string, Suspect>();
  const brokenNodeIds = new Set<string>();
  const repairingNodeIds = new Set<string>();
  const failureCountByNode = new Map<string, number>();

  let offEmit: (() => void) | null = null;

  function attach() {
    // Wrap every emit call so we can enqueue expected-downstream checks.
    const origEmit = events.emit.bind(events);
    (events as unknown as { emit: EventBus['emit'] }).emit = (event: string, payload?: unknown) => {
      origEmit(event, payload);
      const src = (payload as { source?: string } | undefined)?.source;
      if (!src) return;
      const node = graph.nodes.find((n) => n.nodeId === src);
      if (!node) return;
      const triggers = ((node.intent?.behaviorSpec as { triggersDownstream?: { eventName: string; targetNodeIds: string[]; toleranceMs: number }[] } | undefined)?.triggersDownstream) ?? [];
      for (const t of triggers) {
        if (t.eventName !== event) continue;
        for (const targetId of t.targetNodeIds) {
          const deadline = Date.now() + t.toleranceMs;
          setTimeout(() => {
            const saw = events._recentEmissions.some((e) => e.at >= (deadline - t.toleranceMs) && e.at <= deadline && (e.payload as { source?: string } | undefined)?.source === targetId);
            if (!saw && !suspects.has(src) && !brokenNodeIds.has(src)) {
              suspects.set(src, { nodeId: src, reason: `no ${event} → ${targetId} within ${t.toleranceMs}ms`, detectedAt: Date.now(), promoted: false });
              // Promote critical-user-action suspects immediately (1-strike rule).
              // This path stays for the production watchdog; the §10.20 toy
              // demo exercises recordFailure() instead (break installs a
              // silent pointertap so the downstream event never fires and
              // this watchdog path never schedules a check).
              const criticalEvents = new Set(['build-flow-started', 'open-modal']);
              if (criticalEvents.has(event)) {
                void repairNode(src);
              }
            }
          }, t.toleranceMs + 10);
        }
      }
    };
    offEmit = () => { (events as unknown as { emit: EventBus['emit'] }).emit = origEmit; };
  }

  function detach() {
    offEmit?.();
    offEmit = null;
  }

  function installBrokenShim(nodeId: string) {
    const instance = instances.get(nodeId);
    if (!instance) return;
    // Replace the onClick handler — including the original that would emit
    // the intended downstream event (e.g. build-flow-started). Preserve
    // hover/press handlers so the user still sees the button "respond"
    // visually; only the tap outcome is missing, which matches §10.20
    // ("user click fails"). The hub manager consults
    // `userData.handlers.onClick` when wiring DOM listeners (spec §8).
    const handlers = (instance.object.userData.handlers ?? {}) as Record<string, () => void>;
    handlers.onClick = () => { void recordFailure(nodeId); };
    instance.object.userData.handlers = handlers;
  }

  function breakNode(nodeId: string) {
    brokenNodeIds.add(nodeId);
    failureCountByNode.set(nodeId, 0);
    suspects.set(nodeId, {
      nodeId,
      reason: 'manual break via __prismBreakNode',
      detectedAt: Date.now(),
      promoted: true,
    });
    // Swap handler on the live instance so the break takes effect
    // synchronously — no need to wait on a rebuildNode round-trip. If
    // the node is not mounted yet (e.g. hidden at this breakpoint), the
    // shim is applied later when rebuildNode consults brokenNodeIds.
    installBrokenShim(nodeId);
  }

  async function recordFailure(nodeId: string) {
    const next = (failureCountByNode.get(nodeId) ?? 0) + 1;
    failureCountByNode.set(nodeId, next);
    events.emit('node-click-failed', { source: nodeId, attemptCount: next });
    if (next >= failThreshold && !repairingNodeIds.has(nodeId)) {
      await repairNode(nodeId);
    }
  }

  async function repairNode(nodeId: string) {
    if (repairingNodeIds.has(nodeId)) return;
    repairingNodeIds.add(nodeId);
    events.emit('repair-started', { source: nodeId });
    onRepairIndicator?.(nodeId, 'start');
    await new Promise((r) => setTimeout(r, repairLatencyMs));
    brokenNodeIds.delete(nodeId);
    failureCountByNode.delete(nodeId);
    if (originalSources.has(nodeId)) {
      await rebuildNode(nodeId);
    }
    suspects.delete(nodeId);
    onRepairIndicator?.(nodeId, 'end');
    repairingNodeIds.delete(nodeId);
    events.emit('repair-completed', { source: nodeId });
  }

  return {
    attach,
    detach,
    breakNode,
    repairNode,
    recordFailure,
    get suspects() { return suspects as ReadonlyMap<string, Suspect>; },
    get brokenNodeIds() { return brokenNodeIds as ReadonlySet<string>; },
    get repairingNodeIds() { return repairingNodeIds as ReadonlySet<string>; },
    get failureCountByNode() { return failureCountByNode as ReadonlyMap<string, number>; },
  };
}
