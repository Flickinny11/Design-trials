// kinetic-text primitive — per-character / per-word entrance animation
// over MSDF text. CPL L230-L248.
//
// The primitive operates on the `target`'s child meshes — production code
// passes a Group whose children are per-glyph (or per-word) meshes
// pre-built via `ctx.fontAtlas.createText(...)`. If the target has no
// children, the primitive returns a no-op timeline.

import { gsap } from 'gsap';
import type { PrimitiveFn, PrimitiveResult } from './types';

type Effect =
  | 'slide-up'
  | 'slide-down'
  | 'fade'
  | 'scale'
  | 'rotate3d'
  | 'wave';

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;
function pickEffect(v: unknown): Effect {
  switch (v) {
    case 'slide-up':
    case 'slide-down':
    case 'fade':
    case 'scale':
    case 'rotate3d':
    case 'wave':
      return v;
    default:
      return 'slide-up';
  }
}

export const kineticTextPrimitive: PrimitiveFn = (
  target,
  params,
): PrimitiveResult => {
  const stagger = Math.max(0, num(params.stagger, 0.04));
  const duration = Math.max(0.001, num(params.duration, 0.6));
  const effect = pickEffect(params.effect);
  const easing =
    typeof params.easing === 'string' ? params.easing : 'power3.out';

  const tl = gsap.timeline({ paused: true, defaults: { ease: easing } });

  for (let i = 0; i < target.children.length; i++) {
    const child = target.children[i];
    const start = i * stagger;
    if (effect === 'slide-up') {
      child.position.y = -1;
      tl.to(child.position, { y: 0, duration }, start);
    } else if (effect === 'slide-down') {
      child.position.y = 1;
      tl.to(child.position, { y: 0, duration }, start);
    } else if (effect === 'scale') {
      child.scale.set(0, 0, 0);
      tl.to(child.scale, { x: 1, y: 1, z: 1, duration }, start);
    } else if (effect === 'rotate3d') {
      child.rotation.x = Math.PI / 2;
      tl.to(child.rotation, { x: 0, duration }, start);
    } else if (effect === 'wave') {
      child.position.y = -0.5;
      tl.to(child.position, { y: 0, duration, ease: 'sine.inOut' }, start);
    } else if (effect === 'fade') {
      // Three's MSDF mesh material has an `opacity` property; we set on
      // userData so node code can pick up the controllable value.
      const fade = { value: 0 };
      (child.userData as Record<string, unknown>).kineticTextOpacity = fade;
      tl.to(fade, { value: 1, duration }, start);
    }
  }

  return {
    timeline: tl,
    cleanup: () => {
      tl.pause();
      tl.kill();
    },
  };
};
