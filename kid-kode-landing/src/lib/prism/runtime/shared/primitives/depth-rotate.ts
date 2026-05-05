// depth-rotate primitive — target rotates on its own axis with apparent
// depth. CPL L79-L97.

import { gsap } from 'gsap';
import { Vector3 } from 'three';
import type { PrimitiveFn, PrimitiveResult } from './types';

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;
const bool = (v: unknown, d: boolean): boolean =>
  typeof v === 'boolean' ? v : d;

export const depthRotatePrimitive: PrimitiveFn = (target, params): PrimitiveResult => {
  const axis = new Vector3(
    num(params.axisX, 0),
    num(params.axisY, 1),
    num(params.axisZ, 0),
  );
  if (axis.lengthSq() < 1e-9) axis.set(0, 1, 0);
  axis.normalize();
  const period = Math.max(0.001, num(params.period, 12));
  const pingPong = bool(params.pingPong, false);
  const pingPongRange = num(params.pingPongRange, 45);
  const easing =
    typeof params.easing === 'string' ? params.easing : pingPong ? 'sine.inOut' : 'none';

  const targetAngle = pingPong
    ? (pingPongRange * Math.PI) / 180
    : Math.PI * 2;

  const state = { angle: 0 };
  function apply(a: number): void {
    target.quaternion.setFromAxisAngle(axis, a);
  }
  apply(0);

  const tl = gsap.timeline({
    repeat: -1,
    yoyo: pingPong,
    defaults: { ease: easing },
  });
  tl.to(state, {
    angle: targetAngle,
    duration: period,
    onUpdate: () => apply(state.angle),
  });

  return {
    timeline: tl,
    cleanup: () => {
      tl.pause();
      tl.kill();
    },
  };
};
