import { describe, it, expect } from 'vitest';
import { Group, Mesh, type Material } from 'three';
import { textCascadePrimitive } from '@/lib/prism/animatable/primitives/text-cascade';
import { makeTarget, runConformance } from './_conformance';

function glyphY(target: ReturnType<typeof makeTarget>, i: number): number {
  const root = target.subject as Group;
  return root.children[i].position.y;
}

function glyphOpacity(target: ReturnType<typeof makeTarget>, i: number): number {
  const root = target.subject as Group;
  const mesh = root.children[i] as Mesh;
  return (mesh.material as Material & { opacity: number }).opacity;
}

describe('text-cascade primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textCascadePrimitive).dispose();
  });

  it('plays: a glyph drops from above to its base and fades in', () => {
    const target = makeTarget(textCascadePrimitive);
    const inst = textCascadePrimitive.create(target);
    const dur = inst.duration();
    const root = target.subject as Group;
    expect(root.children.length).toBeGreaterThan(1);

    // first glyph (i=0) starts its drop immediately
    inst.seek(0);
    const yEarly = glyphY(target, 0);
    const opEarly = glyphOpacity(target, 0);

    inst.seek(dur);
    const ySettled = glyphY(target, 0);
    const opSettled = glyphOpacity(target, 0);

    // glyph starts elevated (base + dropHeight) and settles to base
    expect(yEarly).toBeGreaterThan(ySettled + 0.3);
    // opacity rises from start to settled
    expect(opSettled).toBeGreaterThan(opEarly);

    // staggered sequence: at a mid frame, an early glyph has fallen further
    // (lower y) than a later glyph that hasn't started yet.
    inst.seek(dur * 0.35);
    const last = root.children.length - 1;
    expect(glyphY(target, 0)).toBeLessThan(glyphY(target, last) + 1e-6);

    inst.dispose();
    // dispose restores all glyphs to base + full opacity
    expect(glyphOpacity(target, 0)).toBe(1);
  });

  it('controls change output: larger dropHeight means a higher start position', () => {
    const target = makeTarget(textCascadePrimitive);
    const inst = textCascadePrimitive.create(target);

    inst.setControl('dropHeight', 0.2);
    inst.seek(0);
    const small = glyphY(target, 0);

    inst.setControl('dropHeight', 3);
    inst.seek(0);
    const large = glyphY(target, 0);

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
