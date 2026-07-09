// PRISM SHELL — CONDUCTOR GRAPH ASSEMBLER (SHELL W5, 2026-07-04)
//
// Turns a BuildBlueprint into a real GraphSource the Prism runtime mounts:
// per-hub PrismHubs (background = Direction surface tone), schema-complete
// PrismNodes authored through the certified path (node-factory), the blueprint
// edges, and exactly one PrismRootNode (App_Name_World, SC-006 / RA-07).
//
// The assembler emits nodes in small config-bounded batches (lock H) — one
// batch per hub — so the Conductor can stream per-batch hydration evidence
// and interrupt between batches. It returns per-node violations so the
// orchestrator can route a failing node to repair before the graph is saved.

import type {
  GraphSource,
  PrismHub,
  PrismNode,
  PrismEdge,
} from '../../lib/prism-graph/types';
import type { PrismRootNode } from '../../lib/prism-graph/root-node';
import type { VerifierViolation } from '../../lib/prism/codegen/verifier';
import type { BlueprintNode, BuildBlueprint } from './blueprint';
import type { ResolvedDirection } from './directions';
import { authorNode } from './node-factory';

export interface AssembledHubBatch {
  hub: PrismHub;
  nodes: PrismNode[];
  /** nodeId → violations (empty when the node passed the completeness gate). */
  violationsByNode: Record<string, VerifierViolation[]>;
  skippedFieldsByNode: Record<string, string[]>;
}

export interface AssembledGraph {
  graph: GraphSource;
  batches: AssembledHubBatch[];
}

function buildHub(
  hubId: string,
  title: string,
  direction: ResolvedDirection,
  renderMode?: PrismHub['renderMode'],
): PrismHub {
  return {
    hubId,
    title,
    // W-2D — the planner's composition-mode decision rides onto the hub
    // (additive; absent = '3d' by the read-side default).
    ...(renderMode === '2d' ? { renderMode } : {}),
    layout: {
      viewportWidth: 1920,
      viewportHeight: 1080,
      contentHeight: 1080,
      // The board's darkest tone is the page ground (nodes read against it).
      backgroundColor: direction.palette.surface,
    },
  };
}

/** W-2D — style a blueprint node for a FLAT hub: the conductor reads the
 *  hub's renderMode and authors 2d-appropriate placement (z + tilt flattened
 *  at the SOURCE, before the certified node path). 3D accents stay legal —
 *  a mesh render keeps its geometry; only its composition placement is flat. */
function flattenBlueprintNodeFor2d(bn: BlueprintNode): BlueprintNode {
  const sp = bn.scenePosition ?? {};
  return {
    ...bn,
    scenePosition: { ...sp, z: 0, rotationX: 0, rotationY: 0 },
  };
}

/** Build the App_Name_World root node (SC-006) as real graph data (D1). */
function buildRootNode(
  blueprint: BuildBlueprint,
  direction: ResolvedDirection,
  hubs: PrismHub[],
  nodes: PrismNode[],
  ts: number,
): PrismRootNode {
  return {
    appNameWorldId: 'app-world-root',
    spec: {
      name: blueprint.appName,
      summary: blueprint.summary,
      goals: direction.tone,
    },
    designSpec: {
      themeId: direction.id ?? 'custom',
      palette: {
        primary: direction.palette.primary,
        secondary: direction.palette.secondary,
        accent: direction.palette.accent,
        surface: direction.palette.surface,
      },
      typography: {
        display: direction.typeDisplay,
        text: direction.typeText,
        motion: direction.motion,
      },
    },
    buildPlan: {
      strategy: 'conductor-v1',
      stages: ['plan', 'build', 'verify'],
    },
    memoryLog: [
      { ts, kind: 'conductor', body: `Conductor authored ${nodes.length} nodes across ${hubs.length} hubs (${blueprint.origin}).` },
    ],
    hubRegistry: hubs.map((h) => ({ hubId: h.hubId, role: h.hubId === 'hub-home' ? 'home' : 'section' })),
    nodeRegistry: nodes.map((n) => ({ nodeId: n.nodeId, hubId: n.parentHubId, subtype: n.subtype })),
    globalDependencies: [],
    validationRules: [
      { id: 'schema-complete', expression: 'every node passes validatePlanRendererFields', severity: 'error' },
      { id: 'direction-conformance', expression: 'palette matches chosen Direction Board', severity: 'error' },
    ],
    aiRoutingRules: [],
    capabilityRefs: [],
  };
}

/** Assemble the full graph. `ts` is a caller-supplied timestamp (workflow-safe;
 *  no Date.now here so the caller controls determinism). */
export function assembleGraph(
  blueprint: BuildBlueprint,
  direction: ResolvedDirection,
  ts: number,
): AssembledGraph {
  const batches: AssembledHubBatch[] = [];
  const allHubs: PrismHub[] = [];
  const allNodes: PrismNode[] = [];

  for (const bh of blueprint.hubs) {
    const hub = buildHub(bh.hubId, bh.title, direction, bh.renderMode);
    const is2d = bh.renderMode === '2d';
    const nodes: PrismNode[] = [];
    const violationsByNode: Record<string, VerifierViolation[]> = {};
    const skippedFieldsByNode: Record<string, string[]> = {};
    for (const rawBn of bh.nodes) {
      // W-2D — flat hubs get flat authoring (z/tilt zeroed at the source).
      const bn = is2d ? flattenBlueprintNodeFor2d(rawBn) : rawBn;
      const { node, violations, skippedFields } = authorNode(bn, bh.hubId, direction);
      nodes.push(node);
      violationsByNode[node.nodeId] = violations;
      if (skippedFields.length > 0) skippedFieldsByNode[node.nodeId] = skippedFields;
    }
    allHubs.push(hub);
    allNodes.push(...nodes);
    batches.push({ hub, nodes, violationsByNode, skippedFieldsByNode });
  }

  const edges: PrismEdge[] = blueprint.edges.map((e) => ({
    from: e.from,
    to: e.to,
    type: e.type,
    event: e.event,
  }));

  const rootNode = buildRootNode(blueprint, direction, allHubs, allNodes, ts);

  const graph: GraphSource = {
    hubs: allHubs,
    nodes: allNodes,
    edges,
    rootNodes: [rootNode],
  };

  return { graph, batches };
}
