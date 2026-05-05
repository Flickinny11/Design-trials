// orbit primitive — target object orbits around a configurable point in 3D
// space, optionally rotating to face the orbit center.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L57-L76.
//   - Params: centerXYZ (default 0,0,0), radius (2), axisXYZ (default 0,1,0
//     — Y-axis orbit), period (8s), faceCenter (true), clockwise (true).
//   - Implementation: gsap.timeline({ repeat: -1 }), parametric circle, with
//     `target.lookAt(center)` per frame when faceCenter is true.

import { gsap } from 'gsap';
import { Matrix4, Vector3 } from 'three';
import type { PrimitiveFn, PrimitiveResult } from './types';

const _m = new Matrix4();

/** Orient `obj` so its local -Z faces `target` (camera convention). The
 *  default `Object3D.lookAt` orients local +Z toward target for non-cameras
 *  — we want camera-style orientation here. */
function lookAtCameraStyle(
  obj: { position: Vector3; up: Vector3; quaternion: { setFromRotationMatrix(m: Matrix4): void } },
  target: Vector3,
): void {
  _m.lookAt(obj.position, target, obj.up);
  obj.quaternion.setFromRotationMatrix(_m);
}

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;
const bool = (v: unknown, d: boolean): boolean =>
  typeof v === 'boolean' ? v : d;

export const orbitPrimitive: PrimitiveFn = (target, params): PrimitiveResult => {
  const center = new Vector3(
    num(params.centerX, 0),
    num(params.centerY, 0),
    num(params.centerZ, 0),
  );
  const radius = num(params.radius, 2);
  const axis = new Vector3(
    num(params.axisX, 0),
    num(params.axisY, 1),
    num(params.axisZ, 0),
  );
  if (axis.lengthSq() < 1e-9) axis.set(0, 1, 0);
  axis.normalize();
  const period = Math.max(0.001, num(params.period, 8));
  const faceCenter = bool(params.faceCenter, true);
  const clockwise = bool(params.clockwise, true);

  // Two perpendicular vectors spanning the orbit plane (perpendicular to axis).
  const refUp =
    Math.abs(axis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const right = new Vector3().crossVectors(refUp, axis).normalize();
  const up = new Vector3().crossVectors(axis, right).normalize();

  const state = { angle: 0 };

  function applyAngle(a: number): void {
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    target.position
      .copy(center)
      .addScaledVector(right, x)
      .addScaledVector(up, y);
    if (faceCenter) lookAtCameraStyle(target, center);
  }

  applyAngle(0);

  const sign = clockwise ? 1 : -1;
  const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'none' } });
  tl.to(state, {
    angle: sign * Math.PI * 2,
    duration: period,
    onUpdate: () => applyAngle(state.angle),
  });

  return {
    timeline: tl,
    cleanup: () => {
      tl.pause();
      tl.kill();
    },
  };
};
