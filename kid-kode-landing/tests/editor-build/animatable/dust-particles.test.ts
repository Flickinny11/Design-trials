import { describe, it, expect } from 'vitest';
import { Points, BufferAttribute } from 'three';
import { dustParticlesPrimitive } from '@/lib/prism/animatable/primitives/dust-particles';
import { makeTarget, runConformance } from './_conformance';

function findPoints(obj: { children: unknown[] }): Points | null {
  for (const child of obj.children) {
    if (child instanceof Points) return child;
  }
  return null;
}

describe('dust-particles primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dustParticlesPrimitive).dispose();
  });

  it('plays: point 0 drifts in Y from t=0 to t=1', () => {
    const target = makeTarget(dustParticlesPrimitive);
    const inst = dustParticlesPrimitive.create(target);
    const points = findPoints(target.object as unknown as { children: unknown[] });
    expect(points).not.toBeNull();
    const posAttr = points!.geometry.getAttribute('position') as BufferAttribute;

    inst.seek(0);
    const y0 = posAttr.getY(0);
    inst.seek(1);
    const y1 = posAttr.getY(0);

    expect(y1).not.toBe(y0);
    inst.dispose();
  });

  it('controls change output: drift scales the horizontal sway of point 0', () => {
    const target = makeTarget(dustParticlesPrimitive);
    const inst = dustParticlesPrimitive.create(target);
    const points = findPoints(target.object as unknown as { children: unknown[] });
    const posAttr = points!.geometry.getAttribute('position') as BufferAttribute;

    inst.setControl('drift', 0);
    inst.seek(1);
    const xNoDrift = posAttr.getX(0);

    inst.setControl('drift', 1);
    inst.seek(1);
    const xFullDrift = posAttr.getX(0);

    expect(xFullDrift).not.toBe(xNoDrift);
    inst.dispose();
  });

  it('dispose: removes the Points from target.object', () => {
    const target = makeTarget(dustParticlesPrimitive);
    const inst = dustParticlesPrimitive.create(target);
    expect(findPoints(target.object as unknown as { children: unknown[] })).not.toBeNull();
    inst.dispose();
    expect(findPoints(target.object as unknown as { children: unknown[] })).toBeNull();
  });
});
