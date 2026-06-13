// velocity-skew-follow — behavior tests.
//
// The primitive is a Cuberto mouse-follower made physical: the card chases a
// pointer-mapped target with an expo.out lerp (pos += (target-pos)*(1-exp(-k*dt))),
// and the VELOCITY of that chase drives a skew — rotation.z lean + a slight
// anisotropic stretch along the travel axis, clamped like skewingDeltaMax. A
// decaying lastImpulse persists the lean so a pinned engaged frame holds a
// visible skew that skewAmount / speed sweeps re-shape.
//
// We assert:
//  - the card TRAVELS toward a moving pointer across consecutive seeks (chase),
//  - a fast pointer move bends the card into the turn (rotation.z skew engaged)
//    while a slow / settled pointer eases the skew back toward flat,
//  - the engaged pin {x:0.62,y:0.5} holds a persistent lean, and EVERY control
//    re-shapes that pinned (dt≈0) pose immediately (onParamChange),
//  - travel stays bounded subject-relative (never leaves the tile frame),
//  - the idle disengaged frame (pointer centered, first seek) is the home pose,
//  - dispose restores position / rotation / scale exactly.

import { describe, it, expect } from 'vitest';
import { Box3, Vector3, type Object3D } from 'three';
import { velocitySkewFollowPrimitive } from '@/lib/prism/animatable/primitives/velocity-skew-follow';
import { makeTarget, runConformance } from './_conformance';
import type { AnimatableTarget, ParamState } from '@/lib/prism/animatable/contract';

/** Fresh target + instance with optional param overrides. */
function fresh(overrides?: Partial<ParamState>) {
  const target: AnimatableTarget = makeTarget(velocitySkewFollowPrimitive);
  const inst = velocitySkewFollowPrimitive.create(target, overrides);
  return { target, inst, subject: target.subject as Object3D };
}

/** Measure the subject's bbox width (the primitive's horizontal travel unit). */
function subjectWidth(subject: Object3D): number {
  return new Box3().setFromObject(subject).getSize(new Vector3()).x;
}

/** Seed the closure with a clean idle frame (disengaged, centered, t=0). */
function idle(target: AnimatableTarget, inst: { seek(t: number): void }) {
  target.userData.pointer = { x: 0.5, y: 0.5 };
  inst.seek(0);
}

describe('velocity-skew-follow primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(velocitySkewFollowPrimitive).dispose();
  });

  it('idle disengaged frame is the home pose (legible at rest)', () => {
    const { target, inst, subject } = fresh();
    const baseX = subject.position.x;
    const baseY = subject.position.y;
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0); // first seek, disengaged center
    expect(subject.position.x).toBeCloseTo(baseX, 6);
    expect(subject.position.y).toBeCloseTo(baseY, 6);
    expect(subject.rotation.z).toBeCloseTo(0, 6);
    expect(subject.scale.x).toBeCloseTo(1, 6);
    expect(subject.scale.y).toBeCloseTo(1, 6);
    inst.dispose();
  });

  it('chase: the card TRAVELS toward a moving pointer across consecutive seeks', () => {
    // Slow follower (low speed) so the chase stays visibly en route across the
    // sampled frames; a modest engaged offset so the target is not frame-clamped.
    const { target, inst, subject } = fresh({ speed: 0.1 });
    const baseX = subject.position.x;
    idle(target, inst);

    // Pointer steps to the right of center; the chase pulls the card along +x,
    // monotone-increasing as it converges toward the bare target.
    target.userData.pointer = { x: 0.66, y: 0.5 };
    inst.seek(0.016);
    const step1 = subject.position.x - baseX;
    inst.seek(0.032);
    const step2 = subject.position.x - baseX;
    inst.seek(0.064);
    const step3 = subject.position.x - baseX;

    // Monotone travel toward the +x target.
    expect(step1).toBeGreaterThan(0);
    expect(step2).toBeGreaterThan(step1);
    expect(step3).toBeGreaterThan(step2);

    // A leftward pointer pulls it back the other way (past center, to −x).
    target.userData.pointer = { x: 0.1, y: 0.5 };
    for (let i = 1; i <= 60; i++) inst.seek(0.064 + i * 0.016);
    expect(subject.position.x - baseX).toBeLessThan(0);
    inst.dispose();
  });

  it('velocity drives skew: a fast turn bends the card harder than it rests; a settled pointer eases toward the steady lean', () => {
    const { target, inst, subject } = fresh();
    idle(target, inst);

    // Fast pointer flick to a modest engaged offset → high chase velocity → the
    // live velocity skew SPIKES well above the steady held lean.
    target.userData.pointer = { x: 0.66, y: 0.5 };
    inst.seek(0.016);
    const fastSkew = Math.abs(subject.rotation.z);
    expect(fastSkew).toBeGreaterThan(0.01);
    // Travel direction is +x; the lean is signed into the turn.
    const fastSign = Math.sign(subject.rotation.z);
    expect(fastSign).toBe(1);

    // Hold the pointer still → chase velocity decays → skew eases DOWN toward the
    // (smaller) steady engaged lean: the velocity component is gone, only the held
    // swagger remains, so the resting skew is clearly below the flick spike.
    for (let i = 1; i <= 180; i++) inst.seek(0.016 + i * 0.016);
    const settledSkew = Math.abs(subject.rotation.z);
    expect(settledSkew).toBeLessThan(fastSkew);

    // A fast turn the OTHER way flips the lean sign.
    target.userData.pointer = { x: 0.34, y: 0.5 };
    inst.seek(0.016 * 183);
    expect(Math.sign(subject.rotation.z)).toBe(-fastSign);
    inst.dispose();
  });

  it('engaged pin {0.62,0.5}: holds a persistent lean and EVERY control re-shapes the pinned pose', () => {
    const { target, inst, subject } = fresh();
    const baseX = subject.position.x;

    // Drive in to the engaged pin with a real velocity, then PIN (repeated same-t).
    idle(target, inst);
    target.userData.pointer = { x: 0.62, y: 0.5 };
    for (let i = 1; i <= 40; i++) inst.seek(i * 0.016);
    inst.seek(0.7); // first seek at the pin t: a final live settling step.
    // The rig now seeks the SAME t repeatedly; the dt≈0 path re-derives the
    // engaged steady pose. Capture after the first pinned seek, then assert every
    // seek after it holds that frame byte-stable.
    inst.seek(0.7);
    const pinnedZ = subject.rotation.z;
    const pinnedX = subject.position.x;
    for (let i = 0; i < 3; i++) inst.seek(0.7);
    expect(subject.rotation.z).toBeCloseTo(pinnedZ, 12);
    expect(subject.position.x).toBeCloseTo(pinnedX, 12);

    // Engaged: clearly displaced from rest AND clearly leaning (not an empty/flat frame).
    expect(Math.abs(pinnedX - baseX)).toBeGreaterThan(0.02);
    expect(Math.abs(pinnedZ)).toBeGreaterThan(0.005);

    // skewAmount sweep → the pinned lean magnitude grows (no extra seek: onParamChange).
    inst.setControl('skewAmount', 0.1);
    const lowSkew = Math.abs(subject.rotation.z);
    inst.setControl('skewAmount', 1.4);
    const hiSkew = Math.abs(subject.rotation.z);
    expect(hiSkew).toBeGreaterThan(lowSkew + 0.01);
    inst.setControl('skewAmount', 0.7);

    // speed sweep → a snappier chase eats less of the engaged impulse, so the
    // persistent lean differs between a buttery and a tight follower at the pin.
    inst.setControl('speed', 0.1);
    const buttery = Math.abs(subject.rotation.z);
    inst.setControl('speed', 0.9);
    const tight = Math.abs(subject.rotation.z);
    expect(Math.abs(buttery - tight)).toBeGreaterThan(0.005);
    inst.setControl('speed', 0.4);

    // skewClamp sweep → tightening the clamp caps the pinned lean magnitude.
    inst.setControl('skewAmount', 1.4); // push hard so the clamp bites
    inst.setControl('skewClamp', 0.4);
    const wide = Math.abs(subject.rotation.z);
    inst.setControl('skewClamp', 0.04);
    const clamped = Math.abs(subject.rotation.z);
    expect(clamped).toBeLessThan(wide);
    expect(clamped).toBeLessThanOrEqual(0.04 + 1e-6);
    inst.setControl('skewClamp', 0.28);
    inst.setControl('skewAmount', 0.7);

    // span sweep → the pinned chase position migrates farther for the same offset.
    inst.setControl('span', 0.25);
    const nearX = subject.position.x;
    inst.setControl('span', 1.0);
    const farX = subject.position.x;
    expect(Math.abs(farX - baseX)).toBeGreaterThan(Math.abs(nearX - baseX) + 0.02);

    inst.dispose();
  });

  it('advocate rig pin {0.5,0.7} (purely vertical offset, dt≈0): speed / skewAmount / skewClamp each reshape the engaged-pose rotation.z', () => {
    // EXACT reproduction of the W4 user-advocate capture that BLOCKED this tile:
    // the paused control sweep pins the pointer at the rig's mid-orbit phase
    // (t=1, dur=4 ⇒ ph=0.25), which lands the synthetic pointer at {x:0.5,y:0.7}
    // — X dead-center, offset PURELY VERTICAL — and SEEKS THE SAME t REPEATEDLY
    // (dt≈0) while sweeping each control. The earlier x-only steady reference read
    // 0 lean there, so speed/skewAmount/skewClamp measured byte-identical
    // (meanAbsDiff=0) and the tile blocked. The standing reference is now the full
    // pointer-offset MAGNITUDE, so the vertical pin engages a non-zero lean that
    // every velocity-coupled control re-shapes. These assertions sweep each
    // control at the STATIC pin via onParamChange (no re-seek) — exactly the rig's
    // measurement surface (a published engaged-pose output: rotation.z).
    const { target, inst, subject } = fresh();

    // Drive in then PIN at the advocate pointer with repeated same-t seeks.
    idle(target, inst);
    target.userData.pointer = { x: 0.5, y: 0.7 };
    for (let i = 1; i <= 40; i++) inst.seek(i * 0.016);
    inst.seek(1); // settle to the pin t
    for (let i = 0; i < 3; i++) inst.seek(1); // dt≈0 repeated seeks (frozen frame)

    // Frozen frame is byte-stable across repeated pinned seeks.
    const pinnedZ = subject.rotation.z;
    for (let i = 0; i < 3; i++) inst.seek(1);
    expect(subject.rotation.z).toBeCloseTo(pinnedZ, 12);
    // And it is a REAL engaged lean at this purely-vertical pin (the old bug: 0).
    expect(Math.abs(pinnedZ)).toBeGreaterThan(0.005);

    // speed: a slower chase (low speed → low k) sits farther behind its target,
    // holding a LARGER persistent lean than a snappy follower. Swept via
    // onParamChange at the static pin — no seek — mirroring the rig's fill().
    inst.setControl('speed', 0.05);
    const speedSlow = Math.abs(subject.rotation.z);
    inst.setControl('speed', 0.9);
    const speedFast = Math.abs(subject.rotation.z);
    expect(speedSlow).toBeGreaterThan(speedFast + 0.01); // formerly DEAD (Δ=0)
    inst.setControl('speed', 0.4);

    // skewAmount: scales the standing lean. Wide clamp so the gain is the only cap.
    inst.setControl('skewClamp', 0.6);
    inst.setControl('skewAmount', 0.1);
    const amtLow = Math.abs(subject.rotation.z);
    inst.setControl('skewAmount', 1.4);
    const amtHigh = Math.abs(subject.rotation.z);
    expect(amtHigh).toBeGreaterThan(amtLow + 0.01); // formerly DEAD (Δ=0)

    // skewClamp: caps the standing lean. Push the lean hard (slow + max amount) so
    // the clamp is the binding limit, then a tight clamp visibly shrinks the pose.
    inst.setControl('speed', 0.05);
    inst.setControl('skewAmount', 1.4);
    inst.setControl('skewClamp', 0.6);
    const clampWide = Math.abs(subject.rotation.z);
    inst.setControl('skewClamp', 0.04);
    const clampTight = Math.abs(subject.rotation.z);
    expect(clampTight).toBeLessThan(clampWide - 0.01); // formerly DEAD (Δ=0)
    expect(clampTight).toBeLessThanOrEqual(0.04 + 1e-6); // the clamp truly binds

    inst.dispose();
  });

  it('travel stays bounded subject-relative inside the tile frame at max span / extreme pointer', () => {
    const { target, inst, subject } = fresh({ span: 1.0 });
    const w = subjectWidth(subject);
    const baseX = subject.position.x;
    idle(target, inst);
    // Pointer slammed to the far corner; drive to convergence.
    target.userData.pointer = { x: 1, y: 1 };
    for (let i = 1; i <= 300; i++) inst.seek(i * 0.016);
    const offX = subject.position.x - baseX;
    // Card's near edge stays inside the tile half-width (~1.55 @ fov40 z3.2),
    // bounded subject-relative (its own half-width never pushed off-frame).
    expect(baseX + offX + w / 2).toBeLessThan(1.55);
    expect(Math.abs(offX)).toBeLessThanOrEqual(w * 1.0 + 1e-6); // never past the bare span target
    inst.dispose();
  });

  it('dispose restores position, rotation, and scale exactly', () => {
    const { target, inst, subject } = fresh();
    const before = {
      px: subject.position.x, py: subject.position.y,
      rz: subject.rotation.z,
      sx: subject.scale.x, sy: subject.scale.y,
    };
    idle(target, inst);
    target.userData.pointer = { x: 0.9, y: 0.2 };
    for (let i = 1; i <= 40; i++) inst.seek(i * 0.02);
    inst.setControl('skewAmount', 1.2);
    inst.dispose();
    expect(subject.position.x).toBeCloseTo(before.px, 12);
    expect(subject.position.y).toBeCloseTo(before.py, 12);
    expect(subject.rotation.z).toBeCloseTo(before.rz, 12);
    expect(subject.scale.x).toBeCloseTo(before.sx, 12);
    expect(subject.scale.y).toBeCloseTo(before.sy, 12);
  });
});
