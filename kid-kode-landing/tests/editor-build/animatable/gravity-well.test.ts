// gravity-well — behavior tests.
//
// The cursor bends space: the card slides DOWN the well's curve toward the
// pointer along an inverse-square-ish falloff (strong near, vanishing far — NOT
// linear), stretching tidally (elongate along the pull axis, squash across it,
// growing as distance shrinks, bounded), while 6-10 faint brass dust motes
// stream on decaying spiral paths into the drain at the pointer.
//
// We assert:
//  - conformance to the Animatable contract,
//  - INVERSE-SQUARE-ish pull: the per-distance displacement curve is convex —
//    halving the distance more-than-doubles the pull (super-linear), distinct
//    from magnetic's linear soft pull,
//  - the card TRAVELS toward a moving pointer across consecutive seeks and the
//    near pointer pulls HARDER than a far one,
//  - TIDAL stretch: at the engaged pin the card elongates along the pull axis
//    and squashes across it (anisotropic, det > restored), growing as the
//    pointer nears,
//  - motes exist as ONE instanced Sprite (never THREE.Points) carrying the
//    deterministic spiral, count tracks the control (3-12), positions are finite
//    and converge toward the pointer drain,
//  - the engaged pin {x:0.62,y:0.5} holds a visibly drawn + stretched pose and
//    EVERY control re-shapes that pinned (dt≈0) frame immediately (onParamChange),
//  - travel + stretch stay bounded subject-relative (never leaves the tile),
//  - the idle disengaged frame (pointer centered, first seek) is the home pose,
//  - dispose restores position / scale / rotation exactly AND removes the motes.

import { describe, it, expect } from 'vitest';
import { Box3, Sprite, Vector3, type Object3D } from 'three';
import { gravityWellPrimitive } from '@/lib/prism/animatable/primitives/gravity-well';
import { makeTarget, runConformance } from './_conformance';
import type { AnimatableTarget, ParamState } from '@/lib/prism/animatable/contract';

/** Fresh target + instance with optional param overrides. */
function fresh(overrides?: Partial<ParamState>) {
  const target: AnimatableTarget = makeTarget(gravityWellPrimitive);
  const inst = gravityWellPrimitive.create(target, overrides);
  return { target, inst, subject: target.subject as Object3D };
}

/** Stateful spring: settle by seeking many fixed-dt frames at a moving clock. */
function settle(inst: { seek: (t: number) => void }, startT = 0, frames = 120, dt = 0.016): number {
  let t = startT;
  for (let i = 0; i < frames; i++) {
    inst.seek(t);
    t += dt;
  }
  return t;
}

/** Seed a clean idle frame (disengaged center, first seek t=0). */
function idle(target: AnimatableTarget, inst: { seek(t: number): void }) {
  target.userData.pointer = { x: 0.5, y: 0.5 };
  inst.seek(0);
}

/** Subject bbox width (the primitive's subject-relative travel unit). */
function subjectWidth(subject: Object3D): number {
  return new Box3().setFromObject(subject).getSize(new Vector3()).x;
}

/** The motes Sprite that the primitive parents under target.object. */
function findMotes(target: AnimatableTarget): Sprite | null {
  let found: Sprite | null = null;
  target.object.traverse((o) => {
    if (!found && (o as Sprite).isSprite) found = o as Sprite;
  });
  return found;
}

// The harness pins the rig pointer here for pointer tiles (proximity 0.7–0.9).
const PIN = { x: 0.62, y: 0.5 };

describe('gravity-well primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(gravityWellPrimitive).dispose();
  });

  it('is a stateful pointer primitive on the card', () => {
    expect(gravityWellPrimitive.category).toBe('pointer');
    expect(gravityWellPrimitive.defaultDriver).toBe('pointer');
    expect(gravityWellPrimitive.subject).toBe('card');
    const { inst } = fresh();
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('idle disengaged frame is the home pose (legible at rest)', () => {
    const { target, inst, subject } = fresh();
    const baseX = subject.position.x;
    const baseY = subject.position.y;
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0);
    expect(subject.position.x).toBeCloseTo(baseX, 6);
    expect(subject.position.y).toBeCloseTo(baseY, 6);
    expect(subject.scale.x).toBeCloseTo(1, 6);
    expect(subject.scale.y).toBeCloseTo(1, 6);
    expect(subject.rotation.z).toBeCloseTo(0, 6);
    inst.dispose();
  });

  it('physics: the card TRAVELS toward a moving pointer; a near pointer pulls harder than a far one', () => {
    // Slow well so the slide stays visibly en route across the sampled frames.
    const { target, inst, subject } = fresh({ pullSpeed: 0.12 });
    const baseX = subject.position.x;
    idle(target, inst);

    // Pointer steps right of center → the card slides +x, monotone increasing.
    target.userData.pointer = { x: 0.7, y: 0.5 };
    inst.seek(0.016);
    const s1 = subject.position.x - baseX;
    inst.seek(0.032);
    const s2 = subject.position.x - baseX;
    inst.seek(0.064);
    const s3 = subject.position.x - baseX;
    expect(s1).toBeGreaterThan(0);
    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s2);

    // A leftward pointer pulls the card the other way (past center, to −x).
    target.userData.pointer = { x: 0.1, y: 0.5 };
    settle(inst, 0.064, 120);
    expect(subject.position.x - baseX).toBeLessThan(0);
    inst.dispose();

    // NEAR vs FAR: settle two wells at a near and a far pointer; the near one
    // sits DEEPER in the well, so its tidal stretch is larger (the falloff is
    // inverse-square-ish, not flat). Read each stretch BEFORE disposing — dispose
    // restores the scale to identity.
    const near = fresh();
    near.target.userData.pointer = { x: 0.58, y: 0.5 }; // close to center
    settle(near.inst, 0, 200);
    const nearStretch = Math.abs(near.subject.scale.x - 1);
    near.inst.dispose();

    const far = fresh();
    far.target.userData.pointer = { x: 0.95, y: 0.5 }; // far from center
    settle(far.inst, 0, 200);
    const farStretch = Math.abs(far.subject.scale.x - 1);
    far.inst.dispose();

    // Tidal stretch GROWS as the pointer nears.
    expect(nearStretch).toBeGreaterThan(farStretch);
  });

  it('inverse-square-ish falloff: the pull curve is convex (super-linear), not magnetic’s linear pull', () => {
    // The well pulls the card a FRACTION of the way to the drain; with an
    // inverse-square-ish falloff that fraction is CONVEX in distance — high near,
    // collapsing far. A LINEAR pull (magnetic) would hold the fraction constant.
    // Measure the settled pull FRACTION (offset / raw drain) at three distances on
    // a FRESH well each time (no carried state, low gravity so nothing saturates).
    const pullFractionAt = (px: number): number => {
      const { target, inst, subject } = fresh({ pullSpeed: 0.6, gravity: 0.5 });
      const baseX = subject.position.x;
      target.userData.pointer = { x: px, y: 0.5 };
      settle(inst, 0, 260);
      const off = subject.position.x - baseX;
      inst.dispose();
      // Raw drain offset the card is being pulled toward (REACH_UNITS=1.1, width
      // ≈1.74, x reach is undamped): fraction = achieved / raw.
      const drain = (px - 0.5) * 2 * 1.1 * 1.74;
      return off / drain;
    };

    const fNear = pullFractionAt(0.62); //  close drain
    const fMid = pullFractionAt(0.78); //   mid drain
    const fFar = pullFractionAt(0.95); //   far drain

    // Each is a real fraction of the way to its drain, and the fraction COLLAPSES
    // with distance — the inverse-square-ish signature (a linear pull would keep
    // these ratios roughly equal).
    expect(fNear).toBeGreaterThan(0);
    expect(fNear).toBeGreaterThan(fMid + 0.05);
    expect(fMid).toBeGreaterThan(fFar + 0.02);
  });

  it('tidal stretch: at the engaged pin the card elongates along the pull axis and squashes across it', () => {
    const { target, inst, subject } = fresh();
    idle(target, inst);
    target.userData.pointer = { ...PIN }; // horizontal pull (+x)
    settle(inst, 0, 200);

    // Elongated ALONG x (the pull axis), squashed ACROSS y. Anisotropic — the
    // two axes move in opposite directions from identity.
    expect(subject.scale.x).toBeGreaterThan(1.02);
    expect(subject.scale.y).toBeLessThan(0.99);
    expect(subject.scale.x).toBeGreaterThan(subject.scale.y);
    inst.dispose();
  });

  it('motes: exactly one instanced Sprite (never THREE.Points), count tracks the control, positions finite + drained toward the pointer', () => {
    const { target, inst, subject } = fresh({ moteCount: 8 });
    idle(target, inst);
    target.userData.pointer = { ...PIN };
    settle(inst, 0, 60);

    const motes = findMotes(target);
    expect(motes, 'motes are a Sprite').not.toBeNull();
    expect((motes as unknown as { isPoints?: boolean }).isPoints).not.toBe(true);
    // Live count honored.
    expect((motes as Sprite).count).toBe(8);

    // Per-instance positions are finite and live near the pointer drain (which
    // is mapped to a subject-relative offset toward +x at this pin).
    const geo = (motes as Sprite).geometry;
    const inst3 = geo.getAttribute('instancePosition');
    expect(inst3).toBeTruthy();
    const arr = inst3.array as ArrayLike<number>;
    let allFinite = true;
    let meanX = 0;
    for (let i = 0; i < 8; i++) {
      const x = arr[i * 3];
      const y = arr[i * 3 + 1];
      const z = arr[i * 3 + 2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) allFinite = false;
      meanX += x;
    }
    meanX /= 8;
    expect(allFinite).toBe(true);
    // The motes spiral toward the +x drain, so their mean x sits right of 0.
    expect(meanX).toBeGreaterThan(0);

    // moteCount control reshapes the draw count.
    inst.setControl('moteCount', 4);
    expect((motes as Sprite).count).toBe(4);
    inst.setControl('moteCount', 12);
    expect((motes as Sprite).count).toBe(12);
    inst.dispose();
  });

  it('engaged pin {0.62,0.5}: holds a drawn + stretched pose and EVERY control re-shapes the pinned frame', () => {
    const { target, inst, subject } = fresh();
    const baseX = subject.position.x;

    // Drive into the pin with real velocity, then PIN (repeated same-t seeks).
    idle(target, inst);
    target.userData.pointer = { ...PIN };
    settle(inst, 0, 120);
    inst.seek(2.0); // first pinned seek (settling step)
    inst.seek(2.0);
    const pinnedX = subject.position.x;
    const pinnedSX = subject.scale.x;
    for (let i = 0; i < 3; i++) inst.seek(2.0);
    // Byte-stable across repeated pinned seeks.
    expect(subject.position.x).toBeCloseTo(pinnedX, 10);
    expect(subject.scale.x).toBeCloseTo(pinnedSX, 10);
    // Visibly drawn toward the pointer AND tidally stretched (not an empty frame).
    expect(Math.abs(pinnedX - baseX)).toBeGreaterThan(0.02);
    expect(pinnedSX).toBeGreaterThan(1.02);

    // gravity sweep → stronger gravity draws the card harder at the pinned offset
    // (no extra seek: onParamChange re-applies at the held state).
    inst.setControl('gravity', 0.3);
    const weakX = Math.abs(subject.position.x - baseX);
    inst.setControl('gravity', 3.0);
    const strongX = Math.abs(subject.position.x - baseX);
    expect(strongX).toBeGreaterThan(weakX + 0.01);
    inst.setControl('gravity', 1.4);

    // falloff sweep → a different falloff power reshapes the pinned pull.
    inst.setControl('falloff', 1.0);
    const loFall = subject.position.x;
    inst.setControl('falloff', 3.0);
    const hiFall = subject.position.x;
    expect(Math.abs(hiFall - loFall)).toBeGreaterThan(0.005);
    inst.setControl('falloff', 2.0);

    // tidalStretch sweep → the pinned elongation magnitude grows.
    inst.setControl('tidalStretch', 0.05);
    const loTide = subject.scale.x;
    inst.setControl('tidalStretch', 0.5);
    const hiTide = subject.scale.x;
    expect(hiTide).toBeGreaterThan(loTide + 0.02);
    inst.setControl('tidalStretch', 0.22);

    // moteCount sweep → the draw count reshapes (already covered, re-assert at pin).
    const motes = findMotes(target) as Sprite;
    inst.setControl('moteCount', 3);
    expect(motes.count).toBe(3);
    inst.setControl('moteCount', 10);
    expect(motes.count).toBe(10);

    inst.dispose();
  });

  it('travel + stretch stay bounded subject-relative inside the tile frame at extremes', () => {
    const { target, inst, subject } = fresh({ gravity: 3.0, tidalStretch: 0.5, pullSpeed: 0.9 });
    const w = subjectWidth(subject);
    const baseX = subject.position.x;
    idle(target, inst);
    // Pointer slammed to the far corner; drive hard to convergence.
    target.userData.pointer = { x: 1, y: 1 };
    settle(inst, 0, 400);
    const offX = subject.position.x - baseX;
    // Card's near edge stays inside the tile half-width (~1.55 @ fov40 z3.2).
    expect(baseX + offX + w / 2).toBeLessThan(1.55);
    // Tidal stretch is bounded — never blows up.
    expect(subject.scale.x).toBeLessThan(2.0);
    expect(subject.scale.y).toBeGreaterThan(0.5);
    expect(Number.isFinite(subject.scale.x)).toBe(true);
    inst.dispose();
  });

  it('never writes non-finite transforms under a hostile pointer', () => {
    const { target, inst, subject } = fresh();
    (target.userData as { pointer: unknown }).pointer = { x: NaN, y: Infinity };
    let t = settle(inst, 0, 30);
    (target.userData as { pointer: unknown }).pointer = undefined;
    settle(inst, t, 30);
    expect(Number.isFinite(subject.position.x)).toBe(true);
    expect(Number.isFinite(subject.position.y)).toBe(true);
    expect(Number.isFinite(subject.scale.x)).toBe(true);
    expect(Number.isFinite(subject.scale.y)).toBe(true);
    expect(Number.isFinite(subject.rotation.z)).toBe(true);
    inst.dispose();
  });

  it('dispose restores the full home transform AND removes the motes', () => {
    const { target, inst, subject } = fresh();
    const before = {
      px: subject.position.x, py: subject.position.y, pz: subject.position.z,
      sx: subject.scale.x, sy: subject.scale.y, sz: subject.scale.z,
      rz: subject.rotation.z,
    };
    // The instance was already created (motes sprite added), so the baseline
    // includes it; dispose must drop the child count back by exactly one.
    const childCountWithMotes = target.object.children.length;

    idle(target, inst);
    target.userData.pointer = { x: 0.9, y: 0.2 };
    settle(inst, 0, 80);
    const moved =
      Math.abs(subject.position.x - before.px) + Math.abs(subject.scale.x - before.sx);
    expect(moved).toBeGreaterThan(0.02);
    expect(findMotes(target)).not.toBeNull();

    inst.dispose();
    expect(subject.position.x).toBe(before.px);
    expect(subject.position.y).toBe(before.py);
    expect(subject.position.z).toBe(before.pz);
    expect(subject.scale.x).toBe(before.sx);
    expect(subject.scale.y).toBe(before.sy);
    expect(subject.scale.z).toBe(before.sz);
    expect(subject.rotation.z).toBe(before.rz);
    // The motes sprite was removed and the child count dropped by one.
    expect(findMotes(target)).toBeNull();
    expect(target.object.children.length).toBe(childCountWithMotes - 1);
  });
});
