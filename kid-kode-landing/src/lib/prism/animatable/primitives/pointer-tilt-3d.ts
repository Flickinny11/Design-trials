// pointer-tilt-3d — whole-card 3D parallax tilt toward the pointer, like a
// premium trading card catching the light. POINTER / medium. Reads
// userData.pointer {x,y} in 0..1, derives a center offset (-0.5..0.5), and
// drives rotation.y = offsetX * maxTilt, rotation.x = -offsetY * maxTilt,
// lerped toward the target each seek for smoothness. A slight position.z lift
// peaks at center so the card "rises" when faced straight on. Stateful: tracks
// the live pointer, so duration() is Infinity.
//
// DISTINCT from `tilt` (raw 2-control lerp, no center-offset / z-lift / invert),
// from `hover-lift` (z + scale + emissive on proximity), and from
// `parallax-layers` (children offsets). This is a whole-card 3D tilt.

import { MathUtils, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'maxTiltDeg', label: 'Max tilt', type: 'knob', min: 5, max: 40, step: 0.5, default: 18, unit: 'deg' },
  { id: 'smoothing', label: 'Smoothing', type: 'knob', min: 0.05, max: 1, step: 0.01, default: 0.25 },
  { id: 'lift', label: 'Center lift', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.16 },
  { id: 'invert', label: 'Invert', type: 'toggle', default: false },
] as const;

interface PointerXY {
  x: number;
  y: number;
}

export const pointerTilt3dPrimitive: PrimitiveDefinition = {
  name: 'pointer-tilt-3d',
  label: 'Pointer Tilt 3D',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'Card tilts in 3D toward the pointer like a parallax trading-card, rotating on X and Y to face the cursor.',
  create: defineAnimatable(
    { name: 'pointer-tilt-3d', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseRotX = subject.rotation.x;
      const baseRotY = subject.rotation.y;
      const baseZ = subject.position.z;

      // Current smoothed offsets (relative to base), lerped toward target.
      let curRotX = 0;
      let curRotY = 0;
      let curZ = 0;

      const readPointer = (): PointerXY => {
        const p = (target.userData as { pointer?: Partial<PointerXY> }).pointer;
        return {
          x: num(p?.x as number | undefined, 0.5),
          y: num(p?.y as number | undefined, 0.5),
        };
      };

      return {
        // Stateful pointer effect: tracks the live pointer, never "ends".
        duration: () => Infinity,
        seek: () => {
          const p = readPointer();
          // Offset from center, range -0.5..0.5.
          const offX = p.x - 0.5;
          const offY = p.y - 0.5;
          const maxTilt = MathUtils.degToRad(num(params.maxTiltDeg, 18));
          const s = clamp(num(params.smoothing, 0.25), 0.05, 1);
          const sign = bool(params.invert, false) ? -1 : 1;

          // Face the cursor: yaw follows horizontal offset, pitch follows
          // vertical offset (negated so the top tips back toward the pointer).
          const targetRotY = sign * offX * maxTilt;
          const targetRotX = sign * -offY * maxTilt;

          // Lift peaks when the pointer is at center (offset ~0).
          const centerness = clamp(1 - Math.hypot(offX, offY) * 2, 0, 1);
          const targetZ = centerness * num(params.lift, 0.16);

          curRotX += (targetRotX - curRotX) * s;
          curRotY += (targetRotY - curRotY) * s;
          curZ += (targetZ - curZ) * s;

          subject.rotation.x = baseRotX + curRotX;
          subject.rotation.y = baseRotY + curRotY;
          subject.position.z = baseZ + curZ;
        },
        dispose: () => {
          subject.rotation.x = baseRotX;
          subject.rotation.y = baseRotY;
          subject.position.z = baseZ;
        },
      };
    },
  ),
};
