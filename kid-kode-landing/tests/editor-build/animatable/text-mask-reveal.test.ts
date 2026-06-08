import { describe, it, expect } from 'vitest';
import { Mesh, type Material, type Object3D } from 'three';
import { textMaskRevealPrimitive } from '@/lib/prism/animatable/primitives/text-mask-reveal';
import { makeTarget, runConformance } from './_conformance';

/** Sum the opacity of every material under a subtree. */
function summedOpacity(root: Object3D): number {
  let sum = 0;
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) sum += (mat as Material & { opacity: number }).opacity;
    }
  });
  return sum;
}

describe('text-mask-reveal primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textMaskRevealPrimitive).dispose();
  });

  it('plays: a soft front reveals more glyphs as t advances', () => {
    const target = makeTarget(textMaskRevealPrimitive);
    const inst = textMaskRevealPrimitive.create(target);
    const root = target.subject as Object3D;
    const dur = inst.duration();

    inst.seek(0);
    const early = summedOpacity(root);

    inst.seek(dur * 0.5);
    const mid = summedOpacity(root);

    inst.seek(dur);
    const end = summedOpacity(root);

    // continuous reveal: total revealed opacity grows monotonically
    expect(mid).toBeGreaterThan(early + 0.5);
    expect(end).toBeGreaterThan(mid + 0.5);
    // at the start almost nothing is revealed; at the end the whole line is on
    expect(early).toBeLessThan(0.5);
    expect(end).toBeGreaterThan(root.children.length - 0.5);
    inst.dispose();
  });

  it('controls change output: direction flips which end reveals first', () => {
    const target = makeTarget(textMaskRevealPrimitive);
    const inst = textMaskRevealPrimitive.create(target);
    const root = target.subject as Object3D;
    const dur = inst.duration();
    const firstGlyph = root.children[0] as Mesh;
    const lastGlyph = root.children[root.children.length - 1] as Mesh;
    const opOf = (g: Mesh) => (g.material as Material & { opacity: number }).opacity;

    // ltr: the first (leftmost) glyph reveals before the last.
    inst.setControl('direction', 'ltr');
    inst.seek(dur * 0.3);
    const ltrFirst = opOf(firstGlyph);
    const ltrLast = opOf(lastGlyph);

    // rtl: the last (rightmost) glyph reveals before the first.
    inst.setControl('direction', 'rtl');
    inst.seek(dur * 0.3);
    const rtlFirst = opOf(firstGlyph);
    const rtlLast = opOf(lastGlyph);

    expect(ltrFirst).toBeGreaterThan(ltrLast + 0.2);
    expect(rtlLast).toBeGreaterThan(rtlFirst + 0.2);
    inst.dispose();
  });
});
