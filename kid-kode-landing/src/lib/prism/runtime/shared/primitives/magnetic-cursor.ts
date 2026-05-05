// magnetic-cursor primitive — target subtly attracts toward the cursor.
// CPL L166-L183.
//
// Cursor data flows in via `ctx.pointer: PointerSource` so this module
// stays clean of global-DOM access.

import { gsap } from 'gsap';
import { Vector3 } from 'three';
import type { PrimitiveFn, PrimitiveResult } from './types';

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;
const bool = (v: unknown, d: boolean): boolean =>
  typeof v === 'boolean' ? v : d;

export const magneticCursorPrimitive: PrimitiveFn = (
  target,
  params,
  ctx,
): PrimitiveResult => {
  const radius = num(params.radius, 0.15);
  const intensity = num(params.intensity, 0.1);
  const damping = Math.min(1, Math.max(0.001, num(params.damping, 0.08)));
  const affectScale = bool(params.affectScale, true);
  const scaleAmount = num(params.scaleAmount, 0.05);

  const desired = new Vector3(0, 0, 0);
  let withinRadius = false;
  let killed = false;

  const baseScale = target.scale.clone();
  const tl = gsap.timeline({ paused: true });

  let unsubscribe: (() => void) | null = null;
  if (ctx.pointer) {
    unsubscribe = ctx.pointer.subscribe((ndc) => {
      const dist = Math.hypot(ndc.x, ndc.y);
      withinRadius = dist <= radius || radius >= 1;
      desired.set(ndc.x * intensity, ndc.y * intensity, 0);
    });
  }

  function onTick(): void {
    if (killed) return;
    target.position.lerp(desired, damping);
    if (affectScale) {
      const targetScale = withinRadius ? 1 + scaleAmount : 1;
      target.scale.set(
        baseScale.x +
          (baseScale.x * targetScale - target.scale.x) * damping,
        baseScale.y +
          (baseScale.y * targetScale - target.scale.y) * damping,
        baseScale.z +
          (baseScale.z * targetScale - target.scale.z) * damping,
      );
    }
  }

  return {
    timeline: tl,
    needsTick: true,
    onTick,
    cleanup: () => {
      killed = true;
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      tl.pause();
      tl.kill();
    },
  };
};
