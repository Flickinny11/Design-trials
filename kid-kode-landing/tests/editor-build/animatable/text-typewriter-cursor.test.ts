import { describe, it, expect } from 'vitest';
import { Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { textTypewriterCursorPrimitive } from '@/lib/prism/animatable/primitives/text-typewriter-cursor';
import { makeTarget, runConformance } from './_conformance';

/** Count glyph children whose (first) material opacity is ~1 (typed/opaque). */
function opaqueCount(root: Object3D): number {
  let n = 0;
  for (const g of root.children) {
    const m = (g as Mesh).material as Material & { opacity: number };
    if (m && m.opacity > 0.95) n++;
  }
  return n;
}

/** Sum emissiveIntensity across a glyph's standard materials. */
function emissiveSum(obj: Object3D): number {
  let s = 0;
  obj.traverse((o) => {
    const m = (o as Mesh).material;
    if (m instanceof MeshStandardMaterial) s += m.emissiveIntensity;
  });
  return s;
}

describe('text-typewriter-cursor primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(textTypewriterCursorPrimitive).dispose();
  });

  it('plays: opaque glyph count grows from early to late frame', () => {
    const target = makeTarget(textTypewriterCursorPrimitive);
    const inst = textTypewriterCursorPrimitive.create(target);
    const root = target.subject as Object3D;
    const dur = inst.duration();

    inst.seek(0);
    const early = opaqueCount(root);

    inst.seek(dur * 0.9);
    const late = opaqueCount(root);

    // More glyphs are revealed (typed) by the late frame than at the start.
    expect(late).toBeGreaterThan(early);
    inst.dispose();
  });

  it('controls change output: blinkRate alters the cursor blink phase', () => {
    const target = makeTarget(textTypewriterCursorPrimitive);
    const inst = textTypewriterCursorPrimitive.create(target);
    const root = target.subject as Object3D;
    const dur = inst.duration();

    // Sample mid-typing so a cursor head exists. Pick t where sign(sin(t*rate))
    // differs between the two rates: t=0.5s.
    //   slow blinkRate=2 -> sin(1.0) > 0  -> blink high
    //   fast blinkRate=10 -> sin(5.0) < 0 -> blink low
    const t = clampMid(dur);

    inst.setControl('blinkRate', 2);
    inst.seek(t);
    const slowSum = totalEmissive(root);

    inst.setControl('blinkRate', 10);
    inst.seek(t);
    const fastSum = totalEmissive(root);

    // The cursor's emissive flash differs between the two blink rates at this t.
    expect(Math.abs(slowSum - fastSum)).toBeGreaterThan(0.5);
    inst.dispose();
  });
});

function totalEmissive(root: Object3D): number {
  let s = 0;
  for (const g of root.children) s += emissiveSum(g);
  return s;
}

function clampMid(dur: number): number {
  // 0.5s lands within a 1.8s default typewriter timeline (mid-typing).
  return Math.min(0.5, dur * 0.4);
}
