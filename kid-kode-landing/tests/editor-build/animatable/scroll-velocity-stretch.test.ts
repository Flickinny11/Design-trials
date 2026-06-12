import { describe, it, expect } from 'vitest';
import { Box3, Vector3, type Object3D } from 'three';
import { scrollVelocityStretchPrimitive } from '@/lib/prism/animatable/primitives/scroll-velocity-stretch';
import { makeTarget, runConformance } from './_conformance';

// Mirrors of the primitive's internal constants (kept in sync by the numeric
// assertions below — if the impl constants drift, these tests fail loudly).
const TRAVEL_BIAS = 1.6; // travel ease exponent: scroll^1.6 (asymmetric so the
//                          travel control visibly shifts the pinned mid frame)
const DEFAULT_TRAVEL = 0.85;
const DEFAULT_GAIN = 0.6;
const DAMP_REF = 2.5; // default settleDamping — dampAmp is exactly 1 there

// The catalog rig's cosine scroll stimulus: scroll(t) = 0.5 - 0.5*cos(2πt/4).
const cosineScroll = (t: number): number => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 4);

/** Subject's measured y-extent before any seek (subject-relative travel unit). */
function measureSizeY(subject: Object3D): number {
  return new Box3().setFromObject(subject).getSize(new Vector3()).y;
}

/** Expected travel offset along the axis for a given scroll position. */
function expectedOffset(scroll: number, travel: number, size: number): number {
  return (Math.pow(scroll, TRAVEL_BIAS) - 0.5) * travel * size;
}

/** Build a fresh instance pinned at the engaged mid-state: very first seek at
 *  t=1, scroll=0.5 (the advocate's control-sweep frame). The cold-start fling
 *  seed 2*sqrt(s*(1-s)) is exactly 1 there, so the stretch is fully engaged. */
function pinnedMid() {
  const target = makeTarget(scrollVelocityStretchPrimitive);
  const inst = scrollVelocityStretchPrimitive.create(target);
  const subject = target.subject as Object3D;
  const sizeY = measureSizeY(subject);
  target.userData.scroll = 0.5;
  inst.seek(1);
  return { target, inst, subject, sizeY };
}

describe('scroll-velocity-stretch primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollVelocityStretchPrimitive).dispose();
  });

  it('idle frame (t=0, scroll=0) is fully legible: square card parked at travel start, inside the tile frame', () => {
    const target = makeTarget(scrollVelocityStretchPrimitive);
    const inst = scrollVelocityStretchPrimitive.create(target);
    const subject = target.subject as Object3D;
    const sizeY = measureSizeY(subject);

    target.userData.scroll = 0;
    inst.seek(0);

    // No fling at rest: exactly square, full base scale (never shrunken/empty).
    expect(subject.scale.x).toBeCloseTo(1, 6);
    expect(subject.scale.y).toBeCloseTo(1, 6);
    expect(subject.scale.z).toBeCloseTo(1, 6);

    // Parked at the travel start: -0.5 * travel * sizeY below center.
    expect(subject.position.y).toBeCloseTo(expectedOffset(0, DEFAULT_TRAVEL, sizeY), 5);
    expect(subject.position.x).toBeCloseTo(0, 6);

    // Whole card stays inside the tile frame (rig camera: fov 40 @ z=3.2 →
    // half-extent ≈ 1.165 at the subject plane).
    expect(Math.abs(subject.position.y) + sizeY / 2).toBeLessThan(1.165);

    inst.dispose();
  });

  it('scroll position maps to subject-relative travel at 0 / 0.5 / 1 (the always-alive base)', () => {
    const target = makeTarget(scrollVelocityStretchPrimitive);
    const inst = scrollVelocityStretchPrimitive.create(target);
    const subject = target.subject as Object3D;
    const sizeY = measureSizeY(subject);

    target.userData.scroll = 0;
    inst.seek(0);
    expect(subject.position.y).toBeCloseTo(expectedOffset(0, DEFAULT_TRAVEL, sizeY), 5);

    target.userData.scroll = 0.5;
    inst.seek(1);
    expect(subject.position.y).toBeCloseTo(expectedOffset(0.5, DEFAULT_TRAVEL, sizeY), 5);

    target.userData.scroll = 1;
    inst.seek(2);
    expect(subject.position.y).toBeCloseTo(expectedOffset(1, DEFAULT_TRAVEL, sizeY), 5);

    // The flight window (sin(π·scroll)) means the card always ARRIVES square:
    // even though these coarse 1s jumps sustain velocity at scroll=1, the
    // deformation is fully tapered at the travel end.
    expect(subject.scale.y).toBeCloseTo(1, 6);
    // End of travel stays inside the tile frame at default params.
    expect(Math.abs(subject.position.y) + (sizeY / 2) * subject.scale.y).toBeLessThan(1.165);

    inst.dispose();
  });

  it('velocity stretches along travel with volume-preserving counter-squash; pinned re-seeks keep it engaged; rest settles square', () => {
    const target = makeTarget(scrollVelocityStretchPrimitive);
    const inst = scrollVelocityStretchPrimitive.create(target);
    const subject = target.subject as Object3D;

    // Drive the rig's cosine stimulus at 60fps from t=0 to t=1 (max velocity).
    const FPS = 60;
    for (let n = 0; n <= FPS; n++) {
      const t = n / FPS;
      target.userData.scroll = cosineScroll(t);
      inst.seek(t);
    }

    // Mid-fling: long along y (≈ 1 + 0.6*velNorm with velNorm ≈ 1 → ≈ 1.6),
    // squashed across.
    expect(subject.scale.y).toBeGreaterThan(1.55);
    expect(subject.scale.x).toBeLessThan(0.85);
    // Exact volume preservation: sPerp = 1/sqrt(sAlong) on both other axes.
    expect(subject.scale.x * subject.scale.z * subject.scale.y).toBeCloseTo(1, 6);

    // PINNED frame: the advocate repeats seeks at the SAME t — the impulse
    // envelope must persist (no decay on a re-rendered instant), so the
    // stretch stays visibly engaged even though instant velocity reads 0.
    for (let i = 0; i < 10; i++) inst.seek(1);
    expect(subject.scale.y).toBeGreaterThan(1.55);

    // Page settles: scroll holds still while time advances → the envelope
    // decays (default damping 2.5/s → e^-5 ≈ 0.7% after 2s) and the card
    // relaxes back to square.
    for (let n = 1; n <= 2 * FPS; n++) inst.seek(1 + n / FPS);
    expect(subject.scale.y).toBeLessThan(1.05);
    expect(subject.scale.y).toBeGreaterThanOrEqual(1);

    inst.dispose();
  });

  it('cold pin at t=1 scroll=0.5 (no seek history) infers the fling from position and is fully engaged', () => {
    const { inst, subject } = pinnedMid();
    // Seed 2*sqrt(0.5*0.5) = 1 → sAlong = 1 + 0.6*1*1 = 1.6 exactly.
    expect(subject.scale.y).toBeCloseTo(1 + DEFAULT_GAIN, 5);
    expect(subject.scale.x).toBeCloseTo(1 / Math.sqrt(1 + DEFAULT_GAIN), 5);
    inst.dispose();
  });

  it('controls re-shape the pinned mid frame: stretchGain', () => {
    const { inst, subject } = pinnedMid();
    const before = subject.scale.y; // ≈ 1.6
    inst.setControl('stretchGain', 1.0);
    // onParamChange re-applies at the stored seek state — no new seek needed.
    expect(subject.scale.y).toBeCloseTo(2.0, 5);
    expect(subject.scale.y).toBeGreaterThan(before + 0.2);
    inst.dispose();
  });

  it('controls re-shape the pinned mid frame: travel span moves the position', () => {
    const { inst, subject, sizeY } = pinnedMid();
    const before = subject.position.y;
    inst.setControl('travel', 1.6);
    expect(subject.position.y).toBeCloseTo(expectedOffset(0.5, 1.6, sizeY), 5);
    expect(Math.abs(subject.position.y - before)).toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('controls re-shape the pinned mid frame: axis swaps travel + stretch to horizontal', () => {
    const { inst, subject } = pinnedMid();
    inst.setControl('axis', 'horizontal');
    // Travel and elongation move to x; y returns to base and counter-squashes.
    expect(subject.position.y).toBeCloseTo(0, 6);
    expect(subject.position.x).toBeLessThan(-0.05);
    expect(subject.scale.x).toBeGreaterThan(1.5);
    expect(subject.scale.y).toBeLessThan(0.85);
    inst.dispose();
  });

  it('controls re-shape the pinned mid frame: settleDamping (stiffer taffy = smaller sustained stretch)', () => {
    const { inst, subject } = pinnedMid();
    const loose = subject.scale.y; // dampAmp = 1 at the 2.5 default
    inst.setControl('settleDamping', 8);
    // dampAmp = (2.5/8)^0.4 ≈ 0.628 → sAlong ≈ 1 + 0.6*0.628 ≈ 1.377.
    const stiff = subject.scale.y;
    expect(stiff).toBeLessThan(loose - 0.15);
    expect(stiff).toBeCloseTo(1 + DEFAULT_GAIN * Math.pow(DAMP_REF / 8, 0.4), 4);
    inst.dispose();
  });

  it('dispose restores the exact base position and scale', () => {
    const target = makeTarget(scrollVelocityStretchPrimitive);
    const inst = scrollVelocityStretchPrimitive.create(target);
    const subject = target.subject as Object3D;

    const basePos = subject.position.clone();
    const baseScale = subject.scale.clone();

    // Drive hard, including a control change, then dispose.
    for (let n = 0; n <= 30; n++) {
      const t = n / 30;
      target.userData.scroll = cosineScroll(t);
      inst.seek(t);
    }
    inst.setControl('axis', 'horizontal');
    inst.setControl('stretchGain', 1.5);
    inst.dispose();

    expect(subject.position.x).toBe(basePos.x);
    expect(subject.position.y).toBe(basePos.y);
    expect(subject.position.z).toBe(basePos.z);
    expect(subject.scale.x).toBe(baseScale.x);
    expect(subject.scale.y).toBe(baseScale.y);
    expect(subject.scale.z).toBe(baseScale.z);
  });
});
