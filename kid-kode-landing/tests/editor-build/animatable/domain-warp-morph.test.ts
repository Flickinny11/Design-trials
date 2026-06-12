import { describe, it, expect } from 'vitest';
import { Mesh, MeshStandardMaterial, Texture } from 'three';
import { domainWarpMorphPrimitive } from '@/lib/prism/animatable/primitives/domain-warp-morph';
import { makeTarget, runConformance } from './_conformance';

// The primitive stashes its live uniform handles + the map-binding probe on
// target.userData.domainWarpMorph (the shared scratch space the contract
// provides). Reading their .value is fully CPU-observable — no GPU, no pixels.
interface Handles {
  uMorph: { value: number };
  uWarp: { value: number };
  uFlowT: { value: number };
  uOctaves: { value: number };
  sampledMap: () => Texture | null;
}
const handlesOf = (target: ReturnType<typeof makeTarget>): Handles =>
  (target.userData as Record<string, unknown>).domainWarpMorph as Handles;

type NodeMat = MeshStandardMaterial & { opacityNode?: unknown; colorNode?: unknown };

describe('domain-warp-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(domainWarpMorphPrimitive).dispose();
  });

  it('plays: bell-shaped morph — clean entry, peak smear mid, clean exit', () => {
    const target = makeTarget(domainWarpMorphPrimitive);
    const inst = domainWarpMorphPrimitive.create(target);
    const panel = target.subject as Mesh;

    // The panel's material is swapped for a TSL node material whose
    // opacityNode eats/restores alpha along the warped-noise threshold.
    expect((panel.material as NodeMat).opacityNode).toBeTruthy();
    expect((panel.material as NodeMat).colorNode).toBeTruthy();

    const h = handlesOf(target);
    const dur = inst.duration();
    const header = panel.getObjectByName('card-header') as Mesh;
    const headerMat = header.material as MeshStandardMaterial;

    // t = 0: entry is clean — no morph, chrome fully present.
    inst.seek(0);
    expect(h.uMorph.value).toBeLessThan(0.05);
    expect(headerMat.opacity).toBeGreaterThan(0.95);

    // t = dur/2: peak morph — the warp envelope saturates, the chrome melts
    // away with the dissolving surface, and the flow clock has advanced.
    inst.seek(dur * 0.5);
    expect(h.uMorph.value).toBeGreaterThan(0.9);
    expect(headerMat.opacity).toBeLessThan(0.3);
    expect(h.uFlowT.value).toBeGreaterThan(0.5);

    // t = dur: the card re-forms — morph back to 0, chrome restored.
    inst.seek(dur);
    expect(h.uMorph.value).toBeLessThan(0.05);
    expect(headerMat.opacity).toBeGreaterThan(0.95);

    inst.dispose();
  });

  it('holds peak morph at the t=1s controls-gate pause (default duration)', () => {
    const target = makeTarget(domainWarpMorphPrimitive);
    const inst = domainWarpMorphPrimitive.create(target);
    const h = handlesOf(target);
    // The harness CONTROLS gate pauses at t=1s; with the default duration the
    // bell envelope must be saturated there so warp-strength changes are
    // dramatically visible.
    inst.seek(1.0);
    expect(h.uMorph.value).toBeGreaterThan(0.9);
    inst.dispose();
  });

  it('controls change output: warp strength, octaves, and flow speed flow to uniforms', () => {
    const target = makeTarget(domainWarpMorphPrimitive);
    const inst = domainWarpMorphPrimitive.create(target);
    const h = handlesOf(target);

    inst.setControl('warpStrength', 0);
    inst.seek(1.0);
    const warpMin = h.uWarp.value;
    inst.setControl('warpStrength', 2);
    inst.seek(1.0);
    const warpMax = h.uWarp.value;
    expect(warpMax).toBeGreaterThan(warpMin + 1.5);

    inst.setControl('octaves', 3);
    inst.seek(1.0);
    const octLow = h.uOctaves.value;
    inst.setControl('octaves', 5);
    inst.seek(1.0);
    const octHigh = h.uOctaves.value;
    expect(octHigh).toBeGreaterThan(octLow + 1.5);

    inst.setControl('flowSpeed', 0.5);
    inst.seek(1.0);
    const flowSlow = h.uFlowT.value;
    inst.setControl('flowSpeed', 3);
    inst.seek(1.0);
    const flowFast = h.uFlowT.value;
    expect(flowFast).toBeGreaterThan(flowSlow + 1);

    inst.dispose();
  });

  it('late texture pour: rebinds to the source map by reference on the next seek', () => {
    const target = makeTarget(domainWarpMorphPrimitive);
    const panel = target.subject as Mesh;
    const orig = panel.material as MeshStandardMaterial;
    const inst = domainWarpMorphPrimitive.create(target);
    const h = handlesOf(target);

    // The catalog card subject has no texture map — the fallback gradient path.
    expect(h.sampledMap()).toBeNull();
    const matA = panel.material as NodeMat;

    // Simulate the mounted-artifact texture pour landing AFTER attach: the
    // source material (which we replaced on the mesh) receives its .map.
    const poured = new Texture();
    orig.map = poured;
    inst.seek(0.2);

    // The primitive must detect the identity change and rebuild its node
    // material to sample the poured texture — shared by REFERENCE.
    expect(h.sampledMap()).toBe(poured);
    const matB = panel.material as NodeMat;
    expect(matB).not.toBe(matA);
    expect(matB.opacityNode).toBeTruthy();

    inst.dispose();
    // The original source material (now carrying its map) is restored intact.
    expect(panel.material).toBe(orig);
    expect(orig.map).toBe(poured);
    poured.dispose();
  });

  it('external material swap: re-mounts on the new source and dispose restores IT', () => {
    const target = makeTarget(domainWarpMorphPrimitive);
    const panel = target.subject as Mesh;
    const inst = domainWarpMorphPrimitive.create(target);

    // Simulate applyImageSpec swapping the artifact's material wholesale
    // (overwriting our node material) after attach.
    const fresh = new MeshStandardMaterial();
    const freshMap = new Texture();
    fresh.map = freshMap;
    panel.material = fresh;

    inst.seek(0.3);
    // Re-detected: our node material is back on the mesh, built from `fresh`.
    const live = panel.material as NodeMat;
    expect(live).not.toBe(fresh);
    expect(live.opacityNode).toBeTruthy();
    expect(handlesOf(target).sampledMap()).toBe(freshMap);

    inst.dispose();
    // dispose restores the LATEST source — the swapped-in material, untouched.
    expect(panel.material).toBe(fresh);
    expect(fresh.opacity).toBe(1);
    freshMap.dispose();
    fresh.dispose();
  });

  it('dispose restores material identity, chrome opacity, and transparent flags', () => {
    const target = makeTarget(domainWarpMorphPrimitive);
    const panel = target.subject as Mesh;
    const orig = panel.material;

    // Snapshot every chrome descendant material before create.
    const before: Array<{ mat: MeshStandardMaterial; opacity: number; transparent: boolean }> = [];
    panel.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || m === panel || !m.material) return;
      const mat = m.material as MeshStandardMaterial;
      before.push({ mat, opacity: mat.opacity, transparent: mat.transparent });
    });
    expect(before.length).toBeGreaterThan(2); // header + dot + rows

    const inst = domainWarpMorphPrimitive.create(target);
    inst.seek(inst.duration() * 0.5); // chrome melted mid-morph
    expect(before[0].mat.opacity).toBeLessThan(0.3);

    inst.dispose();
    expect(panel.material).toBe(orig);
    for (const snap of before) {
      expect(snap.mat.opacity).toBe(snap.opacity);
      expect(snap.mat.transparent).toBe(snap.transparent);
    }
  });
});
