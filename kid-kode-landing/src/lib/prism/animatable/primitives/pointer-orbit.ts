// pointer-orbit — the card rotates to face the pointer's angle around its
// center, swinging to track the cursor like a compass needle. Pointer-driven
// and stateful: rotation.z lerps toward atan2(py-0.5, px-0.5) * gain each seek,
// smoothing the swing. DISTINCT from pointer-tilt-3d / tilt (which tilt x/y) —
// this is azimuth (in-plane) tracking. CPU-observable: changing the pointer
// angle changes subject.rotation.z after a few seeks.

import { type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'gain', label: 'Gain', type: 'knob', min: 0.2, max: 1.5, step: 0.05, default: 1.0 },
  { id: 'smoothing', label: 'Smoothing', type: 'knob', min: 0.05, max: 1, step: 0.05, default: 0.35 },
  { id: 'lean', label: 'Lean', type: 'toggle', default: true },
] as const;

interface PointerXY {
  x: number;
  y: number;
}

function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = userData.pointer as Partial<PointerXY> | undefined;
  const x = typeof p?.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
  const y = typeof p?.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
  return { x, y };
}

export const pointerOrbitPrimitive: PrimitiveDefinition = {
  name: 'pointer-orbit',
  label: 'Pointer Orbit',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    "The card rotates to face the pointer's angle around its center, swinging to track the cursor like a compass needle.",
  create: defineAnimatable(
    { name: 'pointer-orbit', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseRotZ = subject.rotation.z;
      const baseRotX = subject.rotation.x;
      const baseRotY = subject.rotation.y;

      // Stateful smoothing accumulators (closure state).
      let curZ = baseRotZ;
      let curX = baseRotX;
      let curY = baseRotY;
      let lastT = 0;

      const reset = () => {
        curZ = baseRotZ;
        curX = baseRotX;
        curY = baseRotY;
        lastT = 0;
        subject.rotation.z = baseRotZ;
        subject.rotation.x = baseRotX;
        subject.rotation.y = baseRotY;
      };

      // Advance one smoothing step toward the current pointer-derived target.
      const step = (steps: number) => {
        const px = readPointer(target.userData);
        const dx = px.x - 0.5;
        const dy = px.y - 0.5;
        const ang = Math.atan2(dy, dx);
        const gain = num(params.gain, 1.0);
        // Smoothing in 0.05..1: higher = snappier. Per-step lerp factor.
        const k = clamp(num(params.smoothing, 0.35), 0.0001, 1);
        const targetZ = baseRotZ + ang * gain;

        const doLean = bool(params.lean, true);
        // A slight lean toward the pointer on x/y (gentle, capped).
        const leanAmt = 0.18;
        const targetX = doLean ? baseRotX + clamp(dy, -1, 1) * leanAmt : baseRotX;
        const targetY = doLean ? baseRotY + clamp(dx, -1, 1) * leanAmt : baseRotY;

        const n = Math.max(1, Math.round(steps));
        for (let i = 0; i < n; i++) {
          curZ += (targetZ - curZ) * k;
          curX += (targetX - curX) * k;
          curY += (targetY - curY) * k;
        }
        subject.rotation.z = curZ;
        subject.rotation.x = curX;
        subject.rotation.y = curY;
      };

      return {
        // Purely stateful pointer tracker — animates continuously across t.
        duration: () => Infinity,
        seek: (t) => {
          // Reproducible reseek: rewinding restarts the smoothing from base.
          if (t < lastT) reset();
          // Advance proportional to elapsed time so distinct t values settle
          // toward the target by different amounts (mid-frame != t=0).
          const dt = Math.max(0, t - lastT);
          // ~60 conceptual steps per second of elapsed time, min one step per seek.
          const steps = Math.max(1, dt * 60);
          step(steps);
          lastT = t;
        },
        dispose: () => {
          subject.rotation.z = baseRotZ;
          subject.rotation.x = baseRotX;
          subject.rotation.y = baseRotY;
        },
      };
    },
  ),
};
