// cursor-trail — the card lags toward the pointer with a smooth springy follow.
// Pointer-driven, stateful primitive (medium / pointer). Each seek reads
// userData.pointer {x,y} in 0..1, maps it to a world-space target offset, and
// lerps a stored current position toward that target (a critically-damped-ish
// spring via a per-seek lerp factor = stiffness). Fast pointer moves leave the
// card trailing behind, catching up over subsequent seeks.
//
// CPU-driven and observable: subject.position.x/y approaches the pointer-derived
// target over repeated seeks. Deterministic — all state lives on the closure, no
// Math.random. duration() = Infinity (continuous stateful follow, not a clip).

import { num, bool, clamp, type PrimitiveDefinition } from '../contract';
import { defineAnimatable } from '../base';

const SCHEMA = [
  { id: 'stiffness', label: 'Stiffness', type: 'knob', min: 0.02, max: 0.5, step: 0.01, default: 0.12 },
  { id: 'range', label: 'Range', type: 'fader', min: 0.2, max: 3, step: 0.1, default: 1.4 },
  { id: 'rotateToward', label: 'Rotate Toward', type: 'toggle', default: true },
] as const;

/** Pull a 0..1 pointer coord out of userData, defaulting to centre. */
function readPointer(userData: Record<string, unknown>): { x: number; y: number } {
  const p = userData.pointer as { x?: unknown; y?: unknown } | undefined;
  const px = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
  const py = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
  return { x: clamp(px, 0, 1), y: clamp(py, 0, 1) };
}

export const cursorTrailPrimitive: PrimitiveDefinition = {
  name: 'cursor-trail',
  label: 'Cursor Trail',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'Card lags toward the pointer with a smooth springy follow, trailing behind fast moves.',
  create: defineAnimatable(
    { name: 'cursor-trail', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseRotZ = subject.rotation.z;

      // Spring state on the closure: current follow offset (world units).
      let curX = 0;
      let curY = 0;

      return {
        // Purely stateful: continuous follow, not a fixed-length clip.
        duration: () => Infinity,
        seek: () => {
          const { x: px, y: py } = readPointer(target.userData);
          const range = num(params.range, 1.4);
          const stiffness = clamp(num(params.stiffness, 0.12), 0.02, 0.5);

          // Map pointer 0..1 → world offset in [-range/2, +range/2].
          const targetX = (px - 0.5) * range;
          const targetY = (py - 0.5) * range;

          // Spring step: lerp the stored current toward the target.
          curX += (targetX - curX) * stiffness;
          curY += (targetY - curY) * stiffness;

          subject.position.x = baseX + curX;
          subject.position.y = baseY + curY;

          if (bool(params.rotateToward, true)) {
            // Lean toward the direction of pursuit (target minus current).
            const dx = targetX - curX;
            const dy = targetY - curY;
            subject.rotation.z = baseRotZ + Math.atan2(dy, dx) * 0.15;
          } else {
            subject.rotation.z = baseRotZ;
          }
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
