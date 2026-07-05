import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { dropBouncePrimitive } from '@/lib/prism/animatable/primitives/drop-bounce';
import { makeTarget, runConformance } from './_conformance';

describe('drop-bounce primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dropBouncePrimitive).dispose();
  });

  it('plays: position.y drops from above to ~0 while opacity rises and scale.y dips near landing', () => {
    const target = makeTarget(dropBouncePrimitive);
    const inst = dropBouncePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();
    const baseScaleY = mesh.scale.y;

    inst.seek(0);
    const y0 = mesh.position.y;
    const op0 = mat.opacity;

    // Sample scale.y across the landing portion of the timeline to find a dip.
    let minScaleY = baseScaleY;
    for (let i = 1; i <= 12; i++) {
      inst.seek((i / 12) * dur);
      if (mesh.position.y !== undefined) {
        minScaleY = Math.min(minScaleY, mesh.scale.y);
      }
    }

    inst.seek(dur);
    const yEnd = mesh.position.y;
    const opEnd = mat.opacity;

    // Starts high above origin, ends settled at ~origin.
    expect(y0).toBeGreaterThan(yEnd + 1);
    // Opacity rises across the entrance.
    expect(opEnd).toBeGreaterThan(op0);
    // scale.y dips below base at some point near a landing (squash).
    expect(minScaleY).toBeLessThan(baseScaleY - 0.001);
    inst.dispose();
  });

  it('controls change output: larger height means larger initial drop offset', () => {
    const target = makeTarget(dropBouncePrimitive);
    const inst = dropBouncePrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('height', 2);
    inst.seek(0);
    const small = mesh.position.y;

    inst.setControl('height', 10);
    inst.seek(0);
    const large = mesh.position.y;

    expect(large).toBeGreaterThan(small + 3);
    inst.dispose();
  });
});
