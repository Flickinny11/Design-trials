import { describe, it, expect } from 'vitest';
import { Mesh, type Material, type Object3D } from 'three';
import { typewriterPrimitive } from '@/lib/prism/animatable/primitives/typewriter';
import { makeTarget, runConformance } from './_conformance';

/** Count glyphs whose (first) material opacity is > 0.5. */
function visibleCount(root: Object3D): number {
  let n = 0;
  for (const g of root.children) {
    const m = (g as Mesh).material as Material & { opacity: number } | undefined;
    if (m && m.opacity > 0.5) n++;
  }
  return n;
}

describe('typewriter primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(typewriterPrimitive).dispose();
  });

  it('plays: count of visible glyphs grows from start to end', () => {
    const target = makeTarget(typewriterPrimitive);
    const inst = typewriterPrimitive.create(target);
    // No cursor pulse — keep the count assertion deterministic on the reveal.
    inst.setControl('cursor', false);
    const root = target.subject as Object3D;
    const dur = inst.duration();

    inst.seek(0);
    const early = visibleCount(root);

    inst.seek(dur * 0.5);
    const mid = visibleCount(root);

    inst.seek(dur);
    const end = visibleCount(root);

    // Glyphs reveal in sequence: more are visible later than at the start.
    expect(mid).toBeGreaterThan(early);
    expect(end).toBeGreaterThan(mid);
    // At the settled end, every glyph is shown.
    expect(end).toBe(root.children.length);
    inst.dispose();
  });

  it('controls change output: smaller stagger reveals more glyphs sooner', () => {
    const target = makeTarget(typewriterPrimitive);
    const inst = typewriterPrimitive.create(target);
    inst.setControl('cursor', false);
    const root = target.subject as Object3D;
    const dur = inst.duration();
    const probe = dur * 0.6;

    // Wide per-glyph window (slow ramp) => each glyph fades up gradually, so a
    // glyph that has only just begun is still below the 0.5 visibility cut.
    inst.setControl('stagger', 1);
    inst.seek(probe);
    const wide = visibleCount(root);

    // Snap reveals (negligible ease window) => every glyph whose start time has
    // passed is fully on, so more clear the 0.5 cut at the same instant.
    inst.setControl('stagger', 0);
    inst.seek(probe);
    const snap = visibleCount(root);

    expect(snap).toBeGreaterThan(wide);
    inst.dispose();
  });
});
