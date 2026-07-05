import { describe, it, expect } from 'vitest';
import { type Material, type Mesh, type Object3D } from 'three';
import { scrollPathScrubPrimitive } from '@/lib/prism/animatable/primitives/scroll-path-scrub';
import { makeTarget, runConformance } from './_conformance';

type FadableMaterial = Material & { opacity: number };

/** Pose helper: seek the instance at a scroll value and return the subject's
 *  current transform (positions + rotations copied out, not live refs). */
function poseAt(
  target: ReturnType<typeof makeTarget>,
  inst: { seek: (t: number) => void },
  scroll: number,
) {
  const subject = target.subject as Object3D;
  target.userData.scroll = scroll;
  inst.seek(0);
  return {
    px: subject.position.x,
    py: subject.position.y,
    pz: subject.position.z,
    rx: subject.rotation.x,
    ry: subject.rotation.y,
    rz: subject.rotation.z,
  };
}

describe('scroll-path-scrub primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollPathScrubPrimitive).dispose();
  });

  it('plays: scroll scrubs the card along a 3D path (x sweeps, y bends, z stays bounded)', () => {
    const target = makeTarget(scrollPathScrubPrimitive);
    const inst = scrollPathScrubPrimitive.create(target);

    const start = poseAt(target, inst, 0);
    const mid = poseAt(target, inst, 0.5);
    const end = poseAt(target, inst, 1);

    // Default s-curve sweeps across the tile: x strictly advances start→mid→end.
    expect(mid.px).toBeGreaterThan(start.px + 0.2);
    expect(end.px).toBeGreaterThan(mid.px + 0.2);
    // Total sweep is substantial — a real track, not a nudge.
    expect(end.px - start.px).toBeGreaterThan(0.8);

    // The track is curved, not a straight line: y deviates from the straight
    // chord between the endpoints somewhere along the sweep.
    let maxChordDev = 0;
    for (let i = 0; i <= 20; i++) {
      const s = i / 20;
      const p = poseAt(target, inst, s);
      const chordY = start.py + (end.py - start.py) * s;
      maxChordDev = Math.max(maxChordDev, Math.abs(p.py - chordY));
    }
    expect(maxChordDev, 'path bends away from the straight chord').toBeGreaterThan(0.1);

    // z is BOUNDED across the whole sweep (never dives behind the backdrop —
    // the scroll-depth-dolly P0 lesson). Subject is ~1.1 units; default travel
    // keeps |z offset| well under half a subject-size.
    for (let i = 0; i <= 20; i++) {
      const p = poseAt(target, inst, i / 20);
      expect(Math.abs(p.pz), `|z offset| bounded at scroll=${i / 20}`).toBeLessThan(0.6);
    }

    inst.dispose();
  });

  it('orients to the path: yaw engages at mid-track and banking rolls into the curves', () => {
    const target = makeTarget(scrollPathScrubPrimitive);
    const inst = scrollPathScrubPrimitive.create(target);

    // At the engaged mid-state (the advocate's pinned frame) the tangent is
    // diagonal, so orient-to-path yaw is clearly nonzero.
    const mid = poseAt(target, inst, 0.5);
    expect(Math.abs(mid.ry), 'yaw at scroll=0.5').toBeGreaterThan(0.1);

    // Banking rolls the card somewhere along the track (turn rate ≠ 0).
    let maxRoll = 0;
    for (let i = 0; i <= 20; i++) {
      const p = poseAt(target, inst, i / 20);
      maxRoll = Math.max(maxRoll, Math.abs(p.rz));
    }
    expect(maxRoll, 'bank engages somewhere on the track').toBeGreaterThan(0.08);

    inst.dispose();
  });

  it('controls change output at scroll=0.5 (the advocate pinned frame): all four controls reshape the pose', () => {
    const target = makeTarget(scrollPathScrubPrimitive);
    const inst = scrollPathScrubPrimitive.create(target);

    // PATH dropdown: arc vs s-curve land at visibly different mid-poses.
    const sCurve = poseAt(target, inst, 0.5);
    inst.setControl('path', 'arc');
    const arc = poseAt(target, inst, 0.5);
    const pathDelta =
      Math.abs(arc.px - sCurve.px) + Math.abs(arc.py - sCurve.py) + Math.abs(arc.pz - sCurve.pz);
    expect(pathDelta, 'path dropdown moves the mid-pose').toBeGreaterThan(0.1);
    inst.setControl('path', 'loop');
    const loop = poseAt(target, inst, 0.5);
    const loopDelta =
      Math.abs(loop.px - arc.px) + Math.abs(loop.py - arc.py) + Math.abs(loop.pz - arc.pz);
    expect(loopDelta, 'loop is distinct from arc at mid').toBeGreaterThan(0.1);
    inst.setControl('path', 's-curve');

    // BANK knob: roll at the pinned frame responds to the knob.
    inst.setControl('bank', 0);
    const noBank = poseAt(target, inst, 0.5);
    inst.setControl('bank', 2);
    const fullBank = poseAt(target, inst, 0.5);
    expect(Math.abs(fullBank.rz - noBank.rz), 'bank knob reshapes roll at 0.5').toBeGreaterThan(0.02);
    expect(noBank.rz, 'bank=0 → no roll').toBeCloseTo(0, 6);
    inst.setControl('bank', 1);

    // TRAVEL fader: position offsets scale with the fader.
    inst.setControl('travel', 0.2);
    const short = poseAt(target, inst, 0.5);
    inst.setControl('travel', 1.5);
    const long = poseAt(target, inst, 0.5);
    const shortMag = Math.hypot(short.px, short.py, short.pz);
    const longMag = Math.hypot(long.px, long.py, long.pz);
    expect(longMag, 'travel scales the offset').toBeGreaterThan(shortMag * 2);
    inst.setControl('travel', 0.6);

    // ORIENT toggle: yaw on/off at the pinned frame.
    inst.setControl('orient', true);
    const oriented = poseAt(target, inst, 0.5);
    inst.setControl('orient', false);
    const flat = poseAt(target, inst, 0.5);
    expect(Math.abs(oriented.ry - flat.ry), 'orient toggle changes yaw at 0.5').toBeGreaterThan(0.08);
    expect(flat.ry, 'orient off → no yaw').toBeCloseTo(0, 6);

    inst.dispose();
  });

  it('onParamChange re-applies the pose at the LAST seek state without a new seek', () => {
    const target = makeTarget(scrollPathScrubPrimitive);
    const inst = scrollPathScrubPrimitive.create(target);
    const subject = target.subject as Object3D;

    target.userData.scroll = 0.7;
    inst.seek(0);
    const before = subject.position.x;

    // No further seek — the control change alone must re-pose at scroll=0.7.
    inst.setControl('travel', 1.5);
    expect(Math.abs(subject.position.x - before), 'pose re-applied on param change').toBeGreaterThan(0.05);

    inst.dispose();
  });

  it('REGRESSION: fully legible at rest and at every sampled frame — materials untouched, orientation capped', () => {
    const target = makeTarget(scrollPathScrubPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as FadableMaterial;
    const matBeforeOpacity = mat.opacity;
    const matBeforeTransparent = mat.transparent;

    const inst = scrollPathScrubPrimitive.create(target);

    for (let i = 0; i <= 20; i++) {
      const p = poseAt(target, inst, i / 20);
      // Purely a transform primitive: the subject's own look is sacred and
      // untouched — opacity never moves.
      expect(mat.opacity, `opacity untouched at scroll=${i / 20}`).toBe(matBeforeOpacity);
      // Orientation stays capped: the card never turns edge-on/invisible.
      expect(Math.abs(p.rx), `pitch capped at ${i / 20}`).toBeLessThan(1.0);
      expect(Math.abs(p.ry), `yaw capped at ${i / 20}`).toBeLessThan(1.0);
      expect(Math.abs(p.rz), `roll capped at ${i / 20}`).toBeLessThan(1.0);
    }
    expect(mat.transparent).toBe(matBeforeTransparent);

    inst.dispose();
  });

  it('REGRESSION: travel is subject-relative — doubling the subject scales the sweep up', () => {
    const small = makeTarget(scrollPathScrubPrimitive);
    const big = makeTarget(scrollPathScrubPrimitive);
    (big.subject as Mesh).scale.setScalar(2);

    const smallInst = scrollPathScrubPrimitive.create(small);
    const bigInst = scrollPathScrubPrimitive.create(big);

    const sweep = (
      target: ReturnType<typeof makeTarget>,
      inst: { seek: (t: number) => void },
    ): number => {
      const a = poseAt(target, inst, 0);
      const b = poseAt(target, inst, 1);
      return Math.hypot(b.px - a.px, b.py - a.py, b.pz - a.pz);
    };

    const smallSweep = sweep(small, smallInst);
    const bigSweep = sweep(big, bigInst);

    expect(smallSweep).toBeGreaterThan(0);
    expect(bigSweep, 'sweep scales with the subject').toBeGreaterThan(smallSweep * 1.5);

    smallInst.dispose();
    bigInst.dispose();
  });

  it('dispose restores position AND rotation exactly to pre-create values', () => {
    const target = makeTarget(scrollPathScrubPrimitive);
    const subject = target.subject as Object3D;
    // A mounted artifact arrives with its own pose — hand it back exactly.
    subject.position.set(0.21, -0.13, 0.4);
    subject.rotation.set(0.05, -0.1, 0.02);

    const inst = scrollPathScrubPrimitive.create(target);
    target.userData.scroll = 0.8;
    inst.seek(0);
    expect(subject.position.x).not.toBeCloseTo(0.21, 4);

    inst.dispose();
    expect(subject.position.x).toBeCloseTo(0.21, 10);
    expect(subject.position.y).toBeCloseTo(-0.13, 10);
    expect(subject.position.z).toBeCloseTo(0.4, 10);
    expect(subject.rotation.x).toBeCloseTo(0.05, 10);
    expect(subject.rotation.y).toBeCloseTo(-0.1, 10);
    expect(subject.rotation.z).toBeCloseTo(0.02, 10);
  });
});
