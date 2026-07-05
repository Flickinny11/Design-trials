import { describe, it, expect } from 'vitest';
import { Color, Mesh, MeshStandardMaterial, Texture, type Material } from 'three';
import { silhouetteGlowMorphPrimitive } from '@/lib/prism/animatable/primitives/silhouette-glow-morph';
import { makeTarget, runConformance } from './_conformance';

type UniformLike = { value: number };
interface GlowHandle {
  uFill: UniformLike;
  uGlow: UniformLike;
  uEdgeW: UniformLike;
  rebuilds: number;
  hasMap: boolean;
}
type FadableMat = Material & { opacity: number };

const handleOf = (ud: Record<string, unknown>): GlowHandle =>
  ud.silhouetteGlow as GlowHandle;

/** First decorative chrome material under the panel (header bar etc.). */
function firstChromeMat(panel: Mesh): FadableMat {
  let found: FadableMat | null = null;
  panel.traverse((o) => {
    if (found) return;
    const m = o as Mesh;
    if (m.isMesh && m !== panel && m.material) {
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      found = mat as FadableMat;
    }
  });
  if (!found) throw new Error('card subject has no chrome children');
  return found;
}

describe('silhouette-glow-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(silhouetteGlowMorphPrimitive).dispose();
  });

  it('plays: fill drains to a glowing outline at the hold beat and refills by the end', () => {
    const target = makeTarget(silhouetteGlowMorphPrimitive);
    const inst = silhouetteGlowMorphPrimitive.create(target);
    const handle = handleOf(target.userData);
    const panel = target.subject as Mesh;
    const chrome = firstChromeMat(panel);
    const chromeBase = chrome.opacity;
    const dur = inst.duration();

    // t=0 — full fill, no glow, chrome at base opacity (card looks untouched).
    inst.seek(0);
    expect(handle.uFill.value).toBeGreaterThan(0.95);
    expect(handle.uGlow.value).toBeLessThan(0.05);
    expect(chrome.opacity).toBeGreaterThan(chromeBase - 0.05);

    // mid-collapse — fill partially drained, glow clearly risen.
    inst.seek(dur * 0.2);
    expect(handle.uFill.value).toBeLessThan(0.9);
    expect(handle.uFill.value).toBeGreaterThan(0.05);
    expect(handle.uGlow.value).toBeGreaterThan(0.05);

    // hold midpoint (default hold straddles dur/2) — outline only: fill gone,
    // glow at/above full (living pulse may push it slightly past 1), chrome out.
    inst.seek(dur / 2);
    expect(handle.uFill.value).toBeLessThan(0.01);
    expect(handle.uGlow.value).toBeGreaterThan(0.85);
    expect(chrome.opacity).toBeLessThan(0.01);

    // end — refilled with itself, glow extinguished, chrome restored.
    inst.seek(dur);
    expect(handle.uFill.value).toBeGreaterThan(0.95);
    expect(handle.uGlow.value).toBeLessThan(0.05);
    expect(chrome.opacity).toBeGreaterThan(chromeBase - 0.05);

    // the swapped-in mask material carries opacity + emissive nodes.
    const mat = panel.material as { opacityNode?: unknown; emissiveNode?: unknown };
    expect(mat.opacityNode).toBeTruthy();
    expect(mat.emissiveNode).toBeTruthy();
    inst.dispose();
  });

  it('controls change output: hold length and edge width respond at t=1s', () => {
    const target = makeTarget(silhouetteGlowMorphPrimitive);
    const inst = silhouetteGlowMorphPrimitive.create(target);
    const handle = handleOf(target.userData);

    // hold min -> max: with no hold t=1s sits mid-collapse (fill > 0); with max
    // hold the collapse compresses and t=1s lands inside the outline beat.
    inst.setControl('hold', 0);
    inst.seek(1.0);
    const fillNoHold = handle.uFill.value;
    inst.setControl('hold', 2);
    inst.seek(1.0);
    const fillMaxHold = handle.uFill.value;
    expect(fillMaxHold).toBeLessThan(fillNoHold - 0.1);

    // edge width min -> max flows into the live uniform.
    inst.setControl('edgeWidth', 0.01);
    inst.seek(1.0);
    expect(handle.uEdgeW.value).toBeCloseTo(0.01, 4);
    inst.setControl('edgeWidth', 0.12);
    inst.seek(1.0);
    expect(handle.uEdgeW.value).toBeCloseTo(0.12, 4);
    inst.dispose();
  });

  it('late texture pour: rebuilds the mask material to sample the live map', () => {
    const target = makeTarget(silhouetteGlowMorphPrimitive);
    const panel = target.subject as Mesh;
    const srcMat = panel.material as MeshStandardMaterial; // pre-swap source
    const inst = silhouetteGlowMorphPrimitive.create(target);
    const handle = handleOf(target.userData);

    // catalog card panel ships map-less.
    expect(handle.hasMap).toBe(false);
    const matBefore = panel.material;

    // simulate the mounted-artifact async pour: the displaced SOURCE material
    // receives .map after the primitive attached.
    const poured = new Texture();
    srcMat.map = poured;
    inst.seek(0.5);

    expect(handle.rebuilds).toBeGreaterThanOrEqual(1);
    expect(handle.hasMap).toBe(true);
    expect(panel.material).not.toBe(matBefore); // fresh node material bound to the map
    // stable thereafter — same map identity must not re-trigger rebuilds.
    const count = handle.rebuilds;
    inst.seek(0.6);
    expect(handle.rebuilds).toBe(count);

    inst.dispose();
    expect(panel.material).toBe(srcMat);
    poured.dispose();
  });

  it('external material swap: re-captures the new source and re-applies the mask', () => {
    const target = makeTarget(silhouetteGlowMorphPrimitive);
    const panel = target.subject as Mesh;
    const inst = silhouetteGlowMorphPrimitive.create(target);
    const ours = panel.material;

    // applyImageSpec-style swap: something replaces the mesh material outright.
    const newSrc = new MeshStandardMaterial({ color: new Color('#6b6f78') });
    panel.material = newSrc;
    inst.seek(1.2);

    expect(panel.material).not.toBe(newSrc); // mask re-applied over the new source
    expect(panel.material).not.toBe(ours); // rebuilt, not the stale instance
    expect((panel.material as { opacityNode?: unknown }).opacityNode).toBeTruthy();

    inst.dispose();
    expect(panel.material).toBe(newSrc); // restores the LATEST source, not the stale one
    newSrc.dispose();
  });

  it('dispose restores the subject material and every chrome opacity/transparent flag', () => {
    const target = makeTarget(silhouetteGlowMorphPrimitive);
    const panel = target.subject as Mesh;
    const prevMat = panel.material;
    const snaps: Array<{ m: FadableMat; o: number; t: boolean }> = [];
    panel.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || m === panel || !m.material) return;
      const list = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of list) {
        snaps.push({ m: mat as FadableMat, o: (mat as FadableMat).opacity, t: mat.transparent });
      }
    });
    expect(snaps.length).toBeGreaterThan(0);

    const inst = silhouetteGlowMorphPrimitive.create(target);
    inst.seek(inst.duration() / 2); // chrome fully faded here
    inst.dispose();

    expect(panel.material).toBe(prevMat);
    for (const s of snaps) {
      expect(s.m.opacity).toBeCloseTo(s.o, 5);
      expect(s.m.transparent).toBe(s.t);
    }
  });
});
