import { describe, it, expect } from 'vitest';
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
  type Object3D,
} from 'three';
import { scrollWaveRidePrimitive } from '@/lib/prism/animatable/primitives/scroll-wave-ride';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';
import { makeTarget, runConformance } from './_conformance';

/** Median bbox dimension of the subject — the same subject-relative unit the
 *  primitive uses for its travel envelope (Box3, median-dim convention). */
function medianSize(subject: Object3D): number {
  const dims = new Box3().setFromObject(subject).getSize(new Vector3());
  return [dims.x, dims.y, dims.z].sort((a, b) => a - b)[1];
}

describe('scroll-wave-ride primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollWaveRidePrimitive).dispose();
  });

  it('plays: scroll scrubs the swell phase — pose varies with scroll and is engaged mid-swell at scroll=0.5', () => {
    const target = makeTarget(scrollWaveRidePrimitive);
    const inst = scrollWaveRidePrimitive.create(target);
    const subject = target.subject as Object3D;
    const baseY = subject.position.y;
    const baseX = subject.position.x;
    const baseRotZ = subject.rotation.z;

    // Idle frame (scroll=0): pure transforms only — the card sits ON the swell,
    // displaced but fully legible (no opacity/scale writes at all).
    target.userData.scroll = 0;
    inst.seek(0);
    expect(Number.isFinite(subject.position.y)).toBe(true);
    expect(subject.scale.x).toBeCloseTo(1, 10); // never touches scale
    const yIdle = subject.position.y - baseY;

    // Mid-scroll (the advocate's pinned control frame): strongly engaged —
    // a real heave offset AND a real derivative-coupled roll.
    target.userData.scroll = 0.5;
    inst.seek(1);
    const yMid = subject.position.y - baseY;
    const rollMid = subject.rotation.z - baseRotZ;
    expect(Math.abs(yMid)).toBeGreaterThan(0.05);
    expect(Math.abs(rollMid)).toBeGreaterThan(0.12);

    // Late scroll: the wave keeps traveling — pose keeps changing.
    target.userData.scroll = 0.75;
    inst.seek(2);
    const yLate = subject.position.y - baseY;

    // Distinct heave at distinct scroll positions (the wave travels under it).
    expect(Math.abs(yMid - yIdle)).toBeGreaterThan(0.05);
    expect(Math.abs(yLate - yMid)).toBeGreaterThan(0.05);

    // Orbital surge + bounded drift: x moves too, but stays near the rest pose.
    expect(subject.position.x).not.toBe(baseX);

    inst.dispose();
  });

  it('is a pure scrubbed field (zero state): repeated seeks at the same scroll yield the identical pose', () => {
    const target = makeTarget(scrollWaveRidePrimitive);
    const inst = scrollWaveRidePrimitive.create(target);
    const subject = target.subject as Object3D;

    // Drive a history first (would charge up any impulse/velocity state).
    target.userData.scroll = 0;
    inst.seek(0);
    target.userData.scroll = 0.9;
    inst.seek(0.5);

    // Pin at scroll=0.5 and re-seek at many different times (the advocate's
    // paused control sweep). The pose must be identical every time — position
    // response only, no velocity proxy, no settling.
    target.userData.scroll = 0.5;
    inst.seek(1);
    const y1 = subject.position.y;
    const x1 = subject.position.x;
    const r1 = subject.rotation.z;
    for (const t of [1, 1.016, 2, 7.5]) {
      inst.seek(t);
      expect(subject.position.y).toBeCloseTo(y1, 12);
      expect(subject.position.x).toBeCloseTo(x1, 12);
      expect(subject.rotation.z).toBeCloseTo(r1, 12);
    }

    inst.dispose();
  });

  it('controls reshape the pose at scroll=0.5 (the pinned frame)', () => {
    const target = makeTarget(scrollWaveRidePrimitive);
    const inst = scrollWaveRidePrimitive.create(target);
    const subject = target.subject as Object3D;
    const baseY = subject.position.y;
    const baseRotZ = subject.rotation.z;
    target.userData.scroll = 0.5;

    // swellAmp scales the heave proportionally (both octaves scale with it).
    inst.setControl('swellAmp', 0.05);
    inst.seek(0);
    const ySmall = Math.abs(subject.position.y - baseY);
    inst.setControl('swellAmp', 0.4);
    inst.seek(0);
    const yLarge = Math.abs(subject.position.y - baseY);
    expect(yLarge).toBeGreaterThan(ySmall * 4);

    // wavelength re-phases the field — a different pose at the same scroll.
    inst.setControl('swellAmp', 0.14);
    inst.setControl('wavelength', 0.8);
    inst.seek(0);
    const yShortWave = subject.position.y - baseY;
    inst.setControl('wavelength', 3.0);
    inst.seek(0);
    const yLongWave = subject.position.y - baseY;
    expect(Math.abs(yShortWave - yLongWave)).toBeGreaterThan(0.02);

    // chop adds the second octave — measurably different heave.
    inst.setControl('wavelength', 1.6);
    inst.setControl('chop', 0);
    inst.seek(0);
    const yNoChop = subject.position.y - baseY;
    inst.setControl('chop', 1);
    inst.seek(0);
    const yFullChop = subject.position.y - baseY;
    expect(Math.abs(yFullChop - yNoChop)).toBeGreaterThan(0.02);

    // rollCoupling gates the derivative roll: 0 = dead level, high = leaning.
    inst.setControl('chop', 0.5);
    inst.setControl('rollCoupling', 0);
    inst.seek(0);
    expect(subject.rotation.z).toBeCloseTo(baseRotZ, 10);
    inst.setControl('rollCoupling', 1.5);
    inst.seek(0);
    expect(Math.abs(subject.rotation.z - baseRotZ)).toBeGreaterThan(0.2);

    inst.dispose();
  });

  it('onParamChange re-applies the pose at the last seek state without a new seek', () => {
    const target = makeTarget(scrollWaveRidePrimitive);
    const inst = scrollWaveRidePrimitive.create(target);
    const subject = target.subject as Object3D;
    const baseY = subject.position.y;

    target.userData.scroll = 0.5;
    inst.seek(1);
    const yBefore = subject.position.y - baseY;

    // No further seek: the knob alone must re-pose the pinned frame.
    inst.setControl('swellAmp', 0.4);
    const yAfter = subject.position.y - baseY;
    expect(Math.abs(yAfter)).toBeGreaterThan(Math.abs(yBefore) * 1.5);

    inst.dispose();
  });

  it('keeps the default travel envelope subject-relative and bounded (tile framing)', () => {
    const target = makeTarget(scrollWaveRidePrimitive);
    const subject = target.subject as Object3D;
    const size = medianSize(subject);
    const inst = scrollWaveRidePrimitive.create(target);
    const baseY = subject.position.y;
    const baseX = subject.position.x;

    let maxY = 0;
    let maxX = 0;
    for (let i = 0; i <= 200; i++) {
      target.userData.scroll = i / 200;
      inst.seek(i * 0.016);
      maxY = Math.max(maxY, Math.abs(subject.position.y - baseY));
      maxX = Math.max(maxX, Math.abs(subject.position.x - baseX));
    }

    // Heave bound: swellAmp×(1 + chopShare) of the subject's median dimension.
    // Defaults: 0.14×(1 + 0.45×0.5) = 0.2030 ×size. Surge+drift x bound: 0.18 ×size.
    expect(maxY).toBeLessThanOrEqual(size * 0.21);
    expect(maxX).toBeLessThanOrEqual(size * 0.2);
    // And the motion actually happens (not a degenerate flat ride).
    expect(maxY).toBeGreaterThan(size * 0.05);

    inst.dispose();
  });

  it('handles a Group subject (MSDF text case) and dispose restores the exact rest pose', () => {
    // Custom target: subject is a Group wrapping a mesh (per-glyph text shape).
    const scene = new Scene();
    const object = new Group();
    const subject = new Group();
    subject.name = 'subject';
    const glyph = new Mesh(new BoxGeometry(0.3, 0.5, 0.08), new MeshStandardMaterial());
    subject.add(glyph);
    object.add(subject);
    scene.add(object);
    subject.position.set(0.31, -0.17, 0.05);
    subject.rotation.z = 0.21;
    const target: AnimatableTarget = { object, subject, scene, userData: { scroll: 0.5 } };

    const inst = scrollWaveRidePrimitive.create(target);
    inst.seek(0);
    expect(subject.position.y).not.toBeCloseTo(-0.17, 4); // it rides
    target.userData.scroll = 0.85;
    inst.seek(1);
    inst.setControl('chop', 0.9);
    inst.seek(2);

    inst.dispose();
    expect(subject.position.x).toBeCloseTo(0.31, 12);
    expect(subject.position.y).toBeCloseTo(-0.17, 12);
    expect(subject.rotation.z).toBeCloseTo(0.21, 12);

    glyph.geometry.dispose();
    glyph.material.dispose();
  });
});
