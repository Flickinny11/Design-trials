// flash — the card flashes in: opacity rises fast from 0 to 1 while the
// emissive intensity on every material spikes (0 → peak → base) over the
// phase, settling to the subject's original look. Fade/emissive primitive
// (easy / fade). CPU-driven and observable: opacity climbs with the eased
// phase, and emissiveIntensity overshoots through a bright peak before
// relaxing to each material's recorded base value.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.2, max: 3, step: 0.1, default: 0.9, unit: 's' },
  { id: 'peak', label: 'Emissive Peak', type: 'knob', min: 0, max: 6, step: 0.1, default: 2, unit: 'x' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

/** A material that carries the emissive-spike-capable fields we touch. */
type EmissiveMat = Material & { opacity: number; emissiveIntensity?: number };

interface TrackedMaterial {
  mat: EmissiveMat;
  /** Whether this material exposes emissiveIntensity (standard/physical). */
  hasEmissive: boolean;
  /** The material's original emissiveIntensity — the settle target. */
  baseEmissive: number;
  /** The material's original opacity — restored on dispose. */
  baseOpacity: number;
  /** The material's original transparent flag — restored on dispose. */
  baseTransparent: boolean;
}

/** Collect transparent-capable materials on a subtree, recording base state. */
function trackMaterials(root: Object3D): TrackedMaterial[] {
  const out: TrackedMaterial[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (!m) return;
    const arr = Array.isArray(m) ? m : [m];
    for (const raw of arr) {
      const mat = raw as EmissiveMat;
      const hasEmissive = typeof mat.emissiveIntensity === 'number';
      out.push({
        mat,
        hasEmissive,
        baseEmissive: hasEmissive ? (mat.emissiveIntensity as number) : 0,
        baseOpacity: mat.opacity,
        baseTransparent: mat.transparent,
      });
      mat.transparent = true;
    }
  });
  return out;
}

export const flashPrimitive: PrimitiveDefinition = {
  name: 'flash',
  label: 'Flash In',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card flashes in with a bright emissive spike that settles to its base look: opacity races 0→1 while emissive intensity overshoots through a peak and relaxes.',
  create: defineAnimatable(
    { name: 'flash', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const tracked = trackMaterials(subject);
      return {
        duration: () => num(params.duration, 0.9),
        seek: (t) => {
          const curve = str(params.curve, 'expoOut') as EaseName;
          const p = phase(t, num(params.duration, 0.9));
          // Opacity races in fast on the eased phase.
          const op = ease(curve, p);
          // Emissive spike: a triangular-ish hump that peaks early (~30% of
          // the phase) then relaxes to 0 by the end, scaled by `peak`. Added
          // on top of each material's recorded base so it settles to base.
          const peak = num(params.peak, 2);
          const pk = 0.3;
          const hump =
            p <= pk
              ? p / pk // ramp up 0→1
              : clamp(1 - (p - pk) / (1 - pk), 0, 1); // relax 1→0
          const spike = peak * hump;
          for (const tm of tracked) {
            tm.mat.opacity = op;
            if (tm.hasEmissive) {
              tm.mat.emissiveIntensity = tm.baseEmissive + spike;
            }
          }
        },
        dispose: () => {
          for (const tm of tracked) {
            tm.mat.opacity = tm.baseOpacity;
            tm.mat.transparent = tm.baseTransparent;
            if (tm.hasEmissive) {
              tm.mat.emissiveIntensity = tm.baseEmissive;
            }
          }
        },
      };
    },
  ),
};
