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
  MATERIAL_SPEC_DEFAULT,
  RENDER_MODE_DEFAULT,
  SCENE_POSITION_DEFAULT,
  receivesLightingDefault,
  type CinematicPrimitiveRef,
  type LightingSpec,
  type MaterialSpec,
  type PrismNode,
  type RenderMode,
  type ScenePosition,
} from '../../prism-graph/types';
import type { CinematicPrimitiveName } from '../../prism-graph/cinematic-primitives';
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
  // §10/§11 Material+Lighting (additive, INV-18). `receivesLighting` always
  // resolves to a concrete boolean (safe default per render mode). `materialSpec`
  // and `lightingSpec` are normalized only when present — a node without them
  // stays undefined so we never force a spec onto every node.
  receivesLighting: boolean;
  materialSpec: MaterialSpec | undefined;
  lightingSpec: LightingSpec | undefined;
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
  // §10 decision 7 — image-bearing render modes default UNLIT, meshes LIT. An
  // explicit boolean wins; otherwise the safe per-render-mode default.
  const receivesLighting: boolean =
    typeof input.receivesLighting === 'boolean'
      ? input.receivesLighting
      : receivesLightingDefault(renderMode);
  // §11 — only normalize a materialSpec when the plan supplies one (mirrors how
  // scenePosition spreads over its default). Absent → leave undefined so we do
  // NOT force a materialSpec onto every node.
  const materialSpec: MaterialSpec | undefined = input.materialSpec
    ? { ...MATERIAL_SPEC_DEFAULT, ...input.materialSpec }
    : undefined;
  // §10 — lightingSpec passes through verbatim when present; absent → undefined
  // (inherits the node's hub then the global default rig at runtime).
  const lightingSpec: LightingSpec | undefined = input.lightingSpec ?? undefined;

  return {
    ...input,
    renderMode,
    cinematicPrimitives,
    scenePosition,
    depthMapUrl,
    meshUrl,
    receivesLighting,
    materialSpec,
    lightingSpec,
  };
}

/** Validate that the plan-output renderer fields are internally consistent.
 *  This runs AFTER `applyPlanRendererDefaults` and returns violations the
 *  planner / editor can surface to the user. The verifier in `verifier.ts`
 *  handles source-code-level deviations; this handles plan-level ones. */
export function validatePlanRendererFields(
  node: Pick<
    PrismNode,
    'renderMode' | 'depthMapUrl' | 'meshUrl' | 'cinematicPrimitives' | 'meshPrimitive'
  > & { codeRef?: PrismNode['codeRef'] },
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

  // P4 3D-OBJECT (canvas-spec §5; INV-8 additive): a node carrying a
  // `meshPrimitive` renders the primitive geometry regardless of meshUrl
  // (which stays for GLBs) — the primitive IS the mesh artifact, so the
  // mesh-artifact requirement is satisfied without a meshUrl.
  //
  // CODEREF MESH (FIX2/FIX3; Law 0 "every artifact is a node"): a non-empty
  // `codeRef` (e.g. `builtin:atelier-watch`, `builtin:orrery-complication`)
  // builds the node's THREE.Object3D via the codeRef factory — a first-class
  // mesh source exactly like meshUrl / meshPrimitive. Without this exemption the
  // two real codeRef-backed mesh nodes in the live graph fail this rule and
  // BLOCK EVERY persist (the editor's save round-trip). Treat a codeRef as a
  // satisfied mesh artifact.
  const hasCodeRef = typeof node.codeRef === 'string' && node.codeRef.trim().length > 0;
  if (node.renderMode === 'mesh' && !node.meshUrl && !node.meshPrimitive && !hasCodeRef) {
    out.push({
      rule: 'MESH_REQUIRES_MESH_URL',
      severity: 'error',
      message:
        'renderMode "mesh" requires meshUrl or meshPrimitive (spec §5; §6 stage 9.6; P4 primitives)',
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
