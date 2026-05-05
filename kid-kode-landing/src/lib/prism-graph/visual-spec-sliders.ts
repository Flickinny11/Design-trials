// T07 — Slider definitions for the editor's Visual tab.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L477 — "Visual tab —
// replaces static image preview with a live R3F sub-canvas that mounts the
// actual node code with sliders bound to visualSpec fields."
//
// Pure TypeScript, no React / Three.js / DOM. The React VisualPreview
// component (under `src/components/editor/panels/visual-preview/`) consumes
// this list and renders one slider per entry; the Playwright harness
// (`tests/browser/_harness/main.ts`) consumes the same list to verify the
// contract end-to-end in a real browser.
//
// The slider keys are stable identifiers used by the Visual tab to map a
// slider's current value back onto the PrismNode (see `applyVisualSpecSlider`).
//
// Per render mode:
//   - transform group (all modes): pos.x / pos.y / pos.z / rot.y / scale.uniform
//   - visual group (all modes):    visual.alpha
//   - render-mode group:
//       * parallax-plane: depth.scale (drives §10.C displacementMap reference)
//       * mesh:           mesh.rotationSpeed (drives the GLB's animation/orbit)
//   For 'sprite' / 'plane' there is no render-mode-specific slider — those modes
//   are intentionally minimal (§5).

import { SCENE_POSITION_DEFAULT, type PrismNode, type RenderMode } from './types';

export interface VisualSpecSlider {
  /** Stable identifier the editor uses to map slider values back onto the node. */
  key: string;
  /** Human label rendered next to the slider. */
  label: string;
  /** Inclusive minimum. */
  min: number;
  /** Inclusive maximum. */
  max: number;
  /** Step size for the underlying `<input type="range">`. */
  step: number;
  /** Current value taken from the node at build time. */
  value: number;
  /** Section grouping for the editor UI. */
  group: 'transform' | 'visual' | 'render-mode';
  /** Render modes for which this slider applies. `'all'` means every mode. */
  appliesTo: RenderMode[] | 'all';
}

const TRANSFORM_BASE: ReadonlyArray<Omit<VisualSpecSlider, 'value'>> = [
  { key: 'pos.x', label: 'Position X', min: -10, max: 10, step: 0.01, group: 'transform', appliesTo: 'all' },
  { key: 'pos.y', label: 'Position Y', min: -10, max: 10, step: 0.01, group: 'transform', appliesTo: 'all' },
  { key: 'pos.z', label: 'Position Z', min: -20, max: 20, step: 0.01, group: 'transform', appliesTo: 'all' },
  { key: 'rot.y', label: 'Rotate Y', min: -Math.PI, max: Math.PI, step: 0.01, group: 'transform', appliesTo: 'all' },
  { key: 'scale.uniform', label: 'Scale', min: 0.05, max: 5, step: 0.01, group: 'transform', appliesTo: 'all' },
];

const VISUAL_BASE: ReadonlyArray<Omit<VisualSpecSlider, 'value'>> = [
  { key: 'visual.alpha', label: 'Alpha', min: 0, max: 1, step: 0.01, group: 'visual', appliesTo: 'all' },
];

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v) || !Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export function buildVisualSpecSliders(node: PrismNode): VisualSpecSlider[] {
  const mode: RenderMode = node.renderMode ?? 'sprite';
  const pos = node.scenePosition ?? SCENE_POSITION_DEFAULT;

  // Read render-mode-specific values from intent.visualSpec so save+reselect
  // round-trips the user's slider state. `applyVisualSpecSlider` writes to
  // the same key, so reads must be symmetric.
  const visualSpecBag = (node.intent?.visualSpec ?? {}) as Record<string, unknown>;
  const readVisualSpec = (key: string, fallback: number): number => {
    const v = visualSpecBag[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  };

  const initialFor = (key: string): number => {
    switch (key) {
      case 'pos.x': return pos.x;
      case 'pos.y': return pos.y;
      case 'pos.z': return pos.z;
      case 'rot.y': return pos.rotationY;
      case 'scale.uniform': return pos.scaleX;
      case 'visual.alpha': return typeof node.visual.alpha === 'number' ? node.visual.alpha : 1;
      case 'depth.scale': return readVisualSpec('depth.scale', 0.5);
      case 'mesh.rotationSpeed': return readVisualSpec('mesh.rotationSpeed', 0.4);
      default: return 0;
    }
  };

  const out: VisualSpecSlider[] = [];

  for (const def of [...TRANSFORM_BASE, ...VISUAL_BASE]) {
    out.push({ ...def, value: clamp(initialFor(def.key), def.min, def.max) });
  }

  if (mode === 'parallax-plane') {
    out.push({
      key: 'depth.scale',
      label: 'Depth scale',
      min: 0,
      max: 2,
      step: 0.01,
      value: clamp(initialFor('depth.scale'), 0, 2),
      group: 'render-mode',
      appliesTo: ['parallax-plane'],
    });
  }

  if (mode === 'mesh') {
    out.push({
      key: 'mesh.rotationSpeed',
      label: 'Mesh rotation speed',
      min: 0,
      max: 4,
      step: 0.01,
      value: clamp(initialFor('mesh.rotationSpeed'), 0, 4),
      group: 'render-mode',
      appliesTo: ['mesh'],
    });
  }

  return out;
}

/**
 * Apply a slider value back onto a PrismNode (mutating).
 *
 * Used by the editor's Visual tab when the user drags a slider — the
 * resulting node is then either staged in the editor's edits store or
 * sent through `saveAndVerify` to the regen API.
 *
 * Unknown keys are silently ignored; the caller is the source of truth
 * for slider definitions, so the only path to call this with an unknown
 * key is a programming error in the consumer.
 */
export function applyVisualSpecSlider(node: PrismNode, key: string, value: number): void {
  if (!node.scenePosition) node.scenePosition = { ...SCENE_POSITION_DEFAULT };
  switch (key) {
    case 'pos.x': node.scenePosition.x = value; return;
    case 'pos.y': node.scenePosition.y = value; return;
    case 'pos.z': node.scenePosition.z = value; return;
    case 'rot.y': node.scenePosition.rotationY = value; return;
    case 'scale.uniform':
      node.scenePosition.scaleX = value;
      node.scenePosition.scaleY = value;
      node.scenePosition.scaleZ = value;
      return;
    case 'visual.alpha': (node.visual as { alpha?: number }).alpha = value; return;
    case 'depth.scale':
    case 'mesh.rotationSpeed':
      // Stored under visualSpec for codegen + regen API to pick up. The
      // shape is open per PrismVisualSpec's `[k: string]: unknown` index.
      (node.intent.visualSpec as Record<string, unknown>)[key] = value;
      return;
    default:
      return;
  }
}
