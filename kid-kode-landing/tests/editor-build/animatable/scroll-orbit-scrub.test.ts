import { describe, it, expect } from 'vitest';
import { Box3, Mesh, Vector3, type Material, type Object3D } from 'three';
import { scrollOrbitScrubPrimitive } from '@/lib/prism/animatable/primitives/scroll-orbit-scrub';
import { makeTarget, runConformance } from './_conformance';

const DEG2RAD = Math.PI / 180;

/** Median bbox dimension — mirrors the primitive's subject-relative unit
 *  (measured at rest, before any seek perturbs the pose). */
function medianSize(subject: Object3D): number {
  const dims = new Box3().setFromObject(subject).getSize(new Vector3());
  return [dims.x, dims.y, dims.z].sort((a, b) => a - b)[1];
}

describe('scroll-orbit-scrub primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollOrbitScrubPrimitive).dispose();
  });

  it('plays: yaw, arc translation, and z bow track scroll position', () => {
    const target = makeTarget(scrollOrbitScrubPrimitive);
    const subject = target.subject as Object3D;
    const size = medianSize(subject);
    const inst = scrollOrbitScrubPrimitive.create(target);

    // scroll=0 → the rest pose, dead-on front (idle frame fully legible).
    target.userData.scroll = 0;
    inst.seek(0);
    expect(subject.rotation.y, 'yaw at rest').toBeCloseTo(0, 10);
    expect(subject.rotation.z, 'bank at rest').toBeCloseTo(0, 10);
    expect(subject.position.x, 'x at rest').toBeCloseTo(0, 10);
    expect(subject.position.z, 'z at rest').toBeCloseTo(0, 10);

    // scroll=0.25 → a quarter of the default 160° orbit: yaw = -40° exactly.
    target.userData.scroll = 0.25;
    inst.seek(0);
    expect(subject.rotation.y).toBeCloseTo(-(160 * DEG2RAD) * 0.25, 10);

    // scroll=0.5 (the advocate's pinned control frame) → yaw -80°, the card
    // swung sideways along the arc and bowed back in z.
    target.userData.scroll = 0.5;
    inst.seek(0);
    const theta = 160 * DEG2RAD * 0.5;
    expect(subject.rotation.y).toBeCloseTo(-theta, 10);
    expect(subject.position.x, 'arc sweep at mid').toBeCloseTo(-0.35 * size * Math.sin(theta), 6);
    expect(subject.position.z, 'z bow at mid').toBeCloseTo(-0.35 * size * (1 - Math.cos(theta)), 6);
    expect(subject.position.z).toBeLessThan(-0.05); // genuinely recedes

    // scroll=1 → the full default orbit: yaw -160°.
    target.userData.scroll = 1;
    inst.seek(0);
    expect(subject.rotation.y).toBeCloseTo(-(160 * DEG2RAD), 10);

    inst.dispose();
  });

  it('controls change output at scroll=0.5 (the pinned control frame)', () => {
    const target = makeTarget(scrollOrbitScrubPrimitive);
    const subject = target.subject as Object3D;
    const size = medianSize(subject);
    const inst = scrollOrbitScrubPrimitive.create(target);
    target.userData.scroll = 0.5;

    // orbitDeg reshapes the yaw at the pinned frame: 90° → -45°, 360° → -180°.
    inst.setControl('orbitDeg', 90);
    inst.seek(1);
    expect(subject.rotation.y).toBeCloseTo(-(90 * DEG2RAD) * 0.5, 10);
    inst.setControl('orbitDeg', 360);
    inst.seek(1);
    expect(subject.rotation.y).toBeCloseTo(-Math.PI, 10);

    // arcDepth reshapes the translation at the pinned frame (back at default orbit).
    inst.setControl('orbitDeg', 160);
    inst.setControl('arcDepth', 0);
    inst.seek(1);
    expect(Math.abs(subject.position.x), 'no arc at depth 0').toBeLessThan(1e-9);
    inst.setControl('arcDepth', 0.8);
    inst.seek(1);
    expect(Math.abs(subject.position.x), 'wide arc at depth 0.8').toBeGreaterThan(0.5);
    expect(subject.position.x).toBeCloseTo(-0.8 * size * Math.sin(80 * DEG2RAD), 6);

    // counterTilt reshapes the bank at the pinned frame.
    inst.setControl('arcDepth', 0.35);
    inst.setControl('counterTiltDeg', 0);
    inst.seek(1);
    expect(Math.abs(subject.rotation.z), 'no bank at tilt 0').toBeLessThan(1e-9);
    inst.setControl('counterTiltDeg', 15);
    inst.seek(1);
    expect(Math.abs(subject.rotation.z), 'banked at tilt 15').toBeCloseTo(
      15 * DEG2RAD * Math.sin(80 * DEG2RAD),
      6,
    );

    // direction toggle mirrors the whole pose.
    inst.setControl('counterTiltDeg', 6);
    inst.seek(1);
    const yawFwd = subject.rotation.y;
    const xFwd = subject.position.x;
    const bankFwd = subject.rotation.z;
    inst.setControl('reverse', true);
    inst.seek(1);
    expect(subject.rotation.y).toBeCloseTo(-yawFwd, 10);
    expect(subject.position.x).toBeCloseTo(-xFwd, 10);
    expect(subject.rotation.z).toBeCloseTo(-bankFwd, 10);

    inst.dispose();
  });

  it('onParamChange re-applies the pose at the last seek state without a new seek', () => {
    const target = makeTarget(scrollOrbitScrubPrimitive);
    const subject = target.subject as Object3D;
    const inst = scrollOrbitScrubPrimitive.create(target);

    target.userData.scroll = 0.5;
    inst.seek(1.0); // the advocate's pinned t=1s frame
    expect(subject.rotation.y).toBeCloseTo(-(160 * DEG2RAD) * 0.5, 10);

    // Sweep a control while PAUSED — the pose must reshape immediately.
    inst.setControl('orbitDeg', 360);
    expect(subject.rotation.y, 'pose reshaped without re-seek').toBeCloseTo(-Math.PI, 10);

    inst.dispose();
  });

  it('repeated seeks at the same pinned state are idempotent (paused control sweeps)', () => {
    const target = makeTarget(scrollOrbitScrubPrimitive);
    const subject = target.subject as Object3D;
    const inst = scrollOrbitScrubPrimitive.create(target);
    target.userData.scroll = 0.5;

    inst.seek(1.0);
    const pose = {
      ry: subject.rotation.y,
      rz: subject.rotation.z,
      x: subject.position.x,
      z: subject.position.z,
    };
    inst.seek(1.0);
    inst.seek(1.0);
    expect(subject.rotation.y).toBe(pose.ry);
    expect(subject.rotation.z).toBe(pose.rz);
    expect(subject.position.x).toBe(pose.x);
    expect(subject.position.z).toBe(pose.z);

    inst.dispose();
  });

  it('REGRESSION: arc travel is subject-relative — doubling the subject doubles the sweep', () => {
    const small = makeTarget(scrollOrbitScrubPrimitive);
    const big = makeTarget(scrollOrbitScrubPrimitive);
    (big.subject as Object3D).scale.setScalar(2);

    const smallInst = scrollOrbitScrubPrimitive.create(small);
    const bigInst = scrollOrbitScrubPrimitive.create(big);

    small.userData.scroll = 0.5;
    big.userData.scroll = 0.5;
    smallInst.seek(0);
    bigInst.seek(0);

    const smallSweep = Math.abs((small.subject as Object3D).position.x);
    const bigSweep = Math.abs((big.subject as Object3D).position.x);
    expect(smallSweep).toBeGreaterThan(0);
    expect(bigSweep, 'sweep scales with the subject').toBeGreaterThan(smallSweep * 1.5);

    smallInst.dispose();
    bigInst.dispose();
  });

  it('REGRESSION: z bow is bounded — never parks the subject deep behind the backdrop', () => {
    const target = makeTarget(scrollOrbitScrubPrimitive);
    const subject = target.subject as Object3D;
    const size = medianSize(subject);
    const inst = scrollOrbitScrubPrimitive.create(target);

    // Worst case: max arc depth + full 360° orbit (unclamped bow would reach
    // -2 × 0.8 × size = -1.6×size at θ=180°; the envelope caps it at -1.2×size).
    inst.setControl('arcDepth', 0.8);
    inst.setControl('orbitDeg', 360);
    let minZ = Infinity;
    for (let i = 0; i <= 40; i++) {
      target.userData.scroll = i / 40;
      inst.seek(0);
      minZ = Math.min(minZ, subject.position.z);
    }
    expect(minZ, 'bow capped at 1.2×size').toBeGreaterThanOrEqual(-1.2 * size - 1e-6);
    expect(minZ, 'clamp actually engaged at the far side').toBeCloseTo(-1.2 * size, 6);

    inst.dispose();
  });

  it('dispose restores rotation and position exactly; materials never touched', () => {
    const target = makeTarget(scrollOrbitScrubPrimitive);
    const subject = target.subject as Object3D;
    const mat = (subject as Mesh).material as Material & { opacity: number };
    const base = {
      rx: subject.rotation.x,
      ry: subject.rotation.y,
      rz: subject.rotation.z,
      x: subject.position.x,
      y: subject.position.y,
      z: subject.position.z,
      opacity: mat.opacity,
      transparent: mat.transparent,
    };

    const inst = scrollOrbitScrubPrimitive.create(target);
    target.userData.scroll = 0.7;
    inst.seek(0);
    expect(subject.rotation.y).not.toBeCloseTo(base.ry, 3); // it really moved

    inst.dispose();
    expect(subject.rotation.x).toBeCloseTo(base.rx, 12);
    expect(subject.rotation.y).toBeCloseTo(base.ry, 12);
    expect(subject.rotation.z).toBeCloseTo(base.rz, 12);
    expect(subject.position.x).toBeCloseTo(base.x, 12);
    expect(subject.position.y).toBeCloseTo(base.y, 12);
    expect(subject.position.z).toBeCloseTo(base.z, 12);
    // The subject's own look is sacred — this primitive is pure transform.
    expect(mat.opacity).toBe(base.opacity);
    expect(mat.transparent).toBe(base.transparent);
  });
});
