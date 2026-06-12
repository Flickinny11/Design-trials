import { describe, it, expect } from 'vitest';
import { DataTexture, Mesh, Scene, type Material, type Texture } from 'three';
import { skeletonResolvePrimitive } from '@/lib/prism/animatable/primitives/skeleton-resolve';
import { buildSubject } from '@/lib/prism/animatable/subjects';
import { makeTarget, runConformance } from './_conformance';

type Uni = { value: number };
type SkeletonUniforms = {
  uResolve: Uni;
  uContrast: Uni;
  uSweep: Uni;
  uGhost: Uni;
};
type ChromeMat = Material & { opacity: number; emissiveIntensity?: number };
type MappedMat = Material & { map?: Texture | null };

const uniformsOf = (target: { userData: Record<string, unknown> }): SkeletonUniforms =>
  target.userData.skeletonResolveUniforms as SkeletonUniforms;

describe('skeleton-resolve primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(skeletonResolvePrimitive).dispose();
  });

  it('plays: ghost+shimmer phase sweeps, then content resolves with a contrast pop that settles', () => {
    const target = makeTarget(skeletonResolvePrimitive);
    const panel = target.subject as Mesh;
    const originalMat = panel.material as Material;
    const header = panel.getObjectByName('card-header') as Mesh;
    const headerMat = header.material as ChromeMat;

    const inst = skeletonResolvePrimitive.create(target);
    const dur = inst.duration();
    const uni = uniformsOf(target);

    // The panel face material was swapped for the skeleton node material.
    expect(panel.material).not.toBe(originalMat);

    // t=0 — pure skeleton: no resolve, chrome dimmed (ghost of the layout).
    inst.seek(0);
    expect(uni.uResolve.value).toBe(0);
    expect(uni.uSweep.value).toBe(0);
    expect(headerMat.opacity).toBeLessThan(0.7);

    // Early ghost phase — the shimmer band has swept (uSweep advanced) while
    // the resolve crossfade is still parked at zero.
    inst.seek(0.3 * dur);
    expect(uni.uSweep.value).toBeGreaterThan(0.5);
    expect(uni.uResolve.value).toBe(0);
    expect(headerMat.opacity).toBeLessThan(0.7);

    // Near the end — content nearly resolved AND the sharpening pop is live
    // (contrast briefly overshoots 1).
    inst.seek(0.9 * dur);
    expect(uni.uResolve.value).toBeGreaterThan(0.9);
    expect(uni.uContrast.value).toBeGreaterThan(1.1);

    // Final frame — fully resolved, pop settled back to neutral contrast,
    // chrome restored to full presence.
    inst.seek(dur);
    expect(uni.uResolve.value).toBe(1);
    expect(uni.uContrast.value).toBeCloseTo(1, 6);
    expect(headerMat.opacity).toBeCloseTo(1, 6);

    inst.dispose();
  });

  it('controls change output at a paused frame (t=1s): ghost darkness + shimmer speed', () => {
    const target = makeTarget(skeletonResolvePrimitive);
    const panel = target.subject as Mesh;
    const header = panel.getObjectByName('card-header') as Mesh;
    const headerMat = header.material as ChromeMat;

    const inst = skeletonResolvePrimitive.create(target);
    const uni = uniformsOf(target);

    // Pause mid-ghost-phase exactly like the CONTROLS gate does.
    inst.seek(1);

    inst.setControl('ghost', 0);
    const opLight = headerMat.opacity;
    const ghostLight = uni.uGhost.value;

    inst.setControl('ghost', 1);
    const opDark = headerMat.opacity;
    const ghostDark = uni.uGhost.value;

    // Max darkness clearly dims the layout ghost vs zero darkness.
    expect(opLight - opDark).toBeGreaterThan(0.5);
    expect(ghostDark).toBeGreaterThan(ghostLight + 0.5);

    // Shimmer speed repositions the sweep band at the same paused time.
    inst.setControl('speed', 0.2);
    const sweepSlow = uni.uSweep.value;
    inst.setControl('speed', 4);
    const sweepFast = uni.uSweep.value;
    expect(sweepFast).toBeGreaterThan(sweepSlow + 2);

    inst.dispose();
  });

  it('carries a late-poured subject map: rebinds the node material when .map lands', () => {
    const target = makeTarget(skeletonResolvePrimitive);
    const panel = target.subject as Mesh;
    const sourceMat = panel.material as MappedMat;

    const inst = skeletonResolvePrimitive.create(target);
    const matBeforePour = panel.material as Material;
    expect(target.userData.skeletonResolveRebuilds).toBe(0);
    expect(target.userData.skeletonResolveCarriedMap).toBeNull();

    // Simulate the mounted-artifact async texture pour: the factory retains the
    // displaced source material and sets .map on it AFTER the primitive attached.
    const poured = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    sourceMat.map = poured;

    // The very next seek must detect the map identity change and rebuild the
    // node material so its colorNode samples the poured texture.
    inst.seek(0.2);
    expect(panel.material).not.toBe(matBeforePour);
    expect(target.userData.skeletonResolveRebuilds).toBe(1);
    expect(target.userData.skeletonResolveCarriedMap).toBe(poured);

    // No further rebuilds while the map identity is stable.
    inst.seek(0.4);
    expect(target.userData.skeletonResolveRebuilds).toBe(1);

    inst.dispose();
    poured.dispose();
  });

  it('handles a Group subject (MSDF text-object shape): swaps the representative mesh', () => {
    const scene = new Scene();
    const { object, subject } = buildSubject('text');
    scene.add(object);
    const target = { object, subject, scene, userData: {} as Record<string, unknown> };

    const glyph0 = subject!.getObjectByName('glyph-0') as Mesh;
    const glyph0Mat = glyph0.material as Material;

    const inst = skeletonResolvePrimitive.create(target);
    // Representative mesh inside the Group got the skeleton material.
    expect(glyph0.material).not.toBe(glyph0Mat);
    inst.seek(0.5);
    inst.dispose();
    expect(glyph0.material).toBe(glyph0Mat);
  });

  it('dispose restores the source material, chrome state, and disposes the node material', () => {
    const target = makeTarget(skeletonResolvePrimitive);
    const panel = target.subject as Mesh;
    const originalMat = panel.material as Material;
    const header = panel.getObjectByName('card-header') as Mesh;
    const headerMat = header.material as ChromeMat;
    const baseOpacity = headerMat.opacity;
    const baseTransparent = headerMat.transparent;
    const baseEmissive = headerMat.emissiveIntensity as number;

    const inst = skeletonResolvePrimitive.create(target);
    const nodeMat = panel.material as Material;
    let nodeMatDisposed = false;
    nodeMat.addEventListener('dispose', () => {
      nodeMatDisposed = true;
    });

    // Drive mid-timeline so transforms of state are actually dirtied.
    inst.seek(0.6 * inst.duration());
    expect(headerMat.opacity).not.toBe(baseOpacity);

    inst.dispose();
    expect(panel.material).toBe(originalMat);
    expect(headerMat.opacity).toBe(baseOpacity);
    expect(headerMat.transparent).toBe(baseTransparent);
    expect(headerMat.emissiveIntensity).toBe(baseEmissive);
    expect(nodeMatDisposed).toBe(true);
  });
});
