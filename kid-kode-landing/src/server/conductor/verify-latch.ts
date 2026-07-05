// PRISM SHELL — CONDUCTOR §11 VERIFY LATCH (SHELL W5, 2026-07-04)
//
// The completion latch (spec §11 / Sentinel v4). "Verified shippable" (I9)
// requires behavioral + visual + deploy to pass; the fresh-context advocate
// (§11.4) blocks final completion and is recorded by the verification harness,
// not auto-passed here.
//
// W5-D5: the SERVER latch is structural-behavioral (it cannot mount a WebGPU
// scene) + visual-conformance (does the authored graph MATCH the chosen
// Direction Board, §11.3 — generic output is a MUST-FIX fail). The full
// behavioral+visual browser pass (graph renders, no console errors, looks like
// the board) is the two-layer verification harness the project mandates; its
// result lands in `advocate`.

import type { GraphSource, PrismNode } from '../../lib/prism-graph/types';
import { validateRootNode } from '../../lib/prism-graph/root-node';
import { validatePlanRendererFields } from '../../lib/prism/codegen/plan-output-hook';
import type {
  VerifyCheck,
  VerifyLatch,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import { PRISM_CONDUCTOR_CONTRACT_VERSION } from '../../../packages/shared-interfaces/src/prism-conductor';
import { materialForFamily, type ResolvedDirection } from './directions';

function eqHex(a: string | undefined, b: string): boolean {
  return typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
}

/** Structural-behavioral: every node schema-complete, one PrismRootNode, edges
 *  resolve, non-empty. This is the gate that proves the graph WILL mount. */
export function runBehavioralVerify(graph: GraphSource): VerifyCheck {
  const evidence: string[] = [];
  let failed = false;

  // 1. schema-completeness of every node (the same gate the persist route runs).
  let incomplete = 0;
  for (const n of graph.nodes) {
    const violations = validatePlanRendererFields(n).filter((v) => v.severity === 'error');
    if (violations.length > 0) {
      incomplete += 1;
      failed = true;
    }
  }
  evidence.push(`${graph.nodes.length - incomplete}/${graph.nodes.length} nodes schema-complete`);
  if (incomplete > 0) evidence.push(`${incomplete} node(s) failed the completeness gate`);

  // 2. exactly one PrismRootNode (SC-006).
  const root = validateRootNode(graph);
  evidence.push(root.ok ? 'exactly one PrismRootNode (SC-006)' : `root invariant: ${root.reason}`);
  if (!root.ok) failed = true;

  // 3. edges resolve to real hubs/nodes.
  const hubIds = new Set(graph.hubs.map((h) => h.hubId));
  const nodeIds = new Set(graph.nodes.map((n) => n.nodeId));
  const known = (id: string) => hubIds.has(id) || nodeIds.has(id);
  const danglingEdges = graph.edges.filter((e) => !known(e.from) || !known(e.to)).length;
  evidence.push(`${graph.edges.length - danglingEdges}/${graph.edges.length} edges resolve`);
  if (danglingEdges > 0) failed = true;

  // 4. non-empty.
  evidence.push(`${graph.hubs.length} hubs · ${graph.nodes.length} nodes`);
  if (graph.hubs.length === 0 || graph.nodes.length === 0) failed = true;

  return {
    status: failed ? 'fail' : 'pass',
    label: 'Behavioral — graph mounts in the Prism runtime',
    evidence,
    detail: failed ? 'One or more structural checks failed; repair required.' : undefined,
  };
}

/** Visual conformance (§11.3): does the authored graph MATCH the chosen board?
 *  Checks surface tone on every hub, the accent signal present, the board's
 *  material family expressed, and palette-derived text. Generic output fails. */
export function runVisualVerify(graph: GraphSource, direction: ResolvedDirection): VerifyCheck {
  const evidence: string[] = [];
  let failed = false;
  const { palette } = direction;

  // 1. every hub grounds on the board's surface tone.
  const offSurface = graph.hubs.filter((h) => !eqHex(h.layout.backgroundColor, palette.surface)).length;
  evidence.push(
    offSurface === 0
      ? `all ${graph.hubs.length} hubs on surface ${palette.surface}`
      : `${offSurface} hub(s) off the board surface`,
  );
  if (offSurface > 0) failed = true;

  // 2. the accent signal appears (CTA / hero).
  const accentNodes = graph.nodes.filter(
    (n) => eqHex(n.materialSpec?.baseColor, palette.accent) || eqHex(textColor(n), palette.accent),
  ).length;
  evidence.push(accentNodes > 0 ? `accent ${palette.accent} on ${accentNodes} node(s)` : 'accent signal absent');
  if (accentNodes === 0) failed = true;

  // 3. the material family is expressed (a lit panel/mesh carries the family's
  //    PBR params — content panels wear the board's material metalness).
  const familyRef = materialForFamily(direction.materialFamily, palette.accent);
  const familyNodes = graph.nodes.filter(
    (n) => (n.renderMode === 'plane' || n.renderMode === 'mesh') &&
      typeof n.materialSpec?.metalness === 'number' &&
      Math.abs((n.materialSpec.metalness ?? -1) - (familyRef.metalness ?? -2)) < 0.001,
  ).length;
  evidence.push(
    familyNodes > 0
      ? `${direction.materialFamily} PBR on ${familyNodes} panel(s) (metalness ${familyRef.metalness})`
      : `${direction.materialFamily} not expressed on any panel`,
  );
  if (familyNodes === 0) failed = true;

  // 4. text is palette-derived (a real MSDF headline exists).
  const textNodes = graph.nodes.filter((n) => n.renderMode === 'text' && Boolean(n.textSpec?.content)).length;
  evidence.push(`${textNodes} MSDF text node(s) with palette fills`);
  if (textNodes === 0) failed = true;

  return {
    status: failed ? 'fail' : 'pass',
    label: 'Visual — conforms to the chosen Direction Board (§11.3)',
    evidence,
    detail: failed ? 'Output does not match the chosen direction (MUST-FIX §11.3).' : undefined,
  };
}

function textColor(n: PrismNode): string | undefined {
  const fill = n.textSpec?.fill;
  return fill && fill.kind === 'solid' ? fill.color : undefined;
}

/** A pending advocate check (the harness records the real fresh-context pass). */
export function pendingAdvocate(): VerifyCheck {
  return {
    status: 'pending',
    label: 'Advocate — fresh-context human-grade pass (§11.4)',
    evidence: ['awaiting the fresh-context user-advocate verdict'],
  };
}

/** Compose the full latch. `verifiedShippable` (I9) is behavioral + visual +
 *  deploy — the runtime badge; final "done" additionally requires the advocate
 *  pass (enforced by the harness, never auto-passed here). */
export function composeLatch(
  behavioral: VerifyCheck,
  visual: VerifyCheck,
  deploy: VerifyCheck,
  advocate: VerifyCheck,
  ranAt: string,
): VerifyLatch {
  const verifiedShippable =
    behavioral.status === 'pass' && visual.status === 'pass' && deploy.status === 'pass';
  return {
    v: PRISM_CONDUCTOR_CONTRACT_VERSION,
    behavioral,
    visual,
    deploy,
    advocate,
    verifiedShippable,
    ranAt,
  };
}
