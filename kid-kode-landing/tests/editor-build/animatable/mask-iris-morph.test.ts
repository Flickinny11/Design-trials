import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture } from 'three';
import { maskIrisMorphPrimitive } from '@/lib/prism/animatable/primitives/mask-iris-morph';
import { makeTarget, runConformance } from './_conformance';

// CPU observables the primitive stashes on target.userData (headless — we
// never assert rendered pixels):
//   irisMorphRadius  — uniform handle; .value grows 0 -> R_MAX as the iris opens
//   irisMorphWeights — { star, hex } uniform handles; the SDF morph weights
//   irisMorphGlow    — uniform handle for the rim-glow intensity
//   irisMorphLook    — () => { maps, tints }; what each masked mesh's material
//                      currently binds (texture by reference) + carries (tint)

type U = { value: number };
type Look = () => { maps: unknown[]; tints: string[] };

describe('mask-iris-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(maskIrisMorphPrimitive).dispose();
  });

  it('plays: the aperture opens while its SDF shape morphs circle -> star -> hex', () => {
    const target = makeTarget(maskIrisMorphPrimitive);
    const inst = maskIrisMorphPrimitive.create(target);
    inst.setControl('curve', 'linear'); // make phase math exact
    const radius = target.userData.irisMorphRadius as U;
    const w = target.userData.irisMorphWeights as { star: U; hex: U };
    const dur = inst.duration();

    // t=0: iris closed, pure circle (no morph weight yet)
    inst.seek(0);
    expect(radius.value).toBeLessThan(0.01);
    expect(w.star.value).toBeLessThan(0.01);
    expect(w.hex.value).toBeLessThan(0.01);

    // mid-open (p=0.45): star stage — star weight saturated, hex not started
    inst.seek(dur * 0.45);
    const rMid = radius.value;
    expect(rMid).toBeGreaterThan(0.3);
    expect(w.star.value).toBeGreaterThan(0.9);
    expect(w.hex.value).toBeLessThan(0.01);

    // end (p=1): fully open past the card corners, settled on the hexagon
    inst.seek(dur);
    expect(radius.value).toBeGreaterThan(rMid + 0.3);
    expect(radius.value).toBeGreaterThan(1.2);
    expect(w.hex.value).toBeGreaterThan(0.99);
    inst.dispose();
  });

  it('controls change output: shape path re-routes the morph weights', () => {
    const target = makeTarget(maskIrisMorphPrimitive);
    const inst = maskIrisMorphPrimitive.create(target);
    inst.setControl('curve', 'linear');
    const w = target.userData.irisMorphWeights as { star: U; hex: U };
    const dur = inst.duration();

    inst.setControl('shapePath', 'circle-hex'); // half-open: hex blending, NO star
    inst.seek(dur * 0.5);
    expect(w.star.value).toBe(0);
    expect(w.hex.value).toBeGreaterThan(0.3);

    inst.setControl('shapePath', 'circle-star'); // half-open: star blending, NO hex
    inst.seek(dur * 0.5);
    expect(w.star.value).toBeGreaterThan(0.3);
    expect(w.hex.value).toBe(0);

    inst.setControl('shapePath', 'star-hex'); // starts AS the star, blends to hex
    inst.seek(dur * 0.1);
    expect(w.star.value).toBe(1);
    inst.dispose();
  });

  it('controls change output: edge glow drives the rim uniform min -> max', () => {
    const target = makeTarget(maskIrisMorphPrimitive);
    const inst = maskIrisMorphPrimitive.create(target);
    const glow = target.userData.irisMorphGlow as U;

    inst.setControl('edgeGlow', 0);
    inst.seek(1);
    expect(glow.value).toBe(0);

    inst.setControl('edgeGlow', 2.5);
    inst.seek(1);
    expect(glow.value).toBe(2.5);
    inst.dispose();
  });

  it('controls change output: shorter duration opens further by a fixed time', () => {
    const target = makeTarget(maskIrisMorphPrimitive);
    const inst = maskIrisMorphPrimitive.create(target);
    const radius = target.userData.irisMorphRadius as U;

    inst.setControl('duration', 5); // slow iris — barely open at 1s
    inst.seek(1);
    const slow = radius.value;

    inst.setControl('duration', 0.5); // fast iris — fully open at 1s
    inst.seek(1);
    const fast = radius.value;

    expect(fast).toBeGreaterThan(slow + 0.3);
    inst.dispose();
  });

  it("carries the subject's look: tint from the live material, poured maps bound by reference", () => {
    const target = makeTarget(maskIrisMorphPrimitive);
    const mesh = target.subject as Mesh;
    const original = mesh.material as MeshStandardMaterial;
    const inst = maskIrisMorphPrimitive.create(target);
    const look = target.userData.irisMorphLook as Look;

    // mask material installed; tint = the panel's own color (never invented)
    expect(mesh.material).not.toBe(original);
    expect(look().tints[0]).toBe(original.color.getHexString());
    // no subject map yet -> a neutral fallback texture is bound (not null)
    expect(look().maps[0]).toBeTruthy();

    // ASYNC POUR: a texture lands on the ORIGINAL material after create —
    // the next seek must rebind it by reference (P0 lesson: clone-once = white)
    const poured = new Texture();
    original.map = poured;
    inst.seek(0.6);
    expect(look().maps[0]).toBe(poured);

    // EXTERNAL SWAP: artifact code replaces the whole material instance —
    // the next seek adopts it as the new source of look and re-installs the mask
    const swapped = new MeshStandardMaterial({ color: new Color('#886644') });
    mesh.material = swapped;
    inst.seek(0.8);
    expect(mesh.material).not.toBe(swapped);
    expect(look().tints[0]).toBe(swapped.color.getHexString());

    // dispose restores the LATEST live source material, not the stale original
    inst.dispose();
    expect(mesh.material).toBe(swapped);
    poured.dispose();
    swapped.dispose();
    original.dispose();
  });

  it('dispose restores the subject material and clears userData observables', () => {
    const target = makeTarget(maskIrisMorphPrimitive);
    const mesh = target.subject as Mesh;
    const original = mesh.material;
    const inst = maskIrisMorphPrimitive.create(target);
    inst.seek(1.2);
    expect(mesh.material).not.toBe(original);

    inst.dispose();
    expect(mesh.material).toBe(original);
    expect(target.userData.irisMorphRadius).toBeUndefined();
    expect(target.userData.irisMorphWeights).toBeUndefined();
    expect(target.userData.irisMorphGlow).toBeUndefined();
    expect(target.userData.irisMorphLook).toBeUndefined();
  });
});
