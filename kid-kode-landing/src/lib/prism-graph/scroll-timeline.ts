// EB-07-04 — Scroll-timeline + scrollBinding consumer.
//
// Spec refs:
//   §7 SC-039  `useScrollTimeline()` returns deterministic `scrollProgress:
//              0→1` over the hub's content length; nodes with `scrollBinding?`
//              consume it.
//   §7 SC-040  Scrolling in `preview-hub` mode reads as app UI (per-element
//              response), not whole-scene movement.
//   §4         `scroll-timeline` coordinate space: `scrollProgress: 0→1`;
//              bound transforms drive per-element scroll response.
//
// This module owns the pure layer:
//   - `computeScrollProgress(scrollY, contentHeight, viewportHeight)`
//   - `applyScrollBindings(obj, bindings, progress)` — writes
//     position/rotation/scale/material.opacity onto a THREE Object3D
//
// The runtime wires these into `mountFromGraphSource.setScrollProgress`; the
// editor surfaces them via the React hook below.

import type { Material, Object3D } from 'three';
import type { Mesh } from 'three';
import type { ScrollBinding, ScrollBindingEase } from './types';

// SC-039 — deterministic scroll progress over the hub's content length.
//
// Returns 0 at the top of the hub, 1 at the bottom (where bottom is
// `contentHeight - viewportHeight`), and a linear interpolation in between.
// Clamps to [0, 1]. Returns 0 for degenerate input: contentHeight <=
// viewportHeight (no scrollable range), or any non-finite component.
export function computeScrollProgress(
  scrollY: number,
  contentHeight: number,
  viewportHeight: number,
): number {
  if (!Number.isFinite(scrollY)) return 0;
  if (!Number.isFinite(contentHeight)) return 0;
  if (!Number.isFinite(viewportHeight)) return 0;
  const range = contentHeight - viewportHeight;
  if (range <= 0) return 0;
  const raw = scrollY / range;
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return raw;
}

// SC-039 — per-node scrollBinding consumer.
//
// For each binding, interpolate `from → to` over the (clamped, eased)
// progress and write the result onto the target Object3D. The set of
// writable properties matches `ScrollBindingProperty` in `types.ts`.
//
// `opacity` walks the subtree: if the target is a Mesh with a single
// Material (the common case for prism nodes), write directly; if it's a
// Group, traverse and write every descendant Mesh's material.opacity. This
// matches how nodes are mounted today — primitives nest meshes under a
// parent Group via shared/adapter.
export function applyScrollBindings(
  obj: Object3D,
  bindings: readonly ScrollBinding[],
  progress: number,
): void {
  if (!bindings || bindings.length === 0) return;
  const p = clamp01(progress);
  for (const binding of bindings) {
    const t = applyEase(p, binding.ease);
    const value = binding.from + (binding.to - binding.from) * t;
    writeBindingValue(obj, binding.property, value);
  }
}

function writeBindingValue(
  obj: Object3D,
  property: ScrollBinding['property'],
  value: number,
): void {
  switch (property) {
    case 'translateX':
      obj.position.x = value;
      return;
    case 'translateY':
      obj.position.y = value;
      return;
    case 'translateZ':
      obj.position.z = value;
      return;
    case 'rotateX':
      obj.rotation.x = value;
      return;
    case 'rotateY':
      obj.rotation.y = value;
      return;
    case 'rotateZ':
      obj.rotation.z = value;
      return;
    case 'scale':
      obj.scale.set(value, value, value);
      return;
    case 'opacity':
      writeOpacity(obj, value);
      return;
  }
}

function writeOpacity(obj: Object3D, opacity: number): void {
  // Direct hit: the target is itself a Mesh with a material.
  const direct = asMaterialOwner(obj);
  if (direct) {
    setMaterialOpacity(direct, opacity);
    return;
  }
  // Subtree walk: write to every descendant mesh material so a node Group
  // composed of multiple meshes fades as one unit.
  obj.traverse((child) => {
    const owner = asMaterialOwner(child);
    if (owner) setMaterialOpacity(owner, opacity);
  });
}

interface MaterialOwner {
  material: Material | Material[];
}

function asMaterialOwner(obj: Object3D): MaterialOwner | null {
  const mat = (obj as unknown as { material?: Material | Material[] }).material;
  if (!mat) return null;
  return obj as unknown as MaterialOwner;
}

function setMaterialOpacity(owner: MaterialOwner, opacity: number): void {
  const m = owner.material;
  if (Array.isArray(m)) {
    for (const mat of m) {
      mat.transparent = true;
      mat.opacity = opacity;
    }
  } else {
    m.transparent = true;
    m.opacity = opacity;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function applyEase(t: number, ease: ScrollBindingEase | undefined): number {
  switch (ease) {
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'linear':
    case undefined:
    default:
      return t;
  }
}

// The React `useScrollTimeline` hook lives in
// `src/components/prism-player/useScrollTimeline.ts` so this module stays
// React-free and is consumable by the inner runtime + test setup.
