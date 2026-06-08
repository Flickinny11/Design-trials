// defocus-pulse — the card breathes in and out of focus on a loop. A soft
// defocus proxy (no real blur pass): a focus value f = 0.5+0.5*sin(t*speed)
// drives a subtle scale jitter and an opacity pulse, so the card looks like a
// lens hunting focus. MEDIUM / blur. CPU-driven, looping (duration Infinity),
// observable: scale and opacity differ across two distinct t. DISTINCT from
// blur-in / zoom-blur (those are one-shot entrances). Restores in dispose.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2 },
  { id: 'overscale', label: 'Overscale', type: 'knob', min: 0, max: 0.3, step: 0.01, default: 0.12 },
  { id: 'minOpacity', label: 'Min Opacity', type: 'fader', min: 0.3, max: 0.9, step: 0.01, default: 0.55 },
] as const;

/** Collect transparent-capable materials on a subtree (for the opacity pulse). */
function materialsOf(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat);
      }
    }
  });
  return out;
}

/** Deterministic per-axis jitter offset in [-1, 1] from an integer seed. */
function hashUnit(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

export const defocusPulsePrimitive: PrimitiveDefinition = {
  name: 'defocus-pulse',
  label: 'Defocus Pulse',
  category: 'blur',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card breathes in and out of focus on a loop — a soft defocus proxy via subtle scale jitter and opacity pulse, like a lens hunting focus.',
  create: defineAnimatable(
    { name: 'defocus-pulse', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      // Deterministic per-axis jitter directions (stable across the run).
      const jx = hashUnit(1) * 0.035;
      const jy = hashUnit(2) * 0.035;
      const jz = hashUnit(3) * 0.02;

      return {
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 2);
          const overscale = num(params.overscale, 0.12);
          const minOpacity = clamp(num(params.minOpacity, 0.55), 0, 1);

          // focus value f: 1 = sharp, 0 = fully defocused.
          const f = 0.5 + 0.5 * Math.sin(t * speed);
          const blur = 1 - f; // blur proxy: larger when defocused.

          // Slightly larger when defocused, plus tiny deterministic multi-axis
          // jitter scaled by the blur amount (a lens hunting focus).
          const grow = 1 + blur * overscale;
          const wobble = Math.sin(t * speed * 3.1);
          subject.scale.x = baseSX * (grow + jx * blur * wobble);
          subject.scale.y = baseSY * (grow + jy * blur * wobble);
          subject.scale.z = baseSZ * (grow + jz * blur * wobble);

          // Opacity pulse: lerp(minOpacity, 1, f) — dimmer when defocused.
          const opacity = minOpacity + (1 - minOpacity) * f;
          for (const m of mats) (m as Material & { opacity: number }).opacity = opacity;
        },
        dispose: () => {
          subject.scale.set(baseSX, baseSY, baseSZ);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
