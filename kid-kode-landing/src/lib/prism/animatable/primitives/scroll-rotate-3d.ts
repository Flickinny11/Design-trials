// scroll-rotate-3d — scroll tilts the card in 3D, rotating it through depth as
// it passes. Reads userData.scroll (fallback phase(t)); the chosen axis rotation
// lerps from +maxTilt (scroll=0) to -maxTilt (scroll=1) and the card gains a
// slight z parallax. Transform primitive (medium / scroll), CPU-driven and
// observable: rotation[axis] and position.z change with scroll.

import { num, str, clamp, phase, type PrimitiveDefinition, type ControlValue } from '../contract';
import { defineAnimatable } from '../base';

const SCHEMA = [
  { id: 'maxTiltDeg', label: 'Max Tilt', type: 'knob', min: 0, max: 90, step: 1, default: 35, unit: 'deg' },
  { id: 'depth', label: 'Depth', type: 'fader', min: 0, max: 3, step: 0.05, default: 0.8 },
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'x', label: 'X (pitch)' },
      { value: 'y', label: 'Y (yaw)' },
    ],
    default: 'x',
  },
] as const;

const DEG2RAD = Math.PI / 180;

/** Read the scroll driver the host supplies; fall back to time phase. */
function scrollOf(userData: Record<string, unknown>, t: number): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return phase(t, 4);
}

export const scrollRotate3dPrimitive: PrimitiveDefinition = {
  name: 'scroll-rotate-3d',
  label: 'Scroll Rotate 3D',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  description: 'Scroll tilts the card in 3D, rotating it through depth as it passes.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'scroll-rotate-3d', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseRotX = subject.rotation.x;
      const baseRotY = subject.rotation.y;
      const baseZ = subject.position.z;

      const apply = (scroll: number) => {
        const maxTilt = num(params.maxTiltDeg, 35) * DEG2RAD;
        const depth = num(params.depth, 0.8);
        const axis = str(params.axis, 'x');
        // lerp(maxTilt, -maxTilt, scroll)
        const tilt = maxTilt + (-maxTilt - maxTilt) * scroll;

        // Reset both axes to base, then drive the selected one.
        subject.rotation.x = baseRotX;
        subject.rotation.y = baseRotY;
        if (axis === 'y') subject.rotation.y = baseRotY + tilt;
        else subject.rotation.x = baseRotX + tilt;

        // Slight z parallax: closest at mid-pass (scroll=0.5), receding at the
        // edges — a smooth depth arc scaled by depth.
        subject.position.z = baseZ + depth * (1 - Math.abs(scroll - 0.5) * 2);
      };

      return {
        duration: () => 4,
        seek: (t) => {
          apply(scrollOf(target.userData, t));
        },
        onParamChange: (_id: string, _value: ControlValue) => {
          // Re-apply at the current scroll so structural knobs read live without
          // waiting for the next driver tick.
          apply(scrollOf(target.userData, 0));
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
