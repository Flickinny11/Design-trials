// pointer-hue-shift — moving the pointer across the card re-lights its surface.
// MEDIUM / pointer primitive. Reads userData.pointer each seek: pointer.x maps
// to hue (color swept through the spectrum via Color.setHSL) and pointer.y maps
// to emissive intensity (lerp lo..hi). CPU-driven and observable: the subject
// material's color and emissiveIntensity track the pointer. DISTINCT from
// scroll-color-shift, which is driven by scroll. Restores the original material
// color/emissive in dispose().

import { Mesh, Color, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'hueRange', label: 'Hue Range', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'saturation', label: 'Saturation', type: 'fader', min: 0.3, max: 1, step: 0.01, default: 0.8 },
  { id: 'glow', label: 'Glow', type: 'fader', min: 0.5, max: 3, step: 0.05, default: 1.6 },
] as const;

interface MatLike extends Material {
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
}

/** First material on the subtree that exposes color/emissive we can drive. */
function findMaterial(root: Object3D): MatLike | null {
  let found: MatLike | null = null;
  root.traverse((o) => {
    if (found) return;
    const m = (o as Mesh).material;
    if (!m) return;
    const mat = (Array.isArray(m) ? m[0] : m) as MatLike;
    if (mat && (mat.color || mat.emissive)) found = mat;
  });
  return found;
}

function readPointer(userData: Record<string, unknown>): { x: number; y: number } {
  const p = userData.pointer as { x?: number; y?: number } | undefined;
  return {
    x: clamp(num(p?.x, 0.5), 0, 1),
    y: clamp(num(p?.y, 0.5), 0, 1),
  };
}

export const pointerHueShiftPrimitive: PrimitiveDefinition = {
  name: 'pointer-hue-shift',
  label: 'Pointer Hue Shift',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  description:
    'Moving the pointer across the card sweeps its color through the spectrum — cursor position re-lights the surface.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pointer-hue-shift', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mat =
        findMaterial(subject) ??
        ((subject as Mesh).material as MatLike) ??
        // Fallback: never null — guarantees observable state even for bare groups.
        (new MeshStandardMaterial() as MatLike);

      // Snapshot base material state for restoration on dispose.
      const baseColor = mat.color ? mat.color.clone() : null;
      const baseEmissive = mat.emissive ? mat.emissive.clone() : null;
      const baseEmissiveIntensity =
        typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1;

      const baseHue = 0.0; // start of the spectrum sweep
      const emissiveLo = 0.2;
      const emissiveHi = 1.0; // pre-glow factor; multiplied by `glow` control

      return {
        // Pointer-driven (continuous/stateful): no fixed timeline.
        duration: () => Infinity,
        seek: () => {
          const { x, y } = readPointer(target.userData);
          const hueRange = num(params.hueRange, 0.6);
          const sat = clamp(num(params.saturation, 0.8), 0, 1);
          const glow = num(params.glow, 1.6);

          // pointer.x sweeps the hue; light kept mid so the hue reads.
          const hue = (baseHue + x * hueRange) % 1;
          if (mat.color) mat.color.setHSL(hue < 0 ? hue + 1 : hue, sat, 0.5);
          if (mat.emissive) mat.emissive.setHSL(hue < 0 ? hue + 1 : hue, sat, 0.5);

          // pointer.y lerps emissive intensity lo..hi, scaled by glow.
          const e = (emissiveLo + (emissiveHi - emissiveLo) * y) * glow;
          if (typeof mat.emissiveIntensity === 'number') mat.emissiveIntensity = e;
          else (mat as MatLike).emissiveIntensity = e;
        },
        dispose: () => {
          if (baseColor && mat.color) mat.color.copy(baseColor);
          if (baseEmissive && mat.emissive) mat.emissive.copy(baseEmissive);
          if (typeof mat.emissiveIntensity === 'number')
            mat.emissiveIntensity = baseEmissiveIntensity;
        },
      };
    },
  ),
};
