import { describe, it, expect } from 'vitest';
import { Color, Mesh, type MeshStandardMaterial } from 'three';
import { swapFlipMorphPrimitive } from '@/lib/prism/animatable/primitives/swap-flip-morph';
import { makeTarget, runConformance } from './_conformance';

// Defaults (mirrors the schema): hold 0.9s, flip duration 0.55s -> cycle 1.45s.
const HOLD = 0.9;
const DUR = 0.55;
const CYCLE = HOLD + DUR;

function lightnessOf(mat: MeshStandardMaterial): number {
  const hsl = { h: 0, s: 0, l: 0 };
  mat.color.getHSL(hsl);
  return hsl.l;
}

describe('swap-flip-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(swapFlipMorphPrimitive).dispose();
  });

  it('plays (t-fallback): auto half-flips each cycle, swapping the face tint at the edge', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as MeshStandardMaterial;
    const baseHex = mat.color.getHex();
    const baseL = lightnessOf(mat);
    const inst = swapFlipMorphPrimitive.create(target);

    expect(inst.duration()).toBe(Infinity); // stateful loop with t-fallback

    // t=0: holding face A — untouched pose and untouched look.
    inst.seek(0);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    expect(mat.color.getHex()).toBe(baseHex);

    // Mid-flip (t=0.95, just after hold ends): rotation underway, still face A
    // (the swap happens at the 90deg edge, which the eased phase hasn't crossed).
    inst.seek(HOLD + 0.05);
    expect(subject.rotation.y).toBeGreaterThan(0.2);
    expect(subject.rotation.y).toBeLessThan(Math.PI * 0.95);
    expect(mat.color.getHex()).toBe(baseHex);

    // End of cycle 0 (t=1.45): half-turn complete (rotation.y = PI exactly) and
    // the alternate face is showing — tinted LIGHTER than base (default bias +).
    inst.seek(CYCLE);
    expect(subject.rotation.y).toBeCloseTo(Math.PI, 5);
    expect(mat.color.getHex()).not.toBe(baseHex);
    expect(lightnessOf(mat)).toBeGreaterThan(baseL);

    // End of cycle 1 (t=2.9): second half-turn completes the full turn
    // (rotation.y = 2*PI) and face A's exact base look is restored.
    inst.seek(CYCLE * 2);
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);
    expect(mat.color.getHex()).toBe(baseHex);

    inst.dispose();
  });

  it('state-driven: reads userData.state, flips ONLY on toggles (no auto-loop)', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as MeshStandardMaterial;
    const baseHex = mat.color.getHex();
    const inst = swapFlipMorphPrimitive.create(target);

    // External boolean present -> the t-clock fallback is OFF. Holding state
    // false across a long span produces NO motion.
    target.userData.state = false;
    inst.seek(0.1);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    inst.seek(5);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    expect(mat.color.getHex()).toBe(baseHex);

    // Toggle -> the half-flip runs over `duration` from the toggle instant.
    target.userData.state = true;
    inst.seek(5.1); // toggle observed here; flip starts now
    expect(subject.rotation.y).toBeCloseTo(0, 5);
    inst.seek(5.1 + DUR); // flip complete
    expect(subject.rotation.y).toBeCloseTo(Math.PI, 5);
    expect(mat.color.getHex()).not.toBe(baseHex); // face B tint

    // Holding the new state: stable (repeat-safe).
    inst.seek(8);
    expect(subject.rotation.y).toBeCloseTo(Math.PI, 5);

    // Toggle back -> completes the turn and restores face A's exact look.
    target.userData.state = false;
    inst.seek(8.2);
    inst.seek(8.2 + DUR);
    expect(subject.rotation.y).toBeCloseTo(Math.PI * 2, 5);
    expect(mat.color.getHex()).toBe(baseHex);

    inst.dispose();
  });

  it('controls change output: axis re-targets live; duration shifts the pose at t=1', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const inst = swapFlipMorphPrimitive.create(target);

    // Default axis 'y': rotation.y carries the flip, rotation.x stays at base.
    inst.seek(CYCLE);
    expect(subject.rotation.y).toBeCloseTo(Math.PI, 5);
    expect(subject.rotation.x).toBeCloseTo(0, 6);

    // Axis read LIVE in seek: switching re-targets on the next frame.
    inst.setControl('axis', 'x');
    inst.seek(CYCLE);
    expect(subject.rotation.x).toBeCloseTo(Math.PI, 5);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    inst.setControl('axis', 'y');

    // CONTROLS-gate mirror: paused at t=1s, duration min vs max produces
    // clearly different flip poses (the flip is mid-flight at t=1 by default).
    inst.setControl('duration', 0.2);
    inst.seek(1);
    const fastPose = subject.rotation.y;
    inst.setControl('duration', 2.0);
    inst.seek(1);
    const slowPose = subject.rotation.y;
    expect(Math.abs(fastPose - slowPose)).toBeGreaterThan(0.5);

    inst.dispose();
  });

  it('faceBias control: positive lightens face B, negative darkens it, both derived from base', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const mat = subject.material as MeshStandardMaterial;
    const baseL = lightnessOf(mat);
    const baseEI = mat.emissiveIntensity;
    const inst = swapFlipMorphPrimitive.create(target);

    inst.setControl('faceBias', 1);
    inst.seek(CYCLE); // face B showing
    const lightL = lightnessOf(mat);
    const lightEI = mat.emissiveIntensity;

    inst.setControl('faceBias', -1);
    inst.seek(CYCLE);
    const darkL = lightnessOf(mat);
    const darkEI = mat.emissiveIntensity;

    expect(lightL).toBeGreaterThan(baseL);
    expect(darkL).toBeLessThan(baseL);
    expect(lightEI).toBeGreaterThan(baseEI);
    expect(darkEI).toBeLessThan(baseEI);

    inst.dispose();
  });

  it('dispose restores transforms and every touched material (panel + chrome children)', () => {
    const target = makeTarget(swapFlipMorphPrimitive);
    const subject = target.subject as Mesh;
    const panelMat = subject.material as MeshStandardMaterial;
    const header = subject.children.find((c) => c.name === 'card-header') as Mesh;
    const headerMat = header.material as MeshStandardMaterial;

    const basePanelHex = panelMat.color.getHex();
    const basePanelEmissive = panelMat.emissive.getHex();
    const basePanelEI = panelMat.emissiveIntensity;
    const baseHeaderHex = headerMat.color.getHex();
    const baseHeaderEI = headerMat.emissiveIntensity;
    const baseScale = subject.scale.clone();

    const inst = swapFlipMorphPrimitive.create(target);
    inst.seek(CYCLE); // face B: rotated PI, subtree tinted
    expect(panelMat.color.getHex()).not.toBe(basePanelHex);
    expect(headerMat.color.getHex()).not.toBe(baseHeaderHex);

    inst.dispose();
    expect(subject.rotation.x).toBeCloseTo(0, 6);
    expect(subject.rotation.y).toBeCloseTo(0, 6);
    expect(subject.scale.x).toBeCloseTo(baseScale.x, 6);
    expect(panelMat.color.getHex()).toBe(basePanelHex);
    expect(panelMat.emissive.getHex()).toBe(basePanelEmissive);
    expect(panelMat.emissiveIntensity).toBeCloseTo(basePanelEI, 6);
    expect(headerMat.color.getHex()).toBe(baseHeaderHex);
    expect(headerMat.emissiveIntensity).toBeCloseTo(baseHeaderEI, 6);
    // The face tint is a lerp FROM the subject's own colors — sanity-check the
    // restore really came from snapshots, not re-derivation.
    expect(new Color(basePanelHex).getHex()).toBe(panelMat.color.getHex());
  });
});
