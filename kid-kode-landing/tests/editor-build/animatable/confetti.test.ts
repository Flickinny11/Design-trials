import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { confettiPrimitive } from '@/lib/prism/animatable/primitives/confetti';
import { makeTarget, runConformance } from './_conformance';

function findPoints(obj: { traverse: (cb: (o: unknown) => void) => void }): Points {
  let found: Points | null = null;
  obj.traverse((o) => {
    if ((o as Points).isPoints) found = o as Points;
  });
  if (!found) throw new Error('no Points built');
  return found;
}

describe('confetti primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(confettiPrimitive).dispose();
  });

  it('plays: a particle rises then is pulled down by gravity', () => {
    const target = makeTarget(confettiPrimitive);
    const inst = confettiPrimitive.create(target);
    const points = findPoints(target.object);
    const pos = points.geometry.getAttribute('position') as BufferAttribute;

    inst.seek(0);
    const y0 = pos.getY(0);

    // Early in the burst the particle has fluttered upward.
    inst.seek(0.4);
    const yEarly = pos.getY(0);

    // By the end of the burst gravity has pulled it back down below its peak.
    inst.seek(3);
    const yLate = pos.getY(0);

    expect(yEarly).toBeGreaterThan(y0 + 0.2); // rose off the origin
    expect(yLate).toBeLessThan(yEarly - 0.2); // then rained down
    inst.dispose();
  });

  it('controls change output: stronger gravity ends the particle lower', () => {
    const target = makeTarget(confettiPrimitive);
    const inst = confettiPrimitive.create(target);
    const points = findPoints(target.object);
    const pos = points.geometry.getAttribute('position') as BufferAttribute;

    inst.setControl('gravity', 0.5);
    inst.seek(3);
    const weak = pos.getY(0);

    inst.setControl('gravity', 8);
    inst.seek(3);
    const strong = pos.getY(0);

    expect(strong).toBeLessThan(weak - 0.3);
    inst.dispose();
  });
});
