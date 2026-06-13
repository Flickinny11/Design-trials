// Prebuilt element library — drag-to-place instantiation (criterion 21).
//
// PURE + node-testable: no React, no DOM, no store imports. Given a cluster
// definition, a target hub id, and a drop anchor, it produces the array of
// `useGraphSourceStore.addNode` inputs that instantiate the cluster. The store
// wrapper (`addNodesBatch`) creates one PrismNode per member, all:
//   - tethered to `hubId` (parentHubId := hubId)            ← criterion 21 tether
//   - offset to the drop `anchor`                           ← lands where dropped
//   - stamped with ONE shared `groupId` (when ≥2 members)   ← §13 "editable like
//     any node group" + criterion 22 group semantics
//
// Every member input is the exact shape `create-element-node.ts` returns, so it
// flows through `applyPlanRendererDefaults` and the existing build path with no
// special handling. Topology is untouched (INV-1): groupId is a contains-subtree
// marker, never an edge.

import type {
  AnimationBinding,
  PrismIntent,
  PrismNode,
  ScenePosition,
} from '@/lib/prism-graph/types';
import type { ClusterMemberTemplate, ElementClusterDefinition } from './contract';

export interface PlaceAnchor {
  x: number;
  y: number;
  z: number;
}

/** An `addNode` input: a partial node that MUST name its parent hub. */
export type ClusterNodeInput = Partial<PrismNode> & { parentHubId: string };

export interface BuildClusterOptions {
  /** Pre-chosen group id (else minted). Injected for deterministic tests. */
  groupId?: string;
  /** Id generator for group + binding ids. Injected for deterministic tests.
   *  Defaults to crypto.randomUUID with a base36-random fallback. */
  genId?: () => string;
}

function defaultGenId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return Math.floor(Math.random() * 0xffffffff).toString(36) + Date.now().toString(36);
}

/** A valid, empty PrismIntent carrying just the seed caption (mirrors
 *  create-element-node.ts so the node is a well-formed graph-tethered slot). */
function seedIntent(caption: string): PrismIntent {
  return {
    caption,
    behaviorSpec: {
      interactions: [],
      apiCalls: [],
      dataBindings: [],
      emits: [],
      listens: [],
      triggersDownstream: [],
    },
    stateEffects: [],
    visualSpec: { textContent: [], layers: [] },
    contracts: { inputs: {}, outputs: {} },
  };
}

/** Offset a local member pose by the drop anchor (translation only; rotation
 *  and scale carry through unchanged). */
function offsetPose(pose: ScenePosition, anchor: PlaceAnchor): ScenePosition {
  return {
    ...pose,
    x: pose.x + anchor.x,
    y: pose.y + anchor.y,
    z: pose.z + anchor.z,
  };
}

/** Re-mint stable, per-node binding ids so two placements of the same cluster
 *  never share binding ids (ids are node-scoped but kept globally unique for
 *  hygiene). Preserves order + every other field. */
function remintBindings(
  bindings: AnimationBinding[] | undefined,
  genId: () => string,
): AnimationBinding[] | undefined {
  if (!bindings || bindings.length === 0) return undefined;
  return bindings.map((b, i) => ({ ...b, id: `ab-${genId()}`, order: b.order ?? i }));
}

/** Build one `addNode` input from a member template. */
function buildMemberInput(
  member: ClusterMemberTemplate,
  hubId: string,
  anchor: PlaceAnchor,
  groupId: string | undefined,
  genId: () => string,
): ClusterNodeInput {
  const input: ClusterNodeInput = {
    parentHubId: hubId,
    subtype: member.subtype,
    serviceTag: member.serviceTag ?? 'decor',
    renderMode: member.renderMode,
    scenePosition: offsetPose(member.pose, anchor),
    visual: {
      transform: {
        x: 0,
        y: 0,
        z: 0,
        width: member.footprint.width,
        height: member.footprint.height,
      },
      alpha: 1,
      ...(member.sourceAsset ? { sourceAsset: member.sourceAsset } : {}),
    },
    intent: seedIntent(member.caption),
    codeRef: '',
    backendRef: null,
  };

  if (groupId) input.groupId = groupId;
  if (member.meshPrimitive) input.meshPrimitive = member.meshPrimitive;
  if (member.materialSpec) input.materialSpec = member.materialSpec;
  if (member.lightingSpec) input.lightingSpec = member.lightingSpec;
  if (member.receivesLighting !== undefined) input.receivesLighting = member.receivesLighting;
  if (member.textSpec) input.textSpec = member.textSpec;
  if (member.imageSpec) input.imageSpec = member.imageSpec;
  if (member.sourceAsset) input.visual = { ...input.visual, sourceAsset: member.sourceAsset };
  if (member.meshUrl !== undefined) input.meshUrl = member.meshUrl;
  if (member.depthMapUrl !== undefined) input.depthMapUrl = member.depthMapUrl;
  if (member.scrollBinding) input.scrollBinding = member.scrollBinding;
  if (member.cinematicPrimitives) input.cinematicPrimitives = member.cinematicPrimitives;
  if (member.depthLayer) input.depthLayer = member.depthLayer;

  const bindings = remintBindings(member.animationBindings, genId);
  if (bindings) input.animationBindings = bindings;

  return input;
}

/**
 * Build the full set of `addNode` inputs that instantiate `def` at `anchor`,
 * tethered to `hubId`. The caller feeds the result to `addNodesBatch`.
 *
 * Criterion 21: every returned input names `parentHubId === hubId` and (for
 * multi-member clusters) carries the same `groupId`, so the placed nodes are a
 * grouped subtree of the current hub, visible in Galaxy (INV-7).
 */
export function buildClusterNodeInputs(
  def: ElementClusterDefinition,
  hubId: string,
  anchor: PlaceAnchor,
  opts: BuildClusterOptions = {},
): ClusterNodeInput[] {
  const genId = opts.genId ?? defaultGenId;
  // A single-member "cluster" needs no group wrapper; ≥2 members get one shared
  // groupId so transforms cascade and Ungroup works (criterion 22 semantics).
  const groupId =
    def.members.length >= 2 ? (opts.groupId ?? `grp-${genId()}`) : undefined;
  return def.members.map((m) => buildMemberInput(m, hubId, anchor, groupId, genId));
}

/** The group id a placement will use, without building inputs (lets the caller
 *  pre-select the group after `addNodesBatch`). Returns undefined for
 *  single-member clusters. */
export function clusterGroupId(
  def: ElementClusterDefinition,
  genId: () => string = defaultGenId,
): string | undefined {
  return def.members.length >= 2 ? `grp-${genId()}` : undefined;
}
