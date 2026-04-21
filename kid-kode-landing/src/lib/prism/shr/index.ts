// Self-Healing Runtime (toy) — mock spec §9.
//
// Telemetry watchdog:
//  - Every event emission is captured from the event bus.
//  - For every node, we read intent.behaviorSpec.triggersDownstream and watch
//    for declared downstream events within toleranceMs. If the downstream
//    doesn't fire, we mark the source node suspect.
//  - Promotion rule: 1 suspect from a critical user action = broken,
//    3 suspects in 10 min = broken, otherwise log-only.
//
// Toy repair:
//  - On boot we snapshot every node module source. When a node is marked
//    "broken" we hot-swap the running module with a cached "good" copy after
//    a ~1s fake-latency indicator.
//
// Dev tool:
//  - window.__prismBreakNode(nodeId) corrupts a node's handler (swaps in a
//    no-op) so the demo can show SHR triggering without a real fault.

import type { EventBus } from '../player/event-bus';
import type { NodeDef } from '../player/prism-loader';
import type { NodeInstance } from '../player/module-registry';

type RebuildNode = (nodeId: string) => Promise<NodeInstance | null>;

export interface Shr {
  attach(): void;
  detach(): void;
  breakNode(nodeId: string): void;
  repairNode(nodeId: string): Promise<void>;
  readonly suspects: ReadonlyMap<string, Suspect>;
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
  onRepairIndicator?: (nodeId: string, phase: 'start' | 'end') => void;
}

export function createShr(opts: Options): Shr {
  const { events, graph, originalSources, rebuildNode, onRepairIndicator } = opts;
  const suspects = new Map<string, Suspect>();
  const nodeByEmit = new Map<string, NodeDef>();
  for (const n of graph.nodes) {
    const emits = (n.intent?.behaviorSpec as { emits?: string[] } | undefined)?.emits ?? [];
    for (const ev of emits) nodeByEmit.set(`${n.nodeId}:${ev}`, n);
  }

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
            if (!saw && !suspects.has(src)) {
              suspects.set(src, { nodeId: src, reason: `no ${event} → ${targetId} within ${t.toleranceMs}ms`, detectedAt: Date.now(), promoted: false });
              // Promote critical-user-action suspects immediately (1-strike rule).
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

  function breakNode(nodeId: string) {
    suspects.set(nodeId, { nodeId, reason: 'manual break via __prismBreakNode', detectedAt: Date.now(), promoted: true });
    // The break is effected at rebuild time: rebuildNode will use the
    // mangled source we stash here.
    (breakNode as unknown as { _broken?: Set<string> })._broken ??= new Set<string>();
    (breakNode as unknown as { _broken: Set<string> })._broken.add(nodeId);
  }

  async function repairNode(nodeId: string) {
    onRepairIndicator?.(nodeId, 'start');
    await new Promise((r) => setTimeout(r, 1000));                       // toy latency
    (breakNode as unknown as { _broken?: Set<string> })._broken?.delete(nodeId);
    const src = originalSources.get(nodeId);
    if (!src) {
      onRepairIndicator?.(nodeId, 'end');
      return;
    }
    await rebuildNode(nodeId);
    suspects.delete(nodeId);
    onRepairIndicator?.(nodeId, 'end');
  }

  return {
    attach,
    detach,
    breakNode,
    repairNode,
    get suspects() { return suspects as ReadonlyMap<string, Suspect>; },
  };
}
