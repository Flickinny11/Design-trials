// T04 — Plan-output hook (spec §6 L166, L171; §7 L203).
// Populates renderer-specific defaults on plan output so downstream codegen
// always sees both `renderMode` and `cinematicPrimitives` populated.
// Stub signatures land alongside failing tests; impl in step 7.

import type {
  CinematicPrimitiveRef,
  PrismNode,
  RenderMode,
  ScenePosition,
} from '@/lib/prism-graph/types';
import type { VerifierViolation } from './verifier';

export interface PlanRendererDefaults {
  renderMode: RenderMode;
  cinematicPrimitives: CinematicPrimitiveRef[];
  scenePosition: ScenePosition;
  depthMapUrl: string | null;
  meshUrl: string | null;
}

export function applyPlanRendererDefaults<T extends Partial<PrismNode>>(
  _input: T,
): T & PlanRendererDefaults {
  throw new Error('T04 stub - applyPlanRendererDefaults not implemented');
}

export function validatePlanRendererFields(
  _node: Pick<PrismNode, 'renderMode' | 'depthMapUrl' | 'meshUrl' | 'cinematicPrimitives'>,
): VerifierViolation[] {
  throw new Error('T04 stub - validatePlanRendererFields not implemented');
}
