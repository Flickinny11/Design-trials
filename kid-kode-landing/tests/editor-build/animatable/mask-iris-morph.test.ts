import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture, type Material } from 'three';
import { maskIrisMorphPrimitive } from '@/lib/prism/animatable/primitives/mask-iris-morph';
import { makeTarget, runConformance } from './_conformance';

// CPU observables the primitive stashes on target.userData (headless — we
// never assert rendered pixels):
//   irisMorphRadius  — uniform handle; .value grows 0 -> R_MAX as the iris opens
//   irisMorphWeights — { star, hex } uniform handles; the SDF morph weights
//   irisMorphGlow    — uniform handle for the rim-glow intensity
//   irisMorphLook    — () => { maps, tints }; what each masked mesh's material
//                      currently binds (texture by reference) + carries (tint)
//   irisMorphChrome  — () => [{ u, v, base, opacity }]; each chrome child's
//                      center in face-uv space + its live gated opacity

type U = { value: number };
type Look = () => { maps: unknown[]; tints: string[] };
type Chrome = () => Array<{ u: number; v: number; base: number; opacity: number }>;
type OpaqueMat = Material & { opacity: number };

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

  it('chrome co-treatment: a closed iris hides ALL chrome; the aperture front reveals each child as it passes', () => {
    const target = makeTarget(maskIrisMorphPrimitive);
    const inst = maskIrisMorphPrimitive.create(target);
    inst.setControl('curve', 'linear'); // radius = (t/dur) * MAX_RADIUS exactly
    const chrome = target.userData.irisMorphChrome as Chrome;
    const dur = inst.duration();

    // The card composite mounts chrome children (header bar, dot, 3 rows).
    expect(chrome().length).toBeGreaterThanOrEqual(3);

    // t=0 (closed): NOTHING of the card visible — every chrome child gated to 0
    // (this is the advocate's cited defect: chrome used to float fully visible).
    inst.seek(0);
    for (const c of chrome()) expect(c.opacity).toBeLessThan(0.02);

    // Mid-open (radius 0.28 in uv units): the front has passed the near-center
    // row but NOT the far corner dot — reveal tracks the aperture, per-child.
    inst.seek((0.28 / 1.35) * dur);
    const mid = chrome();
    const dist = (c: { u: number; v: number }) => Math.hypot(c.u - 0.5, c.v - 0.5);
    const nearest = mid.reduce((a, b) => (dist(a) < dist(b) ? a : b));
    const farthest = mid.reduce((a, b) => (dist(a) > dist(b) ? a : b));
    expect(nearest.opacity).toBeGreaterThan(nearest.base * 0.6);
    expect(farthest.opacity).toBeLessThan(0.02);

    // Fully open: every chrome child restored to its base opacity — the
    // settled card is the untouched composite.
    inst.seek(dur);
    for (const c of chrome()) expect(c.opacity).toBeCloseTo(c.base, 5);
    inst.dispose();
  });

  it('chrome co-treatment latches on control change while PAUSED (capture-rig sweep at pinned t)', () => {
    const target = makeTarget(maskIrisMorphPrimitive);
    const inst = maskIrisMorphPrimitive.create(target);
    inst.setControl('curve', 'linear');
    const radius = target.userData.irisMorphRadius as U;
    const chrome = target.userData.irisMorphChrome as Chrome;

    // Pin t=1s (the rig's control-sweep phase), then change duration WITHOUT
    // another seek: onParamChange must re-apply at the held time.
    inst.seek(1);
    inst.setControl('duration', 5); // slow iris — nearly closed at 1s
    const slowR = radius.value;
    const slowVis = chrome().reduce((s, c) => s + c.opacity, 0);

    inst.setControl('duration', 0.5); // fast iris — fully open at 1s
    const fastR = radius.value;
    const fastVis = chrome().reduce((s, c) => s + c.opacity, 0);

    expect(fastR).toBeGreaterThan(slowR + 0.3); // radius latched with NO re-seek
    expect(fastVis).toBeGreaterThan(slowVis + 1); // chrome gating latched too
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

  it('dispose restores the subject material, chrome opacity, and clears userData observables', () => {
    const target = makeTarget(maskIrisMorphPrimitive);
    const mesh = target.subject as Mesh;
    const original = mesh.material;
    // Snapshot every chrome child material's opacity/transparent BEFORE create.
    const chromeSnaps: Array<{ mat: OpaqueMat; opacity: number; transparent: boolean }> = [];
    mesh.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || m === mesh || !m.material) return;
      for (const cm of Array.isArray(m.material) ? m.material : [m.material]) {
        const om = cm as OpaqueMat;
        chromeSnaps.push({ mat: om, opacity: om.opacity, transparent: om.transparent });
      }
    });
    expect(chromeSnaps.length).toBeGreaterThanOrEqual(3);

    const inst = maskIrisMorphPrimitive.create(target);
    inst.seek(0.4); // mostly closed — chrome gated well below base
    expect(mesh.material).not.toBe(original);
    expect(chromeSnaps.some((s) => s.mat.opacity < s.opacity)).toBe(true);

    inst.dispose();
    expect(mesh.material).toBe(original);
    // Chrome handed back exactly as found.
    for (const s of chromeSnaps) {
      expect(s.mat.opacity).toBe(s.opacity);
      expect(s.mat.transparent).toBe(s.transparent);
    }
    expect(target.userData.irisMorphRadius).toBeUndefined();
    expect(target.userData.irisMorphWeights).toBeUndefined();
    expect(target.userData.irisMorphGlow).toBeUndefined();
    expect(target.userData.irisMorphLook).toBeUndefined();
    expect(target.userData.irisMorphChrome).toBeUndefined();
  });
});
