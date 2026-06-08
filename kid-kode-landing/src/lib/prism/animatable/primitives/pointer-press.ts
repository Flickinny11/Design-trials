// pointer-press — the card presses BACK into the screen under the pointer and a
// soft contact highlight blooms where pressed. Pointer/medium primitive.
//
// Reads userData.pointer ({x,y} normalized, 0.5/0.5 = center). Proximity to the
// card center drives the press: position.z recedes (negative) and scale shrinks
// slightly, while the emissiveIntensity of the panel material rises at the
// contact. DISTINCT from hover-lift (which lifts TOWARD the viewer, +z): press
// recedes (-z). Restores transform + material emissive in dispose.

import { Mesh, type Object3D, type MeshStandardMaterial } from 'three';
import { defineAnimatable } from '../base';
import { clamp, num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'pressDepth', label: 'Press Depth', type: 'fader', min: 0.1, max: 2, step: 0.05, default: 0.6, unit: 'u' },
  { id: 'radius', label: 'Radius', type: 'knob', min: 0.1, max: 0.8, step: 0.01, default: 0.4 },
  { id: 'glow', label: 'Glow', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.6 },
] as const;

interface EmissiveMat {
  emissiveIntensity: number;
}

/** Find the first material on a subtree that carries an emissiveIntensity. */
function findEmissiveMaterial(root: Object3D): (MeshStandardMaterial & EmissiveMat) | null {
  let found: (MeshStandardMaterial & EmissiveMat) | null = null;
  root.traverse((o) => {
    if (found) return;
    const m = (o as Mesh).material;
    if (!m) return;
    const mat = (Array.isArray(m) ? m[0] : m) as Partial<EmissiveMat>;
    if (typeof mat.emissiveIntensity === 'number') {
      found = mat as MeshStandardMaterial & EmissiveMat;
    }
  });
  return found;
}

export const pointerPressPrimitive: PrimitiveDefinition = {
  name: 'pointer-press',
  label: 'Pointer Press',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'The card presses back into the screen under the pointer and a soft contact highlight blooms where pressed.',
  create: defineAnimatable(
    { name: 'pointer-press', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseZ = subject.position.z;
      const baseScale = { x: subject.scale.x, y: subject.scale.y, z: subject.scale.z };

      const mat = findEmissiveMaterial(subject);
      const baseEmissive = mat ? mat.emissiveIntensity : 0;

      /** Pointer proximity to the card center, 0..1 (1 = directly on center). */
      const proximity = (): number => {
        const p = target.userData.pointer as { x: number; y: number } | undefined;
        const px = p && Number.isFinite(p.x) ? p.x : 0.5;
        const py = p && Number.isFinite(p.y) ? p.y : 0.5;
        // distance from normalized center (0.5,0.5); diagonal max ~0.707
        const d = Math.hypot(px - 0.5, py - 0.5);
        const r = num(params.radius, 0.4);
        // inside radius -> 1, falls off linearly to 0 at the radius edge
        return clamp(1 - d / Math.max(r, 1e-4), 0, 1);
      };

      const apply = (prox: number) => {
        const depth = num(params.pressDepth, 0.6);
        // recede: z goes negative with proximity (press BACK into screen)
        subject.position.z = baseZ - depth * prox;
        // subtle scale-down under the press
        const s = 1 - 0.05 * prox;
        subject.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);
        // contact highlight blooms at the press
        if (mat) {
          mat.emissiveIntensity = baseEmissive + num(params.glow, 1.6) * prox;
        }
      };

      return {
        // Stateful pointer-driven effect: read live pointer each seek.
        duration: () => Infinity,
        seek: () => {
          apply(proximity());
        },
        dispose: () => {
          subject.position.z = baseZ;
          subject.scale.set(baseScale.x, baseScale.y, baseScale.z);
          if (mat) mat.emissiveIntensity = baseEmissive;
        },
      };
    },
  ),
};
