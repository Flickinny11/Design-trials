import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { stretchTextPrimitive } from '@/lib/prism/animatable/primitives/stretch-text';
import { makeTarget, runConformance } from './_conformance';

describe('stretch-text primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(stretchTextPrimitive).dispose();
  });

  it('plays: a glyph squashes from tall (scale.y high) to natural at the end', () => {
    const target = makeTarget(stretchTextPrimitive);
    const inst = stretchTextPrimitive.create(target);
    const glyph = (target.subject as Object3D).children[0];
    const dur = inst.duration();

    inst.seek(0);
    const syEarly = glyph.scale.y;

    inst.seek(dur);
    const syLate = glyph.scale.y;

    // Springs from a tall initial scale.y down toward natural (~1).
    expect(syEarly).toBeGreaterThan(syLate + 0.3);
    expect(syLate).toBeCloseTo(1, 1);
    inst.dispose();
  });

  it('staggers: at a fixed mid-time, the first and last glyph differ in scale.y', () => {
    const target = makeTarget(stretchTextPrimitive);
    const inst = stretchTextPrimitive.create(target);
    const children = (target.subject as Object3D).children;
    const first = children[0];
    const last = children[children.length - 1];
    const dur = inst.duration();

    inst.setControl('stagger', 1);
    inst.seek(dur * 0.4);
    // Earlier glyph has settled further than the later one at the same instant.
    expect(Math.abs(first.scale.y - last.scale.y)).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('controls change output: larger stretch means a taller initial scale.y', () => {
    const target = makeTarget(stretchTextPrimitive);
    const inst = stretchTextPrimitive.create(target);
    const glyph = (target.subject as Object3D).children[0];

    inst.setControl('stretch', 1.5);
    inst.seek(0);
    const small = glyph.scale.y;

    inst.setControl('stretch', 3);
    inst.seek(0);
    const large = glyph.scale.y;

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
