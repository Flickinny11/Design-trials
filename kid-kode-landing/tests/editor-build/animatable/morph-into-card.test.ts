import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture } from 'three';
import {
  morphIntoCardPrimitive,
  CHIP_HOLD,
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

    // Mid-effect: chrome is faded (and forced transparent) while the chip holds.
    expect(headerMat.transparent).toBe(true);
    expect(headerMat.opacity).toBeCloseTo(0.25, 5);
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
