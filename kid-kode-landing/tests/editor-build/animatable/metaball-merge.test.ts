import { describe, it, expect } from 'vitest';
import { Mesh, MeshStandardMaterial, Texture, type Material } from 'three';
import { metaballMergePrimitive } from '@/lib/prism/animatable/primitives/metaball-merge';
import { makeTarget, runConformance } from './_conformance';
import type { AnimatableTarget } from '@/lib/prism/animatable/contract';

interface UniformLike {
  value: number;
}
interface Handle {
  uSeal: UniformLike;
  uRadius: UniformLike;
  uBlend: UniformLike;
  uGlow: UniformLike;
  uActive: UniformLike[];
  ballX: UniformLike[];
  ballY: UniformLike[];
  mapNode: { value: Texture };
  uColor: { r: UniformLike; g: UniformLike; b: UniformLike };
}

const handleOf = (target: AnimatableTarget): Handle =>
  target.userData.metaballMerge as Handle;

const activeSum = (h: Handle): number => h.uActive.reduce((s, u) => s + u.value, 0);

describe('metaball-merge primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(metaballMergePrimitive).dispose();
  });

  it('plays: balls swim in from off-card edges and the smooth-union seals to full coverage', () => {
    const target = makeTarget(metaballMergePrimitive);
    const inst = metaballMergePrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Material swapped for a node material masking the card (alpha from the
    // SDF field) whose colorNode carries the subject's look.
    const nodeMat = mesh.material as unknown as { opacityNode?: unknown; colorNode?: unknown };
    expect(nodeMat.opacityNode).toBeTruthy();
    expect(nodeMat.colorNode).toBeTruthy();

    const h = handleOf(target);
    const dur = inst.duration();
    expect(Number.isFinite(dur)).toBe(true);
    expect(dur).toBeGreaterThan(0);

    // t = 0: ball 0 starts off the LEFT edge (uv x < 0), the union seal is
    // closed (0) and the ball radius is at its small launch size.
    inst.seek(0);
    const x0 = h.ballX[0].value;
    const seal0 = h.uSeal.value;
    const r0 = h.uRadius.value;
    expect(x0).toBeLessThan(-0.1);
    expect(seal0).toBe(0);

    // mid: ball 0 has TRAVELED toward its interior landing spot — strictly
    // between the edge start and the settled end (this is the distinction from
    // splat-reveal's grow-in-place blobs).
    inst.seek(dur * 0.5);
    const xm = h.ballX[0].value;
    expect(xm).toBeGreaterThan(x0 + 0.1);
    expect(xm).toBeLessThan(0.47);

    // end: ball 0 settled exactly on its landing x (wobble fully damped), the
    // seal has swept the union out to full-rect coverage, the radius grew.
    inst.seek(dur);
    const xe = h.ballX[0].value;
    expect(xe).toBeCloseTo(0.5, 5);
    expect(xe).toBeGreaterThan(xm);
    expect(h.uSeal.value).toBeGreaterThan(0.3);
    expect(h.uRadius.value).toBeGreaterThan(r0 + 0.1);

    // Chrome co-fade: the card's brass header arrives with the liquid —
    // invisible at t=0, fully restored opacity at t=end.
    const header = mesh.getObjectByName('card-header') as Mesh;
    const headerMat = header.material as Material & { opacity: number };
    inst.seek(0);
    expect(headerMat.opacity).toBe(0);
    inst.seek(dur);
    expect(headerMat.opacity).toBeCloseTo(1, 5);

    inst.dispose();
  });

  it("carries the subject's look: late texture pour and material swaps rebind live", () => {
    const target = makeTarget(metaballMergePrimitive);
    const mesh = target.subject as Mesh;
    const original = mesh.material as MeshStandardMaterial;
    const inst = metaballMergePrimitive.create(target);
    const h = handleOf(target);

    // The catalog card is map-less: the colorNode lane is bound to the owned
    // white fallback texture (color = the subject material's own color, never
    // an invented fill).
    expect((h.mapNode.value as Texture).isTexture).toBe(true);
    const fallback = h.mapNode.value;
    expect(h.uColor.r.value).toBeCloseTo(original.color.r, 6);
    expect(h.uColor.g.value).toBeCloseTo(original.color.g, 6);
    expect(h.uColor.b.value).toBeCloseTo(original.color.b, 6);

    // LATE POUR: the artifact's texture lands on the ORIGINAL material after
    // attach (async pour). The next seek must rebind the shared Texture by
    // reference.
    const poured = new Texture();
    original.map = poured;
    inst.seek(0.5);
    expect(h.mapNode.value).toBe(poured);

    // MATERIAL SWAP: applyImageSpec may swap an entirely new material into the
    // mesh slot. The next seek adopts it as the live source (map + color) and
    // takes the slot back for the mask material.
    const tex2 = new Texture();
    const swapped = new MeshStandardMaterial({ map: tex2 });
    swapped.color.setRGB(0.9, 0.5, 0.2);
    mesh.material = swapped;
    inst.seek(0.6);
    expect(mesh.material).not.toBe(swapped);
    expect((mesh.material as unknown as { opacityNode?: unknown }).opacityNode).toBeTruthy();
    expect(h.mapNode.value).toBe(tex2);
    expect(h.uColor.r.value).toBeCloseTo(0.9, 6);
    expect(h.uColor.g.value).toBeCloseTo(0.5, 6);
    expect(h.uColor.b.value).toBeCloseTo(0.2, 6);

    // dispose restores the LATEST live source material, not the stale one.
    inst.dispose();
    expect(mesh.material).toBe(swapped);
    expect(fallback).not.toBe(poured);
  });

  it('controls change output: balls / blend / glow drive the live uniforms', () => {
    const target = makeTarget(metaballMergePrimitive);
    const inst = metaballMergePrimitive.create(target);
    const h = handleOf(target);

    inst.setControl('balls', 3);
    inst.seek(1);
    expect(activeSum(h)).toBe(3);
    const radius3 = h.uRadius.value;

    inst.setControl('balls', 7);
    inst.seek(1);
    expect(activeSum(h)).toBe(7);
    const radius7 = h.uRadius.value;
    // Fewer balls compensate with larger radii (same t, same growth phase).
    expect(radius3).toBeGreaterThan(radius7);

    inst.setControl('blend', 0.05);
    inst.seek(1);
    const kMin = h.uBlend.value;
    inst.setControl('blend', 0.6);
    inst.seek(1);
    expect(h.uBlend.value).toBeGreaterThan(kMin + 0.3);

    inst.setControl('glow', 0);
    inst.seek(1);
    expect(h.uGlow.value).toBe(0);
    inst.setControl('glow', 2);
    inst.seek(1);
    expect(h.uGlow.value).toBe(2);

    inst.dispose();
  });

  it('dispose restores the material, chrome opacity/transparency, and userData', () => {
    const target = makeTarget(metaballMergePrimitive);
    const mesh = target.subject as Mesh;
    const original = mesh.material;
    const header = mesh.getObjectByName('card-header') as Mesh;
    const headerMat = header.material as Material & { opacity: number };
    const origOpacity = headerMat.opacity;
    const origTransparent = headerMat.transparent;

    const inst = metaballMergePrimitive.create(target);
    inst.seek(0.4); // early in the morph — chrome is co-faded out
    expect(headerMat.opacity).not.toBe(origOpacity);

    inst.dispose();
    expect(mesh.material).toBe(original);
    expect(headerMat.opacity).toBe(origOpacity);
    expect(headerMat.transparent).toBe(origTransparent);
    expect(target.userData.metaballMerge).toBeUndefined();
  });
});
