import { describe, it, expect } from 'vitest';
import { Box3, Mesh, Vector3, type Material, type Object3D } from 'three';
import { scrollOrbitScrubPrimitive } from '@/lib/prism/animatable/primitives/scroll-orbit-scrub';
import { makeTarget, runConformance } from './_conformance';

const DEG2RAD = Math.PI / 180;
// Mirror the primitive's facing-yaw saturation cap (52°) and its bounded-yaw
// formula so the test asserts the real (anti-blank-face) rotation.
const YAW_CAP = 52 * DEG2RAD;
const cappedYaw = (theta: number) => YAW_CAP * Math.tanh(theta / YAW_CAP);
// Mirror the steady banked-roll envelope (a saturating lean, never sin θ).
const ROLL_REF = 90 * DEG2RAD;
const roll = (tiltRad: number, theta: number) => tiltRad * Math.tanh(theta / ROLL_REF);

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

  it('plays: bounded facing yaw, arc translation, and z bow track scroll position', () => {
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

    // scroll=0.25 → a quarter of the default 200° orbit (θ=50°): the yaw is the
    // BOUNDED facing parallax, not the raw θ (anti-blank-face cap).
    target.userData.scroll = 0.25;
    inst.seek(0);
    expect(subject.rotation.y).toBeCloseTo(-cappedYaw(200 * DEG2RAD * 0.25), 10);

    // scroll=0.5 (the advocate's pinned control frame, θ=100°) → the card has
    // swung wide along the arc and bowed back in z, but its yaw is capped well
    // short of edge-on so the front chrome stays legible.
    target.userData.scroll = 0.5;
    inst.seek(0);
    const theta = 200 * DEG2RAD * 0.5;
    expect(subject.rotation.y).toBeCloseTo(-cappedYaw(theta), 10);
    // The capped yaw is strictly inside the 90° edge-on blank-out (the fix).
    expect(Math.abs(subject.rotation.y), 'yaw stays short of edge-on').toBeLessThan(80 * DEG2RAD);
    expect(subject.position.x, 'arc sweep at mid').toBeCloseTo(-0.4 * size * Math.sin(theta), 6);
    expect(subject.position.z, 'z bow at mid').toBeCloseTo(-0.4 * size * (1 - Math.cos(theta)), 6);
    expect(subject.position.z).toBeLessThan(-0.05); // genuinely recedes

    // scroll=1 → the full default orbit (θ=200°): yaw saturates at the cap.
    target.userData.scroll = 1;
    inst.seek(0);
    expect(subject.rotation.y).toBeCloseTo(-cappedYaw(200 * DEG2RAD), 10);
    expect(Math.abs(subject.rotation.y), 'yaw never reaches edge-on').toBeLessThan(YAW_CAP + 1e-9);

    inst.dispose();
  });

  it('REGRESSION: the facing yaw never crosses edge-on at ANY scroll or orbit (no blank back face)', () => {
    const target = makeTarget(scrollOrbitScrubPrimitive);
    const subject = target.subject as Object3D;
    const inst = scrollOrbitScrubPrimitive.create(target);

    // Sweep the worst case: max orbit (360°) across the whole scroll range. The
    // yaw must stay strictly inside ±YAW_CAP — the card's front never turns
    // away, so no sampled frame can show the featureless back (MF0+MF1).
    inst.setControl('orbitDeg', 360);
    let maxAbsYaw = 0;
    for (let i = 0; i <= 60; i++) {
      target.userData.scroll = i / 60;
      inst.seek(0);
      maxAbsYaw = Math.max(maxAbsYaw, Math.abs(subject.rotation.y));
    }
    expect(maxAbsYaw, 'yaw bounded by the cap').toBeLessThanOrEqual(YAW_CAP + 1e-9);
    expect(maxAbsYaw, 'cap actually engaged at the widest sweep').toBeGreaterThan(0.9 * YAW_CAP);
    // Comfortably short of the 70° point where the dark back starts to show.
    expect(maxAbsYaw, 'front stays legible — never near edge-on').toBeLessThan(70 * DEG2RAD);

    inst.dispose();
  });

  it('controls change output at scroll=0.5 (the pinned control frame)', () => {
    const target = makeTarget(scrollOrbitScrubPrimitive);
    const subject = target.subject as Object3D;
    const size = medianSize(subject);
    const inst = scrollOrbitScrubPrimitive.create(target);
    target.userData.scroll = 0.5;

    // orbitDeg reshapes the yaw (and arc) at the pinned frame: more orbit ⇒ a
    // larger bounded yaw, monotonically up to the cap.
    inst.setControl('orbitDeg', 90);
    inst.seek(1);
    const yawLow = subject.rotation.y;
    expect(yawLow).toBeCloseTo(-cappedYaw(90 * DEG2RAD * 0.5), 10);
    inst.setControl('orbitDeg', 360);
    inst.seek(1);
    const yawHigh = subject.rotation.y;
    expect(yawHigh).toBeCloseTo(-cappedYaw(360 * DEG2RAD * 0.5), 10);
    expect(Math.abs(yawHigh), 'wider orbit ⇒ more facing parallax').toBeGreaterThan(Math.abs(yawLow));
    expect(Math.abs(yawHigh), 'but still capped short of edge-on').toBeLessThan(YAW_CAP + 1e-9);

    // arcDepth reshapes the translation at the pinned frame (back at default orbit).
    inst.setControl('orbitDeg', 200);
    inst.setControl('arcDepth', 0);
    inst.seek(1);
    expect(Math.abs(subject.position.x), 'no arc at depth 0').toBeLessThan(1e-9);
    inst.setControl('arcDepth', 0.8);
    inst.seek(1);
    expect(Math.abs(subject.position.x), 'wide arc at depth 0.8').toBeGreaterThan(0.5);
    expect(subject.position.x).toBeCloseTo(-0.8 * size * Math.sin(100 * DEG2RAD), 6);

    // counterTilt reshapes the bank at the pinned frame. The steady lean is a
    // tanh envelope of θ — nonzero across the whole engaged range.
    inst.setControl('arcDepth', 0.4);
    inst.setControl('counterTiltDeg', 0);
    inst.seek(1);
    expect(Math.abs(subject.rotation.z), 'no bank at tilt 0').toBeLessThan(1e-9);
    inst.setControl('counterTiltDeg', 28);
    inst.seek(1);
    const thetaMid = 200 * DEG2RAD * 0.5; // orbit 200, scroll 0.5 → 100°
    expect(Math.abs(subject.rotation.z), 'banked at tilt 28').toBeCloseTo(
      roll(28 * DEG2RAD, thetaMid),
      6,
    );
    expect(Math.abs(subject.rotation.z), 'bank is clearly nonzero').toBeGreaterThan(5 * DEG2RAD);

    // MF2 regression: the bank must NOT vanish at the degenerate θ=180° the rig
    // lands on when orbitDeg is left at its 360° max — the old sin θ roll did.
    inst.setControl('orbitDeg', 360);
    inst.setControl('counterTiltDeg', 28);
    inst.seek(1);
    expect(Math.abs(subject.rotation.z), 'bank still live at θ=180°').toBeGreaterThan(5 * DEG2RAD);
    expect(Math.abs(subject.rotation.z), 'tanh lean at θ=180°').toBeCloseTo(
      roll(28 * DEG2RAD, Math.PI),
      6,
    );
    inst.setControl('orbitDeg', 200);

    // direction toggle mirrors the whole pose.
    inst.setControl('counterTiltDeg', 12);
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
    expect(subject.rotation.y).toBeCloseTo(-cappedYaw(200 * DEG2RAD * 0.5), 10);

    // Sweep a control while PAUSED — the pose must reshape immediately.
    inst.setControl('orbitDeg', 360);
    expect(subject.rotation.y, 'pose reshaped without re-seek').toBeCloseTo(
      -cappedYaw(360 * DEG2RAD * 0.5),
      10,
    );

    // Counter-tilt too: a paused bank tweak lands at once (MF2). The steady
    // tanh lean stays live even at the θ=180° the rig pins when orbitDeg is at
    // its 360° max (orbitDeg is still 360 here from the sweep above).
    inst.setControl('counterTiltDeg', 28);
    expect(Math.abs(subject.rotation.z), 'bank reshaped without re-seek').toBeCloseTo(
      roll(28 * DEG2RAD, 360 * DEG2RAD * 0.5),
      6,
    );
    expect(Math.abs(subject.rotation.z), 'bank is clearly visible at θ=180°').toBeGreaterThan(5 * DEG2RAD);

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
