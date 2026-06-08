import { describe, it, expect } from 'vitest';
import { Mesh, type Material, type Object3D } from 'three';
import { decodeTextPrimitive } from '@/lib/prism/animatable/primitives/decode-text';
import { makeTarget, runConformance } from './_conformance';

type Mat = Material & { opacity: number };

function glyphRow(target: { subject: Object3D | null; object: Object3D }): Object3D[] {
  const root = target.subject ?? target.object;
  return root.children.length > 0 ? [...root.children] : [root];
}

/** Count glyphs at their locked base position (offset ~0) for phase p. */
function lockedCount(glyphs: Object3D[], bases: Array<{ x: number; y: number }>): number {
  let c = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const dx = glyphs[i].position.x - bases[i].x;
    const dy = glyphs[i].position.y - bases[i].y;
    if (Math.hypot(dx, dy) < 1e-6) c++;
  }
  return c;
}

describe('decode-text primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(decodeTextPrimitive).dispose();
  });

  it('plays: locked-glyph count grows left-to-right over time', () => {
    const target = makeTarget(decodeTextPrimitive);
    const glyphs = glyphRow(target);
    const bases = glyphs.map((g) => ({ x: g.position.x, y: g.position.y }));
    const inst = decodeTextPrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0.001);
    const earlyLocked = lockedCount(glyphs, bases);
    // Record a pre-reveal glyph's offset at an early frame (last glyph not yet revealed).
    const last = glyphs[glyphs.length - 1];
    inst.seek(dur * 0.1);
    const preOffset = Math.hypot(last.position.x - bases[bases.length - 1].x, last.position.y - bases[bases.length - 1].y);

    inst.seek(dur * 0.6);
    const midLocked = lockedCount(glyphs, bases);

    inst.seek(dur);
    const endLocked = lockedCount(glyphs, bases);
    const lockedOffset = Math.hypot(last.position.x - bases[bases.length - 1].x, last.position.y - bases[bases.length - 1].y);

    // More glyphs locked as time advances; all locked at the end.
    expect(midLocked).toBeGreaterThan(earlyLocked);
    expect(endLocked).toBe(glyphs.length);
    // A pre-reveal glyph's offset differs from its locked (zero) state.
    expect(preOffset).toBeGreaterThan(lockedOffset + 0.01);
    expect(lockedOffset).toBeLessThan(1e-6);
    inst.dispose();
  });

  it('controls change output: higher jitter intensity means larger pre-reveal offset', () => {
    const target = makeTarget(decodeTextPrimitive);
    const glyphs = glyphRow(target);
    const bases = glyphs.map((g) => ({ x: g.position.x, y: g.position.y }));
    const last = glyphs.length - 1;
    const inst = decodeTextPrimitive.create(target);
    const dur = inst.duration();

    inst.setControl('intensity', 0.04);
    inst.seek(dur * 0.05);
    const small = Math.hypot(glyphs[last].position.x - bases[last].x, glyphs[last].position.y - bases[last].y);

    inst.setControl('intensity', 1.2);
    inst.seek(dur * 0.05);
    const large = Math.hypot(glyphs[last].position.x - bases[last].x, glyphs[last].position.y - bases[last].y);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
