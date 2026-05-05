// fly-through primitive — camera flies forward through (or past) the
// target. CPL L209-L226.
//
// Operates on `ctx.camera`, not the target object — the target stays put;
// the scene camera moves.

import { gsap } from 'gsap';
import { Vector3 } from 'three';
import type { PrimitiveFn, PrimitiveResult } from './types';

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;

export const flyThroughPrimitive: PrimitiveFn = (
  target,
  params,
  ctx,
): PrimitiveResult => {
  const direction =
    params.direction === 'backward' ? 'backward' : 'forward';
  const duration = Math.max(0.001, num(params.duration, 1.0));
  const easing =
    typeof params.easing === 'string' ? params.easing : 'power2.inOut';

  const camStart = ctx.camera.position.clone();
  const camEnd = new Vector3();
  if (direction === 'forward') {
    // Move 90% of the way toward target.
    camEnd.copy(camStart).lerp(target.position, 0.9);
  } else {
    // Backward: away from target. Move by the same start→target distance.
    const away = camStart.clone().sub(target.position);
    if (away.lengthSq() < 1e-9) away.set(0, 0, 1);
    away.normalize();
    const dist = camStart.distanceTo(target.position);
    camEnd.copy(camStart).addScaledVector(away, Math.max(0.001, dist));
  }

  const tl = gsap.timeline({ paused: true, defaults: { ease: easing } });
  tl.to(ctx.camera.position, {
    x: camEnd.x,
    y: camEnd.y,
    z: camEnd.z,
    duration,
  });

  return {
    timeline: tl,
    cleanup: () => {
      tl.pause();
      tl.kill();
    },
  };
};
