// Plan-output hook — guarantees every node leaving the planner carries
// concrete renderer-migration fields. The codegen prompt (§9) and verifier
// (§10) both assume `renderMode` and `cinematicPrimitives` are populated:
// this hook is the single place where defaults are applied so legacy plans
// (pre-migration) and new plans (renderMode-aware planner) emit the same
// shape.
//
// Spec anchors:
//   §6 L166: "Plan generation UNCHANGED + assigns renderMode per node".
//   §6 L171: "Knowledge graph construction … populates renderMode/
//             cinematicPrimitives from plan".
//   §7 L203: "No node ships without at least one cinematic primitive applied
//             unless explicitly flagged as `cinematicPrimitives: []` in the plan."
//   Migration rules: defaults are 'sprite' / null / null / [] / identity.

import {
  RENDER_MODE_DEFAULT,
  SCENE_POSITION_DEFAULT,
  type CinematicPrimitiveRef,
  type PrismNode,
  type RenderMode,
  type ScenePosition,
} from '@/lib/prism-graph/types';
import type { CinematicPrimitiveName } from '@/lib/prism-graph/cinematic-primitives';
import type { VerifierViolation } from './verifier';

const KNOWN_PRIMITIVE_NAMES: ReadonlySet<CinematicPrimitiveName> = new Set([
  'orbit',
  'depth-rotate',
  'dissolve-morph',
  'displacement-transition',
  'parallax-scroll',
  'magnetic-cursor',
  'particle-emerge',
  'fly-through',
  'kinetic-text',
]);

export interface PlanRendererDefaults {
  renderMode: RenderMode;
  cinematicPrimitives: CinematicPrimitiveRef[];
  scenePosition: ScenePosition;
  depthMapUrl: string | null;
  meshUrl: string | null;
}

/** Apply renderer-migration defaults additively. Never mutates the input. */
export function applyPlanRendererDefaults<T extends Partial<PrismNode>>(
  input: T,
): T & PlanRendererDefaults {
  const renderMode: RenderMode =
    (input.renderMode as RenderMode | undefined) ?? RENDER_MODE_DEFAULT;
  // §7 L203: an explicit empty array is meaningful — it is the planner
  // signalling "this node is intentionally primitive-free". Preserve it.
  // `undefined` is the legacy-plan signal that we apply the [] default to.
  const cinematicPrimitives: CinematicPrimitiveRef[] = Array.isArray(
    input.cinematicPrimitives,
  )
    ? input.cinematicPrimitives
    : [];
  const scenePosition: ScenePosition = input.scenePosition
    ? { ...SCENE_POSITION_DEFAULT, ...input.scenePosition }
    : { ...SCENE_POSITION_DEFAULT };
  const depthMapUrl: string | null = input.depthMapUrl ?? null;
  const meshUrl: string | null = input.meshUrl ?? null;

  return {
    ...input,
    renderMode,
    cinematicPrimitives,
    scenePosition,
    depthMapUrl,
    meshUrl,
  };
}

/** Validate that the plan-output renderer fields are internally consistent.
 *  This runs AFTER `applyPlanRendererDefaults` and returns violations the
 *  planner / editor can surface to the user. The verifier in `verifier.ts`
 *  handles source-code-level deviations; this handles plan-level ones. */
export function validatePlanRendererFields(
  node: Pick<
    PrismNode,
    'renderMode' | 'depthMapUrl' | 'meshUrl' | 'cinematicPrimitives'
  >,
): VerifierViolation[] {
  const out: VerifierViolation[] = [];

  if (node.renderMode === 'parallax-plane' && !node.depthMapUrl) {
    out.push({
      rule: 'PARALLAX_REQUIRES_DEPTH_MAP',
      severity: 'error',
      message:
        'renderMode "parallax-plane" requires depthMapUrl (spec §5; §6 stage 9.5)',
    });
  }

  if (node.renderMode === 'mesh' && !node.meshUrl) {
    out.push({
      rule: 'MESH_REQUIRES_MESH_URL',
      severity: 'error',
      message:
        'renderMode "mesh" requires meshUrl (spec §5; §6 stage 9.6)',
    });
  }

  for (const ref of node.cinematicPrimitives ?? []) {
    if (!KNOWN_PRIMITIVE_NAMES.has(ref.name as CinematicPrimitiveName)) {
      out.push({
        rule: 'UNKNOWN_PRIMITIVE',
        severity: 'error',
        message: `unknown cinematic primitive: ${ref.name} (spec §7 L201; CINEMATIC-PRIMITIVES-LIBRARY.md)`,
        match: ref.name,
      });
    }
  }

  return out;
}
