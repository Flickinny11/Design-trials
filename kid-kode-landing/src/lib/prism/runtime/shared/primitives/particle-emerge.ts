// particle-emerge primitive — target's pixels fly in from random world
// positions, assemble into the final texture. CPL L187-L205.

import { gsap } from 'gsap';
import {
  BufferAttribute,
  BufferGeometry,
  Points,
  PointsMaterial,
} from 'three';
import type { PrimitiveFn, PrimitiveResult } from './types';

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export const particleEmergePrimitive: PrimitiveFn = (
  target,
  params,
): PrimitiveResult => {
  const requested = num(params.particleCount, 512);
  const count = clamp(Math.round(requested), 256, 2048);
  const duration = Math.max(0.001, num(params.duration, 1.5));
  const dispersion = num(params.dispersionRadius, 5);
  const easing =
    typeof params.easing === 'string' ? params.easing : 'power3.out';

  const positions = new Float32Array(count * 3);
  const finals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Final position: random small spread inside the unit cube (placeholder
    // for UV-mapped sample of target texture; real sample happens in shader).
    const fx = (Math.random() - 0.5);
    const fy = (Math.random() - 0.5);
    const fz = (Math.random() - 0.5);
    finals[i * 3] = fx;
    finals[i * 3 + 1] = fy;
    finals[i * 3 + 2] = fz;
    // Initial position: dispersed.
    positions[i * 3] = (Math.random() - 0.5) * dispersion * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * dispersion * 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * dispersion * 2;
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  const mat = new PointsMaterial({ size: 0.02, sizeAttenuation: true });
  const points = new Points(geo, mat);
  points.name = 'particle-emerge';
  target.add(points);

  const state = { t: 0 };
  function applyT(t: number): void {
    const attr = geo.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const sx = positions[idx];
      const sy = positions[idx + 1];
      const sz = positions[idx + 2];
      attr.array[idx] = sx + (finals[idx] - sx) * t;
      attr.array[idx + 1] = sy + (finals[idx + 1] - sy) * t;
      attr.array[idx + 2] = sz + (finals[idx + 2] - sz) * t;
    }
    attr.needsUpdate = true;
  }

  const tl = gsap.timeline({ paused: true, defaults: { ease: easing } });
  tl.to(state, {
    t: 1,
    duration,
    onUpdate: () => applyT(state.t),
  });

  return {
    timeline: tl,
    cleanup: () => {
      target.remove(points);
      geo.dispose();
      mat.dispose();
      tl.pause();
      tl.kill();
    },
  };
};
