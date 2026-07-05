// hover-lift — a pointer-driven proximity lift. As the pointer nears the card's
// center, the card lifts toward the viewer (position.z), scales up, and its
// emissive brightens. POINTER / medium. Stateful: duration is Infinity and the
// effect tracks userData.pointer live each seek. CPU-driven and observable —
// position.z, scale, and emissiveIntensity all rise with proximity.

import { Mesh, type Object3D, type Material } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'lift', label: 'Lift', type: 'fader', min: 0, max: 2, step: 0.05, default: 0.8 },
  { id: 'pop', label: 'Pop', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.25 },
  { id: 'falloff', label: 'Falloff', type: 'knob', min: 0.5, max: 4, step: 0.1, default: 1.6 },
] as const;

interface PointerXY {
  x: number;
  y: number;
}

/** Collect emissive-capable materials on a subtree. */
function emissiveMatsOf(root: Object3D): Array<Material & { emissiveIntensity: number }> {
  const out: Array<Material & { emissiveIntensity: number }> = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        if (typeof (mat as { emissiveIntensity?: number }).emissiveIntensity === 'number') {
          out.push(mat as Material & { emissiveIntensity: number });
        }
      }
    }
  });
  return out;
}

export const hoverLiftPrimitive: PrimitiveDefinition = {
  name: 'hover-lift',
  label: 'Hover Lift',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'As the pointer nears, the card lifts toward the viewer, scales up, and brightens.',
  create: defineAnimatable(
    { name: 'hover-lift', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseZ = subject.position.z;
      const baseSx = subject.scale.x;
      const baseSy = subject.scale.y;
      const baseSz = subject.scale.z;
      const mats = emissiveMatsOf(subject);
      const baseEmissive = mats.map((m) => m.emissiveIntensity);

      const readPointer = (): PointerXY => {
        const p = (target.userData as { pointer?: PointerXY }).pointer;
        if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
        return { x: 0.5, y: 0.5 };
      };

      const apply = () => {
        const p = readPointer();
        const falloff = num(params.falloff, 1.6);
        const dx = p.x - 0.5;
        const dy = p.y - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const proximity = clamp(1 - dist * falloff, 0, 1);

        const lift = num(params.lift, 0.8);
        const pop = num(params.pop, 0.25);

        subject.position.z = baseZ + proximity * lift;
        const s = 1 + proximity * pop;
        subject.scale.set(baseSx * s, baseSy * s, baseSz * s);
        for (let i = 0; i < mats.length; i++) {
          mats[i].emissiveIntensity = baseEmissive[i] * (1 + proximity * 1.5);
        }
      };

      return {
        // Stateful pointer effect: never "ends" — tracks the pointer live.
        duration: () => Infinity,
        seek: () => {
          apply();
        },
        dispose: () => {
          subject.position.z = baseZ;
          subject.scale.set(baseSx, baseSy, baseSz);
          for (let i = 0; i < mats.length; i++) {
            mats[i].emissiveIntensity = baseEmissive[i];
          }
        },
      };
    },
  ),
};
