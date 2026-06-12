import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture } from 'three';
import {
  morphIntoCardPrimitive,
  CHIP_HOLD,
  LIFT_MAX,
  RIM_MAX,
  chipMaskSdf,
} from '@/lib/prism/animatable/primitives/morph-into-card';
import { makeTarget, runConformance } from './_conformance';

// Default-param timeline geometry (time-fallback loop, duration 0.9s):
//   [0, 0.9)        fold-in   raw 0 -> 1
//   [0.9, 1.5)      chip hold raw = 1   (CHIP_HOLD = 0.6)
//   [1.5, 2.4)      unfurl    raw 1 -> 0
//   [2.4, 3.0)      full hold raw = 0
const T_CHIP = 1.2; // mid chip-hold plateau
const T_FULL = 2.7; // mid full-card hold

interface RadiusStash {
  uRadius: { value: number };
  uLift: { value: number };
  uRim: { value: number };
}

describe('morph-into-card primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(morphIntoCardPrimitive).dispose();
  });

  it('exports the loop hold constant the timeline math is built on', () => {
    expect(CHIP_HOLD).toBeGreaterThan(0);
  });

  it('plays: masks + shrinks + travels into the corner at the chip plateau, unfurls back', () => {
    const target = makeTarget(morphIntoCardPrimitive);
    const mesh = target.subject as Mesh;
    const inst = morphIntoCardPrimitive.create(target);

    // Material is swapped for a transparent node material with a rounded-rect
    // SDF opacityNode mask and a subject-derived colorNode (look is sacred).
    const mat = mesh.material as unknown as {
      transparent: boolean;
      opacityNode?: unknown;
      colorNode?: unknown;
    };
    expect(mat.transparent).toBe(true);
    expect(mat.opacityNode).toBeDefined();
    expect(mat.colorNode).toBeDefined();

    const stash = target.userData.morphIntoCard as RadiusStash;
    expect(stash).toBeDefined();

    // t=0: full card — identity transform, near-square corners.
    inst.seek(0);
    expect(mesh.scale.x).toBeCloseTo(1, 5);
    expect(mesh.position.x).toBeCloseTo(0, 5);
    expect(mesh.position.y).toBeCloseTo(0, 5);
    expect(stash.uRadius.value).toBeLessThan(0.05);

    // Chip plateau: shrunk to chipScale (default 0.28), traveled to the
    // bottom-right corner of the measured card footprint, full pill radius.
    inst.seek(T_CHIP);
    expect(mesh.scale.x).toBeCloseTo(0.28, 5);
    expect(mesh.scale.y).toBeCloseTo(0.28, 5);
    // Card half-extents measure 0.87 x 0.56 -> offset = half * (1 - 0.28).
    expect(mesh.position.x).toBeCloseTo(0.87 * 0.72, 2);
    expect(mesh.position.y).toBeCloseTo(-0.56 * 0.72, 2);
    expect(stash.uRadius.value).toBeCloseTo(1, 5);

    // Full-card hold: everything back to base.
    inst.seek(T_FULL);
    expect(mesh.scale.x).toBeCloseTo(1, 5);
    expect(mesh.position.x).toBeCloseTo(0, 5);
    expect(stash.uRadius.value).toBeLessThan(0.05);

    inst.dispose();
  });

  it('state driver: userData.state toggles the morph direction (integrates toward target)', () => {
    const target = makeTarget(morphIntoCardPrimitive);
    const mesh = target.subject as Mesh;
    target.userData.state = true; // hover/state on -> fold into the chip
    const inst = morphIntoCardPrimitive.create(target);

    // Integrate forward: 0 -> 1s in 0.1s steps covers duration (0.9s).
    for (let i = 0; i <= 10; i++) inst.seek(i * 0.1);
    expect(mesh.scale.x).toBeCloseTo(0.28, 5);
    expect(mesh.position.x).toBeGreaterThan(0.5);

    // Flip the state off: the chip unfurls back over the same duration.
    target.userData.state = false;
    for (let i = 11; i <= 24; i++) inst.seek(i * 0.1);
    expect(mesh.scale.x).toBeCloseTo(1, 5);
    expect(mesh.position.x).toBeCloseTo(0, 5);

    inst.dispose();
  });

  it('controls change output live at the chip plateau (t=1.2s)', () => {
    const target = makeTarget(morphIntoCardPrimitive);
    const mesh = target.subject as Mesh;
    const inst = morphIntoCardPrimitive.create(target);
    const stash = target.userData.morphIntoCard as RadiusStash;

    inst.seek(T_CHIP);
    expect(mesh.scale.x).toBeCloseTo(0.28, 5);

    // chipScale min -> max visibly resizes the chip without a new seek.
    inst.setControl('chipScale', 0.6);
    expect(mesh.scale.x).toBeCloseTo(0.6, 5);

    // corner relocates the chip to the opposite corner.
    inst.setControl('corner', 'top-left');
    expect(mesh.position.x).toBeLessThan(-0.2);
    expect(mesh.position.y).toBeGreaterThan(0.15);

    // radiusAmount drives the silhouette rounding uniform.
    inst.setControl('radiusAmount', 0.3);
    expect(stash.uRadius.value).toBeCloseTo(0.3, 5);

    inst.dispose();
  });

  it('ghost-plate regression: the shared SDF clips the old rect corners at full pill radius', () => {
    // Mask space for the catalog card face: half extents (aspect, 1) with
    // aspect = 0.87 / 0.56. At full radius (r = 1, the half short side) the
    // silhouette is a pill — the ORIGINAL rect's corners must sit strictly
    // OUTSIDE it (positive SDF), i.e. alpha truly reaches 0 there. A faint
    // full-size rect ghost around the docked chip is exactly this invariant
    // failing.
    const ax = 0.87 / 0.56;
    expect(chipMaskSdf(ax, 1, ax, 1, 1)).toBeGreaterThan(0.3); // rect corner: clipped
    expect(chipMaskSdf(-ax, -1, ax, 1, 1)).toBeGreaterThan(0.3);
    // Inside / boundary sanity (the chrome coverage shares this geometry).
    expect(chipMaskSdf(0, 0, ax, 1, 1)).toBeLessThan(-0.5); // centre: deep inside
    expect(chipMaskSdf(ax, 0, ax, 1, 0.5)).toBeCloseTo(0, 5); // mid right edge: boundary
    // Outside-rect points are positive even at the resting radius.
    expect(chipMaskSdf(ax + 0.2, 1 + 0.2, ax, 1, 0.02)).toBeGreaterThan(0.1);
  });

  it('chip identity: the docked chip self-illuminates (lift + brass rim) instead of dimming', () => {
    const target = makeTarget(morphIntoCardPrimitive);
    const mesh = target.subject as Mesh;
    const inst = morphIntoCardPrimitive.create(target);
    const stash = target.userData.morphIntoCard as RadiusStash;

    // The swapped material routes legibility through an emissiveNode.
    const mat = mesh.material as unknown as { emissiveNode?: unknown };
    expect(mat.emissiveNode).toBeDefined();

    // Full card: no lift, no rim (the resting look is the source look).
    inst.seek(0);
    expect(stash.uLift.value).toBeCloseTo(0, 5);
    expect(stash.uRim.value).toBeCloseTo(0, 5);

    // Docked chip: full self-illumination lift of its own colour + brass rim —
    // the surviving identity stays legible, never near-background.
    inst.seek(T_CHIP);
    expect(stash.uLift.value).toBeCloseTo(LIFT_MAX, 5);
    expect(stash.uRim.value).toBeCloseTo(RIM_MAX, 5);
    expect(LIFT_MAX).toBeGreaterThanOrEqual(2); // a real lift, not a token one

    // Unfurled again: identity glow fully released.
    inst.seek(T_FULL);
    expect(stash.uLift.value).toBeCloseTo(0, 5);
    expect(stash.uRim.value).toBeCloseTo(0, 5);

    inst.dispose();
  });

  it('chrome co-treatment: chrome travels INTO the chip — full at rest, fading through the dock window, gone when docked', () => {
    const target = makeTarget(morphIntoCardPrimitive);
    const mesh = target.subject as Mesh;
    const header = mesh.getObjectByName('card-header') as Mesh;
    const dot = mesh.getObjectByName('card-dot') as Mesh;
    const headerMat = header.material as MeshStandardMaterial;
    const dotMat = dot.material as MeshStandardMaterial;
    const inst = morphIntoCardPrimitive.create(target);

    // Rest: chrome at full base opacity (coverage 1, dock fade not started).
    inst.seek(0);
    expect(headerMat.opacity).toBeCloseTo(1, 5);
    expect(dotMat.opacity).toBeCloseTo(1, 5);

    // Mid-dock (raw = 0.75 -> t = 0.675s with the 0.9s fold): partially
    // dissolved — visibly fading, not a flat residue and not yet gone.
    inst.seek(0.675);
    expect(headerMat.opacity).toBeGreaterThan(0.05);
    expect(headerMat.opacity).toBeLessThan(0.95);

    // Docked: fully dissolved into the chip. NO residue at the old rect
    // bounds — this is the other half of the ghost-plate regression.
    inst.seek(T_CHIP);
    expect(headerMat.opacity).toBeCloseTo(0, 5);
    expect(dotMat.opacity).toBeCloseTo(0, 5);

    // Unfurl restores chrome along with the card.
    inst.seek(T_FULL);
    expect(headerMat.opacity).toBeCloseTo(1, 5);
    expect(dotMat.opacity).toBeCloseTo(1, 5);

    inst.dispose();
  });

  it('carries the subject map: rebinds when a texture pours in or the material is swapped', () => {
    const target = makeTarget(morphIntoCardPrimitive);
    const mesh = target.subject as Mesh;
    const original = mesh.material as MeshStandardMaterial;
    const inst = morphIntoCardPrimitive.create(target);

    const nodeMat1 = mesh.material;
    expect(nodeMat1).not.toBe(original);

    // Async texture pour onto the live source material (mounted artifacts pour
    // maps AFTER attach) -> the next seek must rebuild to sample the map.
    original.map = new Texture();
    inst.seek(0.1);
    const nodeMat2 = mesh.material as unknown as { colorNode?: unknown };
    expect(nodeMat2).not.toBe(nodeMat1);
    expect(nodeMat2.colorNode).toBeDefined();

    // Full material-instance swap (artifact replaces its material) -> rebind
    // on top of the NEW source, and dispose restores that latest source.
    const fresh = new MeshStandardMaterial({ color: new Color('#aabbcc') });
    mesh.material = fresh;
    inst.seek(0.2);
    expect(mesh.material).not.toBe(fresh);

    inst.dispose();
    expect(mesh.material).toBe(fresh);
  });

  it('dispose restores material, transforms, chrome opacity and transparent flags', () => {
    const target = makeTarget(morphIntoCardPrimitive);
    const mesh = target.subject as Mesh;
    const original = mesh.material;
    const header = mesh.getObjectByName('card-header') as Mesh;
    const headerMat = header.material as MeshStandardMaterial;
    headerMat.transparent = false; // prove the flag round-trips

    const inst = morphIntoCardPrimitive.create(target);
    inst.seek(T_CHIP);

    // Mid-effect: chrome has fully dissolved INTO the docked chip (co-treatment
    // dock fade complete at the plateau) and is forced transparent.
    expect(headerMat.transparent).toBe(true);
    expect(headerMat.opacity).toBeCloseTo(0, 5);
    expect(mesh.scale.x).toBeCloseTo(0.28, 5);

    inst.dispose();
    expect(mesh.material).toBe(original);
    expect(mesh.scale.x).toBe(1);
    expect(mesh.position.x).toBe(0);
    expect(mesh.position.y).toBe(0);
    expect(headerMat.opacity).toBe(1);
    expect(headerMat.transparent).toBe(false);
    expect(target.userData.morphIntoCard).toBeUndefined();
  });
});
