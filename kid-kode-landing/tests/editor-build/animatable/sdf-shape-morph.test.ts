import { describe, it, expect } from 'vitest';
import {
  Mesh,
  MeshStandardMaterial,
  Scene,
  Texture,
  Color,
  type Material,
} from 'three';
import { sdfShapeMorphPrimitive } from '@/lib/prism/animatable/primitives/sdf-shape-morph';
import { buildSubject } from '@/lib/prism/animatable/subjects';
import { makeTarget, runConformance } from './_conformance';

type UniformHandle = { value: number };
interface MorphWeights {
  rect: UniformHandle;
  circle: UniformHandle;
  hex: UniformHandle;
}

const weightsOf = (ud: Record<string, unknown>): MorphWeights =>
  ud.sdfMorphWeights as MorphWeights;

describe('sdf-shape-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(sdfShapeMorphPrimitive).dispose();
  });

  it('plays: shape weights cycle rect -> circle -> hex -> rect over the loop', () => {
    const target = makeTarget(sdfShapeMorphPrimitive);
    const panel = target.subject as Mesh;
    const orig = panel.material;
    const inst = sdfShapeMorphPrimitive.create(target);

    // The mask material replaced the panel's own (and is transparent so the
    // morphing silhouette actually cuts the surface).
    expect(panel.material).not.toBe(orig);
    expect((panel.material as Material).transparent).toBe(true);

    const w = weightsOf(target.userData);
    const speed = inst.getParams().speed as number;
    const k = inst.getParams().smoothness as number;
    const hold = 1 - k;

    // t=0: pure rounded-rect silhouette.
    inst.seek(0);
    expect(w.rect.value).toBeCloseTo(1, 5);
    expect(w.circle.value).toBeCloseTo(0, 5);
    expect(w.hex.value).toBeCloseTo(0, 5);

    // Mid-transition of segment 0 (f = hold + k/2): the smoothstep blend is
    // exactly 0.5 -> an even rect/circle smooth-mix.
    inst.seek((hold + k / 2) / speed);
    expect(w.rect.value).toBeCloseTo(0.5, 3);
    expect(w.circle.value).toBeCloseTo(0.5, 3);
    expect(w.hex.value).toBeCloseTo(0, 5);

    // Segment 2 start: pure hexagon.
    inst.seek(2 / speed);
    expect(w.hex.value).toBeCloseTo(1, 5);
    expect(w.rect.value).toBeCloseTo(0, 5);

    // Full cycle wraps back to the rect.
    inst.seek(3 / speed);
    expect(w.rect.value).toBeCloseTo(1, 5);
    expect(w.hex.value).toBeCloseTo(0, 5);

    inst.dispose();
  });

  it('controls change output live (paused at t=1, no re-seek needed)', () => {
    const target = makeTarget(sdfShapeMorphPrimitive);
    const inst = sdfShapeMorphPrimitive.create(target);
    const w = weightsOf(target.userData);

    inst.seek(1);
    // At defaults (speed 0.75, 3-shape tour) t=1s sits mid rect->circle morph:
    // no hexagon contribution yet.
    expect(w.hex.value).toBeLessThan(0.1);

    // Speed min->max re-phases the cycle immediately while paused (this is the
    // CONTROLS-gate semantics: the visual must respond without another seek).
    inst.setControl('speed', 2.5);
    expect(w.hex.value).toBeGreaterThan(0.5);

    // Shape-set dropdown swaps the sequence: circle-hex starts on the circle.
    inst.setControl('speed', 0.75);
    inst.setControl('shapes', 'circle-hex');
    inst.seek(0);
    expect(w.circle.value).toBeCloseTo(1, 5);
    expect(w.rect.value).toBeCloseTo(0, 5);

    // Edge softness and size drive their live uniforms.
    const soft = target.userData.sdfMorphSoftness as UniformHandle;
    const size = target.userData.sdfMorphSize as UniformHandle;
    inst.setControl('softness', 0.15);
    expect(soft.value).toBeCloseTo(0.15, 5);
    inst.setControl('softness', 0.002);
    expect(soft.value).toBeCloseTo(0.002, 5);
    inst.setControl('size', 1.1);
    expect(size.value).toBeCloseTo(1.1, 5);

    inst.dispose();
  });

  it('carries the subject look: shares the live map by reference and rebinds on async pours', () => {
    const target = makeTarget(sdfShapeMorphPrimitive);
    const panel = target.subject as Mesh;
    const orig = panel.material as MeshStandardMaterial;
    const inst = sdfShapeMorphPrimitive.create(target);

    // The swapped mask material adopts the panel's own color, never an
    // invented fill; with no map yet, map stays null.
    const live = panel.material as MeshStandardMaterial;
    expect(live).not.toBe(orig);
    expect(live.color.getHexString()).toBe(orig.color.getHexString());
    expect(live.map ?? null).toBe(orig.map ?? null);

    // Async texture pour onto the ORIGINAL artifact material after attach:
    // the next seek must rebind the SAME Texture instance (shared, not cloned).
    const tex = new Texture();
    orig.map = tex;
    inst.seek(0.25);
    expect((panel.material as MeshStandardMaterial).map).toBe(tex);

    // Host swaps in a brand-new material instance mid-flight: the next seek
    // adopts its look + map and re-takes the mask slot.
    const repour = new MeshStandardMaterial({ color: new Color('#aabbcc') });
    const tex2 = new Texture();
    repour.map = tex2;
    panel.material = repour;
    inst.seek(0.5);
    const relive = panel.material as MeshStandardMaterial;
    expect(relive).toBe(live);
    expect(relive.map).toBe(tex2);
    expect(relive.color.getHexString()).toBe('aabbcc');

    // dispose restores the LATEST source material (the repoured one) and never
    // disposes the subject's shared textures.
    inst.dispose();
    expect(panel.material).toBe(repour);
    expect(repour.map).toBe(tex2);

    tex.dispose();
    tex2.dispose();
  });

  it('handles a Group subject: every descendant mesh is masked and restored', () => {
    const scene = new Scene();
    const { object, subject } = buildSubject('text');
    scene.add(object);
    const target = { object, subject, scene, userData: {} as Record<string, unknown> };

    const meshes: Mesh[] = [];
    subject!.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    expect(meshes.length).toBeGreaterThan(1);
    const origs = meshes.map((m) => m.material as Material);

    const inst = sdfShapeMorphPrimitive.create(target);
    meshes.forEach((m, i) => expect(m.material).not.toBe(origs[i]));
    inst.seek(0.5);
    inst.dispose();
    meshes.forEach((m, i) => expect(m.material).toBe(origs[i]));
  });

  it('dispose restores the material and clears every userData stash', () => {
    const target = makeTarget(sdfShapeMorphPrimitive);
    const panel = target.subject as Mesh;
    const orig = panel.material;
    const inst = sdfShapeMorphPrimitive.create(target);

    inst.seek(1.2);
    inst.dispose();

    expect(panel.material).toBe(orig);
    expect(target.userData.sdfMorphWeights).toBeUndefined();
    expect(target.userData.sdfMorphSoftness).toBeUndefined();
    expect(target.userData.sdfMorphSize).toBeUndefined();
  });
});
