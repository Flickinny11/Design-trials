import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { rainPrimitive } from '@/lib/prism/animatable/primitives/rain';
import { makeTarget, runConformance } from './_conformance';

/** Find the built THREE.Points and return its position attribute. */
function posAttrOf(object: { traverse: (cb: (o: unknown) => void) => void }): BufferAttribute {
  let attr: BufferAttribute | null = null;
  object.traverse((o) => {
    if (o instanceof Points) {
      attr = o.geometry.getAttribute('position') as BufferAttribute;
    }
  });
  if (!attr) throw new Error('rain did not build a THREE.Points');
  return attr;
}

describe('rain primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(rainPrimitive).dispose();
  });

  it('plays: a particle y changes across seek (looping fall)', () => {
    const target = makeTarget(rainPrimitive);
    const inst = rainPrimitive.create(target);
    const attr = posAttrOf(target.object);

    inst.seek(0);
    const y0 = attr.getY(0);

    // A distinct mid-timeline frame (looping primitive: pick two distinct t).
    inst.seek(0.37);
    const yMid = attr.getY(0);

    expect(Math.abs(yMid - y0)).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('controls change output: more wind means more horizontal shear', () => {
    const target = makeTarget(rainPrimitive);
    const inst = rainPrimitive.create(target);
    const attr = posAttrOf(target.object);

    // Same drop, same time, two wind extremes → different x (the shear term
    // x = baseX + wind*(TOP - y) scales with wind).
    inst.setControl('wind', 0);
    inst.seek(0.5);
    const xNoWind = attr.getX(0);

    inst.setControl('wind', 0.8);
    inst.seek(0.5);
    const xWind = attr.getX(0);

    expect(Math.abs(xWind - xNoWind)).toBeGreaterThan(0.05);
    inst.dispose();
  });
});
