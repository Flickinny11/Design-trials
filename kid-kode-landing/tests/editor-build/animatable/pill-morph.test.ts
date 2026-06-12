import { describe, it, expect } from 'vitest';
import { Mesh, MeshStandardMaterial, Texture, type Material } from 'three';
import { pillMorphPrimitive } from '@/lib/prism/animatable/primitives/pill-morph';
import { makeTarget, runConformance } from './_conformance';

interface UniformHandle {
  value: number;
}

/** The swapped-in node material's shape, as far as the tests observe it. */
type NodeMat = Material & {
  transparent: boolean;
  opacityNode?: unknown;
  colorNode?: { value?: unknown };
};

describe('pill-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pillMorphPrimitive).dispose();
  });

  it('plays: radius breathes 0 -> 0.5 -> 0 while the card squeezes to a pill footprint and back', () => {
    const target = makeTarget(pillMorphPrimitive);
    const inst = pillMorphPrimitive.create(target);
    const subject = target.subject as Mesh;
    const mat = subject.material as NodeMat;

    // The panel material is swapped for a transparent node material whose
    // opacity is the rounded-rect SDF mask.
    expect(mat.transparent).toBe(true);
    expect(mat.opacityNode).toBeDefined();

    const dur = inst.duration();
    const radius = target.userData.pillRadius as UniformHandle;
    const aspect = target.userData.pillAspect as UniformHandle;

    // t=0 — rectangular self: no corner rounding, no squeeze.
    inst.seek(0);
    expect(radius.value).toBeCloseTo(0, 5);
    expect(subject.scale.x).toBeCloseTo(1, 5);
    expect(subject.scale.y).toBeCloseTo(1, 5);

    // mid (hold zone) — full pill: radius 0.5 (half the squeezed height) and
    // a strong non-uniform squeeze (defaults: height -> 0.34, width -> ~0.70).
    inst.seek(dur * 0.5);
    expect(radius.value).toBeCloseTo(0.5, 5);
    expect(subject.scale.y).toBeGreaterThan(0.2);
    expect(subject.scale.y).toBeLessThan(0.5);
    expect(subject.scale.x).toBeGreaterThan(0.5);
    expect(subject.scale.x).toBeLessThan(0.85);
    // The SDF works in a height-normalized space whose x is the VISIBLE
    // aspect — at full morph that aspect equals the pillAspect control (3.2).
    expect(aspect.value).toBeCloseTo(3.2, 1);

    // end — the breath returns the card to its rectangular self.
    inst.seek(dur);
    expect(radius.value).toBeCloseTo(0, 5);
    expect(subject.scale.x).toBeCloseTo(1, 5);
    expect(subject.scale.y).toBeCloseTo(1, 5);

    inst.dispose();
  });

  it('plays: card content (chrome) folds away as the card compacts into a button', () => {
    const target = makeTarget(pillMorphPrimitive);
    const subject = target.subject as Mesh;
    const header = subject.children.find((c) => c.name === 'card-header') as Mesh;
    const headerMat = header.material as Material & { opacity: number };
    expect(headerMat.opacity).toBe(1);

    const inst = pillMorphPrimitive.create(target);
    const dur = inst.duration();
    inst.seek(dur * 0.5);
    // Full pill — the content rows have fully faded.
    expect(headerMat.opacity).toBeLessThan(0.05);
    inst.seek(dur);
    expect(headerMat.opacity).toBeCloseTo(1, 5);
    inst.dispose();
  });

  it('controls change output: squeeze gates the footprint travel, pillAspect reshapes the pill', () => {
    const target = makeTarget(pillMorphPrimitive);
    const inst = pillMorphPrimitive.create(target);
    const subject = target.subject as Mesh;
    const dur = inst.duration();

    // squeeze 0 — silhouette-only morph: corners round but the footprint stays.
    inst.setControl('squeeze', 0);
    inst.seek(dur * 0.5);
    const radius = target.userData.pillRadius as UniformHandle;
    expect(radius.value).toBeCloseTo(0.5, 5);
    expect(subject.scale.y).toBeCloseTo(1, 5);
    const wideX = subject.scale.x;

    // squeeze 1 — full pill footprint.
    inst.setControl('squeeze', 1);
    inst.seek(dur * 0.5);
    expect(subject.scale.y).toBeLessThan(0.5);
    expect(wideX - subject.scale.x).toBeGreaterThan(0.2);

    // pillAspect min vs max at the same frame — visibly different pill widths.
    inst.setControl('pillAspect', 2);
    inst.seek(dur * 0.5);
    const stubbyX = subject.scale.x;
    inst.setControl('pillAspect', 6);
    inst.seek(dur * 0.5);
    const longX = subject.scale.x;
    expect(longX - stubbyX).toBeGreaterThan(0.3);

    inst.dispose();
  });

  it('map carry: a texture poured onto the source material AFTER create rebinds the mask colorNode', () => {
    const target = makeTarget(pillMorphPrimitive);
    const subject = target.subject as Mesh;
    const original = subject.material as MeshStandardMaterial;

    const inst = pillMorphPrimitive.create(target);
    const mat = subject.material as NodeMat;
    expect(mat).not.toBe(original);
    // No map yet — colorNode falls back to the subject material's own color.
    expect(mat.colorNode).toBeDefined();
    expect((mat.colorNode as { value?: unknown }).value).toBeUndefined();

    // Simulate the mounted-artifact late texture pour: the app's loader holds
    // the ORIGINAL material instance and writes .map onto it asynchronously.
    const poured = new Texture();
    original.map = poured;
    inst.seek(1.2);
    expect((subject.material as NodeMat).colorNode?.value).toBe(poured);

    inst.dispose();
  });

  it('map carry: a wholesale material swap by the app is adopted as the new source', () => {
    const target = makeTarget(pillMorphPrimitive);
    const subject = target.subject as Mesh;
    const inst = pillMorphPrimitive.create(target);

    // applyImageSpec may replace the mesh material entirely after attach.
    const swapped = new MeshStandardMaterial();
    const tex = new Texture();
    swapped.map = tex;
    subject.material = swapped;

    inst.seek(1.4);
    // The mask material is re-installed and now samples the swapped-in map.
    const live = subject.material as NodeMat;
    expect(live).not.toBe(swapped);
    expect(live.opacityNode).toBeDefined();
    expect(live.colorNode?.value).toBe(tex);

    // dispose hands back the LATEST app material, not the stale original.
    inst.dispose();
    expect(subject.material).toBe(swapped);
    swapped.dispose();
  });

  it('dispose restores material identity, subject scale, and chrome opacity', () => {
    const target = makeTarget(pillMorphPrimitive);
    const subject = target.subject as Mesh;
    const original = subject.material;
    const header = subject.children.find((c) => c.name === 'card-header') as Mesh;
    const headerMat = header.material as Material & { opacity: number };
    const prevTransparent = headerMat.transparent;

    const inst = pillMorphPrimitive.create(target);
    inst.seek(inst.duration() * 0.5); // mid-morph: squeezed, faded, masked
    inst.dispose();

    expect(subject.material).toBe(original);
    expect(subject.scale.x).toBeCloseTo(1, 5);
    expect(subject.scale.y).toBeCloseTo(1, 5);
    expect(headerMat.opacity).toBe(1);
    expect(headerMat.transparent).toBe(prevTransparent);
    expect(target.userData.pillRadius).toBeUndefined();
    expect(target.userData.pillAspect).toBeUndefined();
  });
});
