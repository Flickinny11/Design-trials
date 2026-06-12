import { describe, it, expect } from 'vitest';
import { DataTexture, Group, Mesh, Scene, type Material, type Texture } from 'three';
import { skeletonResolvePrimitive } from '@/lib/prism/animatable/primitives/skeleton-resolve';
import { buildSubject } from '@/lib/prism/animatable/subjects';
import { makeTarget, runConformance } from './_conformance';

type Uni = { value: number };
type SkeletonUniforms = {
  uResolve: Uni;
  uContrast: Uni;
  uSweep: Uni;
  uGhost: Uni;
  uFront: Uni;
};
type BarRect = { cu: number; cv: number; hw: number; hh: number };
type ChromeMat = Material & { opacity: number; emissiveIntensity?: number };
type MappedMat = Material & { map?: Texture | null };

const uniformsOf = (target: { userData: Record<string, unknown> }): SkeletonUniforms =>
  target.userData.skeletonResolveUniforms as SkeletonUniforms;
const barsOf = (target: { userData: Record<string, unknown> }): BarRect[] =>
  target.userData.skeletonResolveBars as BarRect[];

describe('skeleton-resolve primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(skeletonResolvePrimitive).dispose();
  });

  it('plays: skeleton phase hides the chrome entirely, then content resolves with a pop that settles', () => {
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

    // t=0 — pure skeleton: no resolve, the resolve front parked off-face, and
    // the chrome FULLY hidden (co-treatment — it must never float over the
    // placeholder bars).
    inst.seek(0);
    expect(uni.uResolve.value).toBe(0);
    expect(uni.uSweep.value).toBe(0);
    expect(uni.uFront.value).toBeLessThan(0);
    expect(headerMat.opacity).toBe(0);

    // Early ghost phase — the shimmer band has swept (uSweep advanced) while
    // the resolve crossfade is still parked at zero and chrome stays hidden.
    inst.seek(0.3 * dur);
    expect(uni.uSweep.value).toBeGreaterThan(0.5);
    expect(uni.uResolve.value).toBe(0);
    expect(headerMat.opacity).toBe(0);

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

  it('derives skeleton bars from the measured chrome layout (one per child, header wider than dot)', () => {
    const target = makeTarget(skeletonResolvePrimitive);
    const inst = skeletonResolvePrimitive.create(target);
    const bars = barsOf(target);

    // Card chrome = header + dot + 3 rows → 5 placeholder bars.
    expect(bars.length).toBe(5);
    // Every bar rect lands on the face's uv chart.
    for (const b of bars) {
      expect(b.cu).toBeGreaterThan(-0.05);
      expect(b.cu).toBeLessThan(1.05);
      expect(b.cv).toBeGreaterThan(-0.05);
      expect(b.cv).toBeLessThan(1.05);
      expect(b.hw).toBeGreaterThan(0);
      expect(b.hh).toBeGreaterThan(0);
    }
    // The widest bar (a full content row) dwarfs the dot placeholder — the
    // skeleton mirrors the real layout, not a generic stripe pattern.
    const widths = bars.map((b) => b.hw);
    expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths) * 5);

    inst.dispose();
    expect(target.userData.skeletonResolveBars).toBeUndefined();
  });

  it('chrome co-treatment: the resolve front wipes chrome back in positionally (header before last row)', () => {
    const target = makeTarget(skeletonResolvePrimitive);
    const panel = target.subject as Mesh;
    const header = panel.getObjectByName('card-header') as Mesh;
    const headerMat = header.material as ChromeMat;
    const rows = panel.getObjectByName('card-rows') as Group;
    const lastRow = rows.children[rows.children.length - 1] as Mesh;
    const lastRowMat = lastRow.material as ChromeMat;

    const inst = skeletonResolvePrimitive.create(target);
    const dur = inst.duration();

    // Mid-resolve: the diagonal front (top-left → bottom-right) has passed
    // the header but not yet the bottom row — partial, ordered coverage.
    inst.seek(0.63 * dur);
    expect(headerMat.opacity).toBeGreaterThan(lastRowMat.opacity + 0.5);
    expect(headerMat.opacity).toBeGreaterThan(0.5);
    expect(lastRowMat.opacity).toBeLessThan(0.3);

    // Fully resolved: every chrome child back at base.
    inst.seek(dur);
    expect(headerMat.opacity).toBeCloseTo(1, 6);
    expect(lastRowMat.opacity).toBeCloseTo(1, 6);

    inst.dispose();
  });

  it('controls change output at the paused pinned frame (t=1s, mid-ghost)', () => {
    const target = makeTarget(skeletonResolvePrimitive);
    const panel = target.subject as Mesh;
    const header = panel.getObjectByName('card-header') as Mesh;
    const headerMat = header.material as ChromeMat;

    const inst = skeletonResolvePrimitive.create(target);
    const uni = uniformsOf(target);

    // Pause mid-ghost-phase exactly like the CONTROLS gate does (t=1s at the
    // default 2.4s duration → p≈0.42 < RESOLVE_START).
    inst.seek(1);
    expect(uni.uResolve.value).toBe(0);
    expect(headerMat.opacity).toBe(0);

    // Ghost knob drives the PLATE darkness uniform live at the paused frame —
    // and the chrome stays hidden at both extremes (co-treatment is phase-
    // driven, never ghost-driven).
    inst.setControl('ghost', 0);
    const ghostLight = uni.uGhost.value;
    const opLight = headerMat.opacity;
    inst.setControl('ghost', 1);
    const ghostDark = uni.uGhost.value;
    const opDark = headerMat.opacity;
    expect(ghostDark).toBeGreaterThan(ghostLight + 0.5);
    expect(opLight).toBe(0);
    expect(opDark).toBe(0);

    // Shimmer speed repositions the sweep band at the same paused time.
    inst.setControl('speed', 0.2);
    const sweepSlow = uni.uSweep.value;
    inst.setControl('speed', 4);
    const sweepFast = uni.uSweep.value;
    expect(sweepFast).toBeGreaterThan(sweepSlow + 2);

    // Duration min resolves the frame entirely at the same paused t=1s.
    inst.setControl('duration', 0.8);
    expect(uni.uResolve.value).toBe(1);

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
    const glyph6 = subject!.getObjectByName('glyph-6') as Mesh;
    const glyph6Mat = glyph6.material as ChromeMat;

    const inst = skeletonResolvePrimitive.create(target);
    // Representative mesh inside the Group got the skeleton material.
    expect(glyph0.material).not.toBe(glyph0Mat);
    inst.seek(0.5);
    // Sibling glyphs are co-treated chrome whose far-off-chart centers are
    // clamped onto the face — they MUST fully resolve by the end.
    inst.seek(inst.duration());
    expect(glyph6Mat.opacity).toBeCloseTo(1, 6);
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
