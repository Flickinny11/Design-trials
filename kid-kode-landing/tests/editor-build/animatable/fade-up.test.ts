import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { fadeUpPrimitive } from '@/lib/prism/animatable/primitives/fade-up';
import { makeTarget, runConformance } from './_conformance';

describe('fade-up primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadeUpPrimitive).dispose();
  });

  it('plays: opacity rises and position.y drifts upward into place', () => {
    const target = makeTarget(fadeUpPrimitive);
    const inst = fadeUpPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const y0 = mesh.position.y;
    const op0 = mat.opacity;

    inst.seek(dur);
    const yDur = mesh.position.y;
    const opDur = mat.opacity;

    // opacity rises across the eased phase (0 -> 1)
    expect(opDur).toBeGreaterThan(op0 + 0.3);
    // position.y increases (drifts up) from start (-rise) to settled (0)
    expect(yDur).toBeGreaterThan(y0 + 0.3);
    inst.dispose();
  });

  it('controls change output: larger rise means a lower starting position.y', () => {
    const target = makeTarget(fadeUpPrimitive);
    const inst = fadeUpPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('rise', 0.2);
    inst.seek(0);
    const small = mesh.position.y;

    inst.setControl('rise', 3);
    inst.seek(0);
    const large = mesh.position.y;

    // bigger rise => starts further below the settled position
    expect(small).toBeGreaterThan(large + 0.3);
    inst.dispose();
  });
});
