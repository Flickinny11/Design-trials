import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { textShakePrimitive } from '@/lib/prism/animatable/primitives/text-shake';
import { makeTarget, runConformance } from './_conformance';

describe('text-shake primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textShakePrimitive).dispose();
  });

  it('plays: a glyph position differs across two distinct t values', () => {
    const target = makeTarget(textShakePrimitive);
    const inst = textShakePrimitive.create(target);
    const root = target.subject as Object3D;
    const glyph = root.children[0];

    inst.seek(0);
    const x0 = glyph.position.x;
    const y0 = glyph.position.y;

    // Mid-loop frame at a distinct, non-trivial t.
    inst.seek(0.137);
    const x1 = glyph.position.x;
    const y1 = glyph.position.y;

    // Deterministic jitter must move the glyph between the two frames.
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: larger amplitude means larger displacement', () => {
    const target = makeTarget(textShakePrimitive);
    const inst = textShakePrimitive.create(target);
    const root = target.subject as Object3D;
    const glyph = root.children[1];
    const baseX = glyph.position.x;
    const baseY = glyph.position.y;
    const T = 0.21;

    inst.setControl('amplitude', 0.01);
    inst.seek(T);
    const small = Math.hypot(glyph.position.x - baseX, glyph.position.y - baseY);

    inst.setControl('amplitude', 0.2);
    inst.seek(T);
    const large = Math.hypot(glyph.position.x - baseX, glyph.position.y - baseY);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
