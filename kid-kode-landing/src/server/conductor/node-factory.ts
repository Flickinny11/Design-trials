// PRISM SHELL — CONDUCTOR NODE FACTORY (SHELL W5, 2026-07-04)
//
// The certified node-authoring path, server-side (W5-D1 / lock H). A blueprint
// node (WHAT to render — data) becomes a schema-complete PrismNode through the
// SAME discipline the editor's node-agent uses:
//   1. The additive STYLING slice (textSpec | meshPrimitive + materialSpec +
//      receivesLighting) is filtered through the EXACT `APPLYABLE_NODE_FIELDS`
//      allowlist (`sanitizeAdditive`, mirroring apply-plan.ts:sanitizePatch) —
//      no field outside the additive set can ride in, and no code can (I10,
//      INV-NEV2-3).
//   2. `applyPlanRendererDefaults` seeds the renderer-migration fields (the
//      same call the store's addNode runs on every new node).
//   3. `validatePlanRendererFields` — the schema-completeness gate the
//      /api/prism/regen persist route runs — must pass with zero errors, or
//      the node routes to the Conductor repair loop before the graph is saved.
//
// The structural scaffolding (identity + minimal visual/intent + renderMode +
// scenePosition) is node CREATION, exactly as the editor's addNode mints it —
// the allowlist governs edits to the additive slice, not the node's identity.
//
// Rendering is asset-free (W5-D2): `text` render mode → real MSDF glyphs with
// Direction-palette fills; `mesh` render mode → a tinted meshPrimitive PBR
// solid. Both render deterministically offline (no diffusion bake).

import type {
  PrismNode,
  PrismIntent,
  ScenePosition,
  MaterialSpec,
  TextSpec,
  MeshPrimitive,
  CinematicPrimitiveRef,
} from '../../lib/prism-graph/types';
import { SCENE_POSITION_DEFAULT } from '../../lib/prism-graph/types';
import { APPLYABLE_NODE_FIELDS } from '../../lib/prompt-edit/contract';
import {
  applyPlanRendererDefaults,
  validatePlanRendererFields,
} from '../../lib/prism/codegen/plan-output-hook';
import type { VerifierViolation } from '../../lib/prism/codegen/verifier';
import type { BlueprintNode, ColorRole } from './blueprint';
import { materialForFamily, type ResolvedDirection } from './directions';

/** Strip any field not on the additive allowlist (INV-NEV2-3 / W5-D1). Mirror
 *  of apply-plan.ts:sanitizePatch — the Conductor's styling slice is held to
 *  the identical discipline as a prompt-edit patch. */
export function sanitizeAdditive(
  patch: Partial<PrismNode>,
  skipped: string[],
): Partial<PrismNode> {
  const out: Partial<PrismNode> = {};
  for (const k of Object.keys(patch) as Array<keyof PrismNode>) {
    if ((APPLYABLE_NODE_FIELDS as ReadonlyArray<keyof PrismNode>).includes(k)) {
      (out as Record<string, unknown>)[k as string] = patch[k];
    } else {
      skipped.push(String(k));
    }
  }
  return out;
}

// ── Color helpers (contrast-aware palette resolution) ─────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** The palette tone with the best contrast against the surface — text always
 *  reads (light on dark, dark on light). */
function contrastTone(direction: ResolvedDirection): string {
  const { primary, secondary, surface } = direction.palette;
  const bgL = relLuminance(surface);
  const candidates = [secondary, primary, '#f4f1ea', '#0b0b10'];
  let best = candidates[0];
  let bestGap = -1;
  for (const c of candidates) {
    const gap = Math.abs(relLuminance(c) - bgL);
    if (gap > bestGap) {
      bestGap = gap;
      best = c;
    }
  }
  return best;
}

/** A subtly elevated panel tone — a content card lifts off the surface without
 *  becoming the accent. */
function panelTone(direction: ResolvedDirection): string {
  const { surface, secondary } = direction.palette;
  return relLuminance(surface) < 0.5 ? mix(surface, secondary, 0.16) : mix(surface, '#000000', 0.1);
}

/** Resolve a blueprint color role to a concrete hex, contrast-aware for text. */
function resolveColor(
  role: ColorRole,
  direction: ResolvedDirection,
  opts: { forText?: boolean; forPanel?: boolean } = {},
): string {
  if (opts.forText) return role === 'accent' ? direction.palette.accent : contrastTone(direction);
  if (opts.forPanel) return panelTone(direction);
  return direction.palette[role];
}

// ── Node authoring ────────────────────────────────────────────────────────────

/** A text node's fit font size — MSDF text at renderMode:'text' is NOT
 *  scale-to-fit by the factory, so we size it to fit the envelope width in
 *  scene units (avg glyph advance ≈ 0.55·fontSize). Capped at the authored
 *  size so short text stays at its intended scale. */
function fitFontSize(content: string, envelopeWidth: number, authored: number): number {
  const len = Math.max(content.length, 1);
  const fit = envelopeWidth / (len * 0.55);
  return Math.max(0.14, Math.min(authored, fit));
}

function fullScenePosition(p: Partial<ScenePosition>): ScenePosition {
  return { ...SCENE_POSITION_DEFAULT, ...p };
}

/** Minimal-but-real intent scaffolding. Behavior wiring is honest (emits/
 *  listens) so the behavioral verifier can trace CTA → nav. */
function buildIntent(bn: BlueprintNode): PrismIntent {
  const emits = bn.emits ?? [];
  return {
    caption: bn.caption,
    behaviorSpec: {
      interactions: [],
      apiCalls: [],
      dataBindings: [],
      emits,
      listens: [],
      triggersDownstream: emits.map((e) => ({ eventName: e, targetNodeIds: [] })),
    },
    stateEffects: [],
    visualSpec: { textContent: [], layers: [] },
    contracts: { inputs: {}, outputs: {} },
  };
}

export interface AuthoredNode {
  node: PrismNode;
  violations: VerifierViolation[];
  /** Additive fields the allowlist dropped (proof the discipline held — should
   *  always be empty for the Conductor's own styling, but surfaced for audit). */
  skippedFields: string[];
}

/** Author one schema-complete PrismNode from a blueprint node. */
export function authorNode(
  bn: BlueprintNode,
  hubId: string,
  direction: ResolvedDirection,
): AuthoredNode {
  const skipped: string[] = [];

  // The additive STYLING slice — held to the allowlist.
  let styling: Partial<PrismNode> = {};
  let renderMode: PrismNode['renderMode'];

  if (bn.render.kind === 'text') {
    renderMode = 'text';
    const color = resolveColor(bn.render.colorRole, direction, { forText: true });
    // Only the pre-baked Inter-400 MSDF atlas ships with the runtime; a
    // non-core weight (e.g. 700) would go to the async bake API and stall in a
    // headless/dev preview. So we render at weight 400 and express hierarchy
    // through SIZE (fitFontSize), never a heavier atlas (guaranteed to render).
    const textSpec: TextSpec = {
      content: bn.render.content.slice(0, 240),
      fontFamily: 'Inter',
      fontSize: fitFontSize(bn.render.content, bn.envelope.width, bn.render.fontSize),
      fontWeight: 400,
      align: bn.render.align,
      fill: { kind: 'solid', color },
      // Unlit MSDF text renders its fill at ~44% (emissive-only), which is dim
      // against the dark ground; a self-color glow drives the glyph
      // emissiveIntensity up so headlines read BRIGHT and hue-faithful (never
      // metallic — receivesLighting stays off, its default for text).
      glow: { color, intensity: 1.6 },
    };
    styling = { textSpec };
  } else {
    // 3D PRIMITIVES with a real materialSpec. The runtime mounts with
    // `nodeMaterials:false`, so a `plane` node's material ignores materialSpec
    // (it takes the legacy blank-white path) — but the `mesh`+meshPrimitive
    // path ALWAYS builds a MeshPhysicalNodeMaterial from the spec. So shapes are
    // authored as meshes, and made EMISSIVE-forward with LOW metalness: a highly
    // metallic body reflects the near-black studio env and reads dark, whereas a
    // low-metal / high-emissive body glows its palette tone as a solid, bright
    // form against the board's dark ground (W5-D2).
    renderMode = 'mesh';
    const meshPrimitive: MeshPrimitive = { kind: bn.render.primitive, params: bn.render.params };
    const forPanel = bn.subtype === 'content-card';
    const baseColor = resolveColor(bn.render.colorRole, direction, { forPanel });
    let materialSpec: MaterialSpec;
    if (bn.subtype === 'primary-cta') {
      materialSpec = { baseColor: direction.palette.accent, metalness: 0.1, roughness: 0.4, emissive: direction.palette.accent, emissiveIntensity: 0.9 };
    } else if (bn.subtype === 'hero-showpiece') {
      materialSpec = { baseColor: direction.palette.accent, metalness: 0.15, roughness: 0.35, clearcoat: 0.4, emissive: direction.palette.accent, emissiveIntensity: 0.8 };
    } else {
      // Content panels keep the board's material family (so the family is
      // demonstrably expressed, §11.3) but self-glow enough to read as cards.
      materialSpec = { ...materialForFamily(direction.materialFamily, baseColor), emissive: baseColor, emissiveIntensity: 0.5 };
    }
    styling = { meshPrimitive, materialSpec, receivesLighting: true };
  }

  // Prove the allowlist discipline (W5-D1): the styling slice carries only
  // additive fields. Anything else would be dropped + audited.
  const sanitized = sanitizeAdditive(styling, skipped);

  // §7 L203 — mesh objects carry a gentle in-place `depth-rotate` (the board's
  // motion character); text stays primitive-free for legibility. The motion is
  // also load-bearing for the runtime's temporal post-pass: a slowly-rotating
  // solid keeps re-rendering fresh, so the shape reads bright rather than being
  // crushed by static accumulation — a real runtime behaviour (W5-D2).
  const cinematicPrimitives: CinematicPrimitiveRef[] =
    bn.render.kind === 'mesh'
      ? [{ name: 'depth-rotate', params: { speed: 0.25 }, trigger: 'load' }]
      : [];

  // Structural scaffolding (node identity — creation, not an edit).
  const base: Partial<PrismNode> = {
    nodeId: bn.id,
    subtype: bn.subtype,
    parentHubId: hubId,
    serviceTag: 'static',
    visual: {
      transform: {
        x: 0,
        y: 0,
        width: bn.envelope.width,
        height: bn.envelope.height,
        z: 1,
      },
    },
    intent: buildIntent(bn),
    codeRef: '',
    backendRef: null,
    renderMode,
    scenePosition: fullScenePosition(bn.scenePosition),
    cinematicPrimitives,
    ...sanitized,
  };

  // Certified gate: seed renderer defaults, then assert schema-completeness.
  const withDefaults = applyPlanRendererDefaults(base) as PrismNode;
  const violations = validatePlanRendererFields(withDefaults);

  return { node: withDefaults, violations, skippedFields: skipped };
}
