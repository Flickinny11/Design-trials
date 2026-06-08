import { describe, it, expect } from 'vitest';
import { Mesh, type Material, type Object3D } from 'three';
import { textFadeUpEachPrimitive } from '@/lib/prism/animatable/primitives/text-fade-up-each';
import { makeTarget, runConformance } from './_conformance';

function firstGlyph(root: Object3D): Object3D {
  return root.children.length > 0 ? root.children[0] : root;
}
function lastGlyph(root: Object3D): Object3D {
  return root.children.length > 0 ? root.children[root.children.length - 1] : root;
}
function opacityOf(o: Object3D): number {
  const m = (o as Mesh).material as Material & { opacity: number };
  return m.opacity;
}

describe('text-fade-up-each primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textFadeUpEachPrimitive).dispose();
  });

  it('plays: glyph opacity rises and position.y drifts up over time', () => {
    const target = makeTarget(textFadeUpEachPrimitive);
    const inst = textFadeUpEachPrimitive.create(target);
    const root = target.subject as Object3D;
    const g0 = firstGlyph(root);
    const baseY = g0.position.y;
    const dur = inst.duration();

    inst.seek(0);
    const op0 = opacityOf(g0);
    const y0 = g0.position.y;

    inst.seek(dur);
    const opEnd = opacityOf(g0);
    const yEnd = g0.position.y;

    // opacity climbs from near-hidden to settled
    expect(opEnd).toBeGreaterThan(op0 + 0.3);
    // glyph starts below baseline and drifts up to it
    expect(y0).toBeLessThan(baseY - 0.05);
    expect(yEnd).toBeCloseTo(baseY, 5);
    expect(yEnd).toBeGreaterThan(y0 + 0.05);
    inst.dispose();
  });

  it('plays in sequence: first glyph leads the last (staggered)', () => {
    const target = makeTarget(textFadeUpEachPrimitive);
    const inst = textFadeUpEachPrimitive.create(target);
    const root = target.subject as Object3D;
    const g0 = firstGlyph(root);
    const gN = lastGlyph(root);
    const dur = inst.duration();

    // Mid-timeline: the leading glyph is further along than the trailing one.
    inst.seek(dur * 0.3);
    expect(opacityOf(g0)).toBeGreaterThan(opacityOf(gN));
    inst.dispose();
  });

  it('controls change output: larger rise means lower initial position.y', () => {
    const target = makeTarget(textFadeUpEachPrimitive);
    const inst = textFadeUpEachPrimitive.create(target);
    const root = target.subject as Object3D;
    const g0 = firstGlyph(root);
    const baseY = g0.position.y;

    inst.setControl('rise', 0.1);
    inst.seek(0);
    const ySmall = g0.position.y;

    inst.setControl('rise', 1);
    inst.seek(0);
    const yLarge = g0.position.y;

    // Larger rise pushes the start further below baseline.
    expect(baseY - yLarge).toBeGreaterThan(baseY - ySmall + 0.3);
    inst.dispose();
  });
});
