import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { crossMorphPrimitive } from '@/lib/prism/animatable/primitives/cross-morph';
import { makeTarget, runConformance } from './_conformance';

type FadeMat = Material & { opacity: number };

// Defaults: axis 'x', travel 0.4 (×subject width, SYMMETRIC: pose A at
// −travel/2·size, pose B at +travel/2·size), trough 0.35 (floor 0.3),
// duration 2.7 s, curve easeInOut. The card panel measures ≈1.74 wide, so:
//   t = 0      (pose A):           x ≈ base−0.35, z ≈ base, opacity ≈ 1
//   t = dur/4  (A→B leg midpoint): x ≈ base,      z receded, opacity ≈ 0.35
//   t = dur/2  (pose B):           x ≈ base+0.35, z ≈ base, opacity ≈ 1
//   t = 3dur/4 (B→A leg midpoint): x ≈ base,      z receded, opacity ≈ 0.35
//   t = dur    (pose A again):     x ≈ base−0.35, z ≈ base, opacity ≈ 1

describe('cross-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(crossMorphPrimitive).dispose();
  });

  it('plays: A → trough → B → trough → A across the round trip', () => {
    const target = makeTarget(crossMorphPrimitive);
    const inst = crossMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as FadeMat;
    const dur = inst.duration();

    // Pose A at t=0: rest pose (−travel/2 of center), fully opaque.
    inst.seek(0);
    const baseX = mesh.position.x;
    const baseZ = mesh.position.z;
    expect(mat.opacity).toBeGreaterThan(0.95);

    // First-leg midpoint: advanced part-way along the shared axis (back at
    // the symmetric center), receded in z, dimmed to the trough (0.35).
    inst.seek(dur / 4);
    expect(mesh.position.x).toBeGreaterThan(baseX + 0.3);
    expect(mesh.position.x).toBeLessThan(baseX + 1.3);
    expect(mesh.position.z).toBeLessThan(baseZ - 0.3);
    expect(mat.opacity).toBeCloseTo(0.35, 1);

    // Pose B at the half: fully advanced along the axis, back at the base
    // depth, fully re-emerged.
    inst.seek(dur / 2);
    const xPoseB = mesh.position.x;
    expect(xPoseB).toBeGreaterThan(baseX + 0.45); // full symmetric travel 0.4×size ≈ 0.70
    expect(mesh.position.z).toBeCloseTo(baseZ, 5);
    expect(mat.opacity).toBeGreaterThan(0.95);

    // Return-leg midpoint: dips through the trough again on the way back —
    // the morph is state-to-state in BOTH directions.
    inst.seek((3 * dur) / 4);
    expect(mesh.position.x).toBeGreaterThan(baseX + 0.3);
    expect(mesh.position.x).toBeLessThan(xPoseB - 0.3);
    expect(mesh.position.z).toBeLessThan(baseZ - 0.3);
    expect(mat.opacity).toBeCloseTo(0.35, 1);

    // Back at pose A at the end of the loop.
    inst.seek(dur);
    expect(mesh.position.x).toBeCloseTo(baseX, 5);
    expect(mesh.position.z).toBeCloseTo(baseZ, 5);
    expect(mat.opacity).toBeGreaterThan(0.95);
    inst.dispose();
  });

  it('controls change output: travel scales the pose-B offset', () => {
    const target = makeTarget(crossMorphPrimitive);
    const inst = crossMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.setControl('travel', 0.15); // schema min
    inst.seek(dur / 2);
    const xSmall = mesh.position.x;

    inst.setControl('travel', 0.7); // schema max
    inst.seek(dur / 2);
    const xLarge = mesh.position.x;

    // Travel is subject-relative (×width ≈ 1.74, symmetric):
    // 0.7 lands ≈ +0.61 of center, 0.15 ≈ +0.13.
    expect(xLarge).toBeGreaterThan(xSmall + 0.4);
    inst.dispose();
  });

  it('controls change output: trough sets the mid-leg dim floor (hard floor 0.3 — never invisible)', () => {
    const target = makeTarget(crossMorphPrimitive);
    const inst = crossMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as FadeMat;
    const dur = inst.duration();

    // Even a 0 pushed through setControl is clamped to the 0.3 floor: the
    // composite must stay visible at the dip's deepest point (the advocate
    // never-invisible rule).
    inst.setControl('trough', 0);
    inst.seek(dur / 4);
    const opDeep = mat.opacity;
    expect(opDeep).toBeCloseTo(0.3, 5);

    inst.setControl('trough', 0.9);
    inst.seek(dur / 4);
    const opShallow = mat.opacity;

    expect(opShallow).toBeCloseTo(0.9, 5);
    expect(opShallow).toBeGreaterThan(opDeep + 0.5);
    inst.dispose();
  });

  it('controls change output: axis redirects the shared-axis travel', () => {
    const target = makeTarget(crossMorphPrimitive);
    const inst = crossMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    // Raw rest position (captured before any seek moves the subject).
    const rawX = mesh.position.x;
    const rawY = mesh.position.y;
    const rawZ = mesh.position.z;
    inst.setControl('travel', 0.7); // max rail for unambiguous amplitude

    inst.setControl('axis', 'y');
    inst.seek(dur / 2);
    // Travel went vertical: y advanced (+travel/2 × height ≈ 0.39), x cleared
    // back to the raw base.
    expect(mesh.position.y).toBeGreaterThan(rawY + 0.3);
    expect(mesh.position.x).toBeCloseTo(rawX, 5);

    inst.setControl('axis', 'z');
    inst.seek(dur / 2);
    // Depth axis: pose B sits AWAY from the camera (−z ≈ −0.61), y cleared.
    expect(mesh.position.z).toBeLessThan(rawZ - 0.4);
    expect(mesh.position.y).toBeCloseTo(rawY, 5);
    inst.dispose();
  });

  it('pinned control state (t=1s): subject stays in frame and trough sweep is ALIVE — even with sweep-leftover travel at max', () => {
    // The capture rig sweeps controls PAUSED at t=1s and does NOT restore the
    // previous control before sweeping the next one — so the trough sweep
    // runs with travel parked at its schema MAX. This encodes the exact
    // advocate scenario that measured trough as dead (subject out of frame).
    const target = makeTarget(crossMorphPrimitive);
    const inst = crossMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as FadeMat;
    const rawX = mesh.position.x;

    inst.setControl('travel', 0.7); // sweep leftover: travel rail max
    inst.seek(1);

    // Subject must still be solidly inside the 4/3 tile frame: offset
    // ≈ 0.37 × 0.7 × 1.74 ≈ 0.45 — card edge ≈ 1.32 < frame half-width ≈ 1.55.
    expect(Math.abs(mesh.position.x - rawX)).toBeLessThan(0.75);
    // And visibly present (dip ≈ 0.73 at default trough 0.35 → opacity ≈ 0.53).
    expect(mat.opacity).toBeGreaterThan(0.3);

    // Trough sweep at the pin must produce a real opacity delta. setControl
    // alone must re-apply at the pinned time (onParamChange) — no extra seek.
    inst.setControl('trough', 0.3);
    const opLow = mat.opacity;
    inst.setControl('trough', 0.9);
    const opHigh = mat.opacity;
    expect(opHigh - opLow).toBeGreaterThan(0.3);
    expect(opHigh).toBeCloseTo(0.927, 2); // 1 − 0.1·dip(0.727) — applied WITHOUT a manual re-seek
    inst.dispose();
  });

  it('frame containment: symmetric travel never exceeds the clamped spread envelope at ANY phase (max rail, incl. backOut overshoot)', () => {
    const target = makeTarget(crossMorphPrimitive);
    const inst = crossMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const rawX = mesh.position.x;
    const dur = inst.duration();
    inst.setControl('travel', 0.7); // worst case rail

    // easeInOut: |spread| ≤ 0.5 → max offset 0.5 × 0.7 × 1.74 = 0.609.
    let maxAbs = 0;
    for (let i = 0; i <= 96; i++) {
      inst.seek((i / 96) * dur);
      maxAbs = Math.max(maxAbs, Math.abs(mesh.position.x - rawX));
    }
    expect(maxAbs).toBeLessThanOrEqual(0.5 * 0.7 * 1.74 + 1e-6);

    // backOut overshoots past the pose — the spread clamp (±0.55) bounds it
    // so the card edge stays inside the tile frame: max offset ≤ 0.67.
    inst.setControl('curve', 'backOut');
    maxAbs = 0;
    for (let i = 0; i <= 96; i++) {
      inst.seek((i / 96) * dur);
      maxAbs = Math.max(maxAbs, Math.abs(mesh.position.x - rawX));
    }
    expect(maxAbs).toBeGreaterThan(0.5 * 0.7 * 1.74); // overshoot still visible…
    expect(maxAbs).toBeLessThanOrEqual(0.55 * 0.7 * 1.74 + 1e-6); // …but bounded
    inst.dispose();
  });

  it('bounded z recede: depth-axis travel scales the dip recede down (no over-deep vanishing pose)', () => {
    const target = makeTarget(crossMorphPrimitive);
    const inst = crossMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const rawZ = mesh.position.z;
    const dur = inst.duration();

    // x axis at the dip: full recede ≈ 0.45 × 1.74 ≈ 0.78.
    inst.seek(dur / 4);
    const recedeX = rawZ - mesh.position.z;
    expect(recedeX).toBeCloseTo(0.45 * 1.74, 1);

    // z axis: travel already carries depth, so the dip recede is 0.4× — the
    // combined z-back excursion stays bounded across the whole loop.
    inst.setControl('axis', 'z');
    inst.setControl('travel', 0.7);
    let maxBack = 0;
    for (let i = 0; i <= 96; i++) {
      inst.seek((i / 96) * dur);
      maxBack = Math.max(maxBack, rawZ - mesh.position.z);
    }
    // travel back ≤ 0.55×0.7×1.74 ≈ 0.67, recede ≤ 0.4×0.78 ≈ 0.31 → < 1.0.
    expect(maxBack).toBeLessThan(1.0);
    inst.dispose();
  });

  it('dispose restores transforms, opacity, and .transparent', () => {
    const target = makeTarget(crossMorphPrimitive);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as FadeMat;

    // Pre-condition the subject material so the restore is observable: a
    // non-default opacity and transparent=false (the primitive must flip it
    // true to render the trough, then hand it back exactly as found).
    mat.opacity = 0.8;
    mat.transparent = false;
    const baseX = mesh.position.x;
    const baseY = mesh.position.y;
    const baseZ = mesh.position.z;

    const inst = crossMorphPrimitive.create(target);
    inst.seek(inst.duration() / 4);
    // Mid-leg: the primitive is actively driving the material + transform
    // (symmetric travel parks x back at center here, so z carries the proof).
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(0.5);
    expect(mesh.position.z).not.toBeCloseTo(baseZ, 5);

    inst.dispose();
    expect(mesh.position.x).toBeCloseTo(baseX, 10);
    expect(mesh.position.y).toBeCloseTo(baseY, 10);
    expect(mesh.position.z).toBeCloseTo(baseZ, 10);
    expect(mat.opacity).toBeCloseTo(0.8, 10);
    expect(mat.transparent).toBe(false);
  });
});
