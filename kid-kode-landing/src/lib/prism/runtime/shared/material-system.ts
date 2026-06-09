// Material system — native Three.js PBR via MeshPhysicalNodeMaterial, plus the
// per-node `receivesLighting` resolution (PRISM-CANVAS-EDITOR-SPEC §11 / §10
// decision 7, INV-8).
//
// Three material lanes:
//   • LIT MESH   → MeshPhysicalNodeMaterial (full PBR: metalness, roughness,
//                  transmission/IOR/dispersion, clearcoat, iridescence, emissive).
//   • UNLIT PLANE→ MeshBasicNodeMaterial carrying the baked texture verbatim, so
//                  lights/env NEVER alter the diffusion look (criterion 17).
//   • LIT PLANE  → MeshStandardNodeMaterial (opt-in: a plane that catches scene
//                  light, e.g. metallic text fill).
//
// Controls render from MATERIAL_CONTROL_SCHEMA (a ControlSchema — INV-5: one
// renderer for all knobs, the same type the animation catalog uses).
//
// DOM-free (INV-R12): pure material factories; no document/window.

import { Color, type Texture } from 'three';
import {
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
} from 'three/webgpu';
import {
  MATERIAL_SPEC_DEFAULT,
  receivesLightingDefault,
  type MaterialSpec,
  type PrismNode,
  type RenderMode,
} from '../../../prism-graph/types';
import type { Control, ControlSchema, ParamState } from '../../animatable/contract';

/** Merge a partial spec over the defaults so every field is defined. */
export function resolveMaterialSpec(spec?: MaterialSpec | null): Required<MaterialSpec> {
  return { ...MATERIAL_SPEC_DEFAULT, ...(spec ?? {}) } as Required<MaterialSpec>;
}

/**
 * Build a fully-configured `MeshPhysicalNodeMaterial` from a MaterialSpec. This
 * is the lit-mesh lane (and the glass/transmission lane). Scalar PBR props only;
 * TSL node augmentations (the catalog's emissive/normal nodes) compose on top.
 */
export function buildPhysicalMaterial(spec?: MaterialSpec | null): MeshPhysicalNodeMaterial {
  const s = resolveMaterialSpec(spec);
  const mat = new MeshPhysicalNodeMaterial();
  applyMaterialSpec(mat, s);
  return mat;
}

/**
 * Apply a (resolved or partial) spec onto an existing physical material in place.
 * Used both at build time and by the live material editor for real-time tuning.
 */
export function applyMaterialSpec(
  mat: MeshPhysicalNodeMaterial,
  spec?: MaterialSpec | null,
): void {
  const s = resolveMaterialSpec(spec);
  mat.color = new Color(s.baseColor);
  mat.metalness = s.metalness;
  mat.roughness = s.roughness;
  mat.transmission = s.transmission;
  mat.ior = s.ior;
  // `dispersion` is a real MeshPhysicalMaterial property in three r184.
  (mat as unknown as { dispersion: number }).dispersion = s.dispersion;
  mat.clearcoat = s.clearcoat;
  mat.clearcoatRoughness = s.clearcoatRoughness;
  mat.iridescence = s.iridescence;
  mat.iridescenceIOR = s.iridescenceIOR;
  mat.thickness = s.thickness;
  mat.emissive = new Color(s.emissive);
  mat.emissiveIntensity = s.emissiveIntensity;
  mat.envMapIntensity = s.envMapIntensity;
  mat.opacity = s.opacity;
  mat.transparent = s.opacity < 1 || s.transmission > 0;
}

/**
 * Unlit texture material — the DEFAULT for image planes (renderMode plane /
 * parallax-plane / sprite when receivesLighting is false). The baked texture is
 * shown verbatim; lights and env do not touch it, so the diffusion look is
 * preserved pixel-identical (criterion 17, the unlit half).
 */
export function buildUnlitMaterial(opts: {
  map?: Texture | null;
  color?: string;
  opacity?: number;
  transparent?: boolean;
}): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial();
  if (opts.map) mat.map = opts.map;
  if (opts.color) mat.color = new Color(opts.color);
  if (typeof opts.opacity === 'number') {
    mat.opacity = opts.opacity;
    mat.transparent = opts.transparent ?? opts.opacity < 1;
  } else if (opts.transparent) {
    mat.transparent = true;
  }
  // Unlit materials are not tone-mapped by scene lighting; keep their color exact.
  mat.toneMapped = false;
  return mat;
}

/**
 * Lit texture material — the OPT-IN lane for a plane/text fill that should catch
 * scene light (receivesLighting=true on a non-mesh node). Uses a standard node
 * material so lights + env affect it, while still showing its texture.
 */
export function buildLitTextureMaterial(opts: {
  map?: Texture | null;
  spec?: MaterialSpec | null;
}): MeshStandardNodeMaterial {
  const s = resolveMaterialSpec(opts.spec);
  const mat = new MeshStandardNodeMaterial();
  if (opts.map) mat.map = opts.map;
  mat.color = new Color(s.baseColor);
  mat.metalness = s.metalness;
  mat.roughness = s.roughness;
  mat.emissive = new Color(s.emissive);
  mat.emissiveIntensity = s.emissiveIntensity;
  mat.envMapIntensity = s.envMapIntensity;
  return mat;
}

/**
 * Resolve whether a node's built artifact participates in scene lighting.
 * Explicit `receivesLighting` wins; otherwise the safe default per render mode
 * (image planes UNLIT, meshes LIT — §10 decision 7).
 */
export function resolveReceivesLighting(
  node: Pick<PrismNode, 'receivesLighting' | 'renderMode'>,
): boolean {
  if (typeof node.receivesLighting === 'boolean') return node.receivesLighting;
  return receivesLightingDefault(node.renderMode);
}

/** Same resolution from raw fields (for callers without a full node). */
export function isLit(receivesLighting: boolean | undefined, renderMode?: RenderMode): boolean {
  if (typeof receivesLighting === 'boolean') return receivesLighting;
  return receivesLightingDefault(renderMode);
}

// ---------------------------------------------------------------------------
// Schema-driven controls (INV-5). The material editor panel renders these.
// ---------------------------------------------------------------------------

export const MATERIAL_CONTROL_SCHEMA: ControlSchema = Object.freeze([
  { id: 'baseColor', label: 'Base Color', type: 'color', default: MATERIAL_SPEC_DEFAULT.baseColor! },
  { id: 'metalness', label: 'Metalness', type: 'fader', min: 0, max: 1, step: 0.01, default: MATERIAL_SPEC_DEFAULT.metalness! },
  { id: 'roughness', label: 'Roughness', type: 'fader', min: 0, max: 1, step: 0.01, default: MATERIAL_SPEC_DEFAULT.roughness! },
  { id: 'transmission', label: 'Transmission', type: 'fader', min: 0, max: 1, step: 0.01, default: MATERIAL_SPEC_DEFAULT.transmission! },
  { id: 'ior', label: 'IOR', type: 'knob', min: 1, max: 2.5, step: 0.01, default: MATERIAL_SPEC_DEFAULT.ior! },
  { id: 'dispersion', label: 'Dispersion', type: 'fader', min: 0, max: 1, step: 0.01, default: MATERIAL_SPEC_DEFAULT.dispersion! },
  { id: 'clearcoat', label: 'Clearcoat', type: 'fader', min: 0, max: 1, step: 0.01, default: MATERIAL_SPEC_DEFAULT.clearcoat! },
  { id: 'iridescence', label: 'Iridescence', type: 'fader', min: 0, max: 1, step: 0.01, default: MATERIAL_SPEC_DEFAULT.iridescence! },
  { id: 'thickness', label: 'Thickness', type: 'knob', min: 0, max: 5, step: 0.05, default: MATERIAL_SPEC_DEFAULT.thickness! },
  { id: 'emissive', label: 'Emissive', type: 'color', default: MATERIAL_SPEC_DEFAULT.emissive! },
  { id: 'emissiveIntensity', label: 'Emissive Int.', type: 'fader', min: 0, max: 5, step: 0.05, default: MATERIAL_SPEC_DEFAULT.emissiveIntensity! },
  { id: 'envMapIntensity', label: 'Env Reflect', type: 'fader', min: 0, max: 3, step: 0.05, default: MATERIAL_SPEC_DEFAULT.envMapIntensity! },
  { id: 'opacity', label: 'Opacity', type: 'fader', min: 0, max: 1, step: 0.01, default: MATERIAL_SPEC_DEFAULT.opacity! },
] as Control[]);

const NUMERIC_MATERIAL_KEYS = [
  'metalness', 'roughness', 'transmission', 'ior', 'dispersion', 'clearcoat',
  'iridescence', 'thickness', 'emissiveIntensity', 'envMapIntensity', 'opacity',
] as const;
const COLOR_MATERIAL_KEYS = ['baseColor', 'emissive'] as const;

/** MaterialSpec → flat ParamState the schema-driven control panel binds to. */
export function materialSpecToParams(spec?: MaterialSpec | null): ParamState {
  const s = resolveMaterialSpec(spec);
  const out: ParamState = {};
  for (const k of NUMERIC_MATERIAL_KEYS) out[k] = s[k];
  for (const k of COLOR_MATERIAL_KEYS) out[k] = s[k];
  return out;
}

/** ParamState (from the control panel) → a partial MaterialSpec patch. */
export function paramsToMaterialSpec(params: ParamState): MaterialSpec {
  const out: MaterialSpec = {};
  for (const k of NUMERIC_MATERIAL_KEYS) {
    const v = params[k];
    if (typeof v === 'number') (out as Record<string, unknown>)[k] = v;
  }
  for (const k of COLOR_MATERIAL_KEYS) {
    const v = params[k];
    if (typeof v === 'string') (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
