import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { crossMorphPrimitive } from '@/lib/prism/animatable/primitives/cross-morph';
import { makeTarget, runConformance } from './_conformance';

type FadeMat = Material & { opacity: number };

// Defaults: axis 'x', travel 0.9 (×subject width), trough 0.35, duration 2.4s,
// curve easeInOut. The card panel measures ≈1.74 wide, so:
//   t = dur/4  (A→B leg midpoint): x ≈ +0.78, z receded, opacity ≈ 0.35
//   t = dur/2  (pose B):           x ≈ +1.57, z ≈ base,   opacity ≈ 1
//   t = 3dur/4 (B→A leg midpoint): x ≈ +0.78, z receded, opacity ≈ 0.35
//   t = dur    (pose A again):     x ≈ base,  z ≈ base,   opacity ≈ 1

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

    // Pose A at t=0: rest pose, fully opaque.
    inst.seek(0);
    const baseX = mesh.position.x;
    const baseZ = mesh.position.z;
    expect(mat.opacity).toBeGreaterThan(0.95);

    // First-leg midpoint: advanced part-way along the shared axis, receded in
    // z, dimmed to the trough (default 0.35).
    inst.seek(dur / 4);
    expect(mesh.position.x).toBeGreaterThan(baseX + 0.3);
    expect(mesh.position.x).toBeLessThan(baseX + 1.3);
    expect(mesh.position.z).toBeLessThan(baseZ - 0.3);
    expect(mat.opacity).toBeCloseTo(0.35, 1);

    // Pose B at the half: fully advanced along the axis, back at the base
    // depth, fully re-emerged.
    inst.seek(dur / 2);
    const xPoseB = mesh.position.x;
    expect(xPoseB).toBeGreaterThan(baseX + 0.45); // default travel 0.5×size (tuned: stays in tile frame)
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

    inst.setControl('travel', 0.2);
    inst.seek(dur / 2);
    const xSmall = mesh.position.x;

    inst.setControl('travel', 2);
    inst.seek(dur / 2);
    const xLarge = mesh.position.x;

    // Travel is subject-relative (×width ≈ 1.74): 2.0 lands ≈ 3.5, 0.2 ≈ 0.35.
    expect(xLarge).toBeGreaterThan(xSmall + 1.0);
    inst.dispose();
  });

  it('controls change output: trough sets the mid-leg dim floor', () => {
    const target = makeTarget(crossMorphPrimitive);
    const inst = crossMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as FadeMat;
    const dur = inst.duration();

    inst.setControl('trough', 0);
    inst.seek(dur / 4);
    const opDeep = mat.opacity;

    inst.setControl('trough', 0.9);
    inst.seek(dur / 4);
    const opShallow = mat.opacity;

    expect(opDeep).toBeLessThan(0.05);
    expect(opShallow).toBeGreaterThan(opDeep + 0.5);
    inst.dispose();
  });

  it('controls change output: axis redirects the shared-axis travel', () => {
    const target = makeTarget(crossMorphPrimitive);
    const inst = crossMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.seek(0);
    const baseX = mesh.position.x;
    const baseY = mesh.position.y;
    const baseZ = mesh.position.z;

    inst.setControl('axis', 'y');
    inst.seek(dur / 2);
    // Travel went vertical: y advanced, x cleared back to base.
    expect(mesh.position.y).toBeGreaterThan(baseY + 0.5);
    expect(mesh.position.x).toBeCloseTo(baseX, 5);

    inst.setControl('axis', 'z');
    inst.seek(dur / 2);
    // Depth axis: pose B sits AWAY from the camera (−z), y cleared.
    expect(mesh.position.z).toBeLessThan(baseZ - 0.5);
    expect(mesh.position.y).toBeCloseTo(baseY, 5);
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
    // Mid-leg: the primitive is actively driving the material + transform.
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(0.5);
    expect(mesh.position.x).not.toBeCloseTo(baseX, 5);

    inst.dispose();
    expect(mesh.position.x).toBeCloseTo(baseX, 10);
    expect(mesh.position.y).toBeCloseTo(baseY, 10);
    expect(mesh.position.z).toBeCloseTo(baseZ, 10);
    expect(mat.opacity).toBeCloseTo(0.8, 10);
    expect(mat.transparent).toBe(false);
  });
});
