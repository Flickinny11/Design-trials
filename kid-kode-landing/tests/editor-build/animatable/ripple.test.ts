import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { ripplePrimitive } from '@/lib/prism/animatable/primitives/ripple';
import { makeTarget, runConformance } from './_conformance';

describe('ripple primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(ripplePrimitive).dispose();
  });

  it('plays: a vertex z displaces over time', () => {
    const target = makeTarget(ripplePrimitive);
    const inst = ripplePrimitive.create(target);
    const pos = (target.subject as Mesh).geometry.getAttribute(
      'position',
    ) as BufferAttribute;

    // Pick a vertex with non-zero radial distance so the wave is observable.
    let idx = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.hypot(pos.getX(i), pos.getY(i)) > 0.3) {
        idx = i;
        break;
      }
    }

    inst.seek(0);
    const z0 = pos.getZ(idx);
    inst.seek(0.5);
    const z1 = pos.getZ(idx);

    expect(Math.abs(z1 - z0)).toBeGreaterThan(0.005);
    inst.dispose();
  });

  it('controls change output: amplitude scales displacement', () => {
    const target = makeTarget(ripplePrimitive);
    const inst = ripplePrimitive.create(target);
    const pos = (target.subject as Mesh).geometry.getAttribute(
      'position',
    ) as BufferAttribute;

    let idx = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.hypot(pos.getX(i), pos.getY(i)) > 0.3) {
        idx = i;
        break;
      }
    }

    inst.setControl('amplitude', 0.4);
    inst.seek(0.25);
    const zBig = Math.abs(pos.getZ(idx));
    inst.dispose();

    inst.setControl('amplitude', 0.02);
    inst.seek(0.25);
    const zSmall = Math.abs(pos.getZ(idx));

    expect(zBig).toBeGreaterThan(zSmall);
    inst.dispose();
  });
});
