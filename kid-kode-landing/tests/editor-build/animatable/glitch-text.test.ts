import { describe, it, expect } from 'vitest';
import { Group, Mesh, type Material } from 'three';
import { glitchTextPrimitive } from '@/lib/prism/animatable/primitives/glitch-text';
import { makeTarget, runConformance } from './_conformance';

/** Sum of |offset from base| across glyph children, plus base capture. */
function captureBases(root: Group): Map<Mesh, { x: number; y: number }> {
  const m = new Map<Mesh, { x: number; y: number }>();
  root.children.forEach((c) => {
    const mesh = c as Mesh;
    if (mesh.isMesh) m.set(mesh, { x: mesh.position.x, y: mesh.position.y });
  });
  return m;
}

function totalOffset(bases: Map<Mesh, { x: number; y: number }>): number {
  let sum = 0;
  bases.forEach((base, mesh) => {
    sum += Math.hypot(mesh.position.x - base.x, mesh.position.y - base.y);
  });
  return sum;
}

describe('glitch-text primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(glitchTextPrimitive).dispose();
  });

  it('plays: glyph jitter is larger in an early frame than a settled late frame', () => {
    const target = makeTarget(glitchTextPrimitive);
    const inst = glitchTextPrimitive.create(target);
    const root = target.subject as Group;
    const bases = captureBases(root);
    const dur = inst.duration();

    // Early frame: full amplitude, glyphs jump off base.
    inst.seek(0.001);
    const early = totalOffset(bases);

    // Late frame: amplitude decays to ~0, glyphs lock to base layout.
    inst.seek(dur);
    const late = totalOffset(bases);

    expect(early).toBeGreaterThan(0.01);
    expect(early).toBeGreaterThan(late + 0.005);
    expect(late).toBeLessThan(1e-6); // locks clean at phase 1

    inst.dispose();
  });

  it('controls change output: higher intensity means larger early jitter', () => {
    const target = makeTarget(glitchTextPrimitive);
    const inst = glitchTextPrimitive.create(target);
    const root = target.subject as Group;
    const bases = captureBases(root);

    inst.setControl('intensity', 0.05);
    inst.seek(0.001);
    const small = totalOffset(bases);

    inst.setControl('intensity', 1);
    inst.seek(0.001);
    const large = totalOffset(bases);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });

  it('dispose restores glyph children to base layout and material', () => {
    const target = makeTarget(glitchTextPrimitive);
    const inst = glitchTextPrimitive.create(target);
    const root = target.subject as Group;
    const bases = captureBases(root);

    inst.seek(0.001);
    inst.dispose();

    expect(totalOffset(bases)).toBeLessThan(1e-9);
    root.children.forEach((c) => {
      const mat = (c as Mesh).material as Material & { opacity?: number };
      if (typeof mat.opacity === 'number') expect(mat.opacity).toBeCloseTo(1, 5);
    });
  });
});
