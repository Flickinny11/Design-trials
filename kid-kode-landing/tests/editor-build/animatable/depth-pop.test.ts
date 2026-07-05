import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { depthPopPrimitive } from '@/lib/prism/animatable/primitives/depth-pop';
import { makeTarget, runConformance } from './_conformance';

describe('depth-pop primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(depthPopPrimitive).dispose();
  });

  it('plays: position.z rushes to 0 and scale grows while opacity rises', () => {
    const target = makeTarget(depthPopPrimitive);
    const inst = depthPopPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const z0 = mesh.position.z;
    const scale0 = mesh.scale.x;
    const op0 = mat.opacity;

    inst.seek(dur);
    const zDur = mesh.position.z;
    const scaleDur = mesh.scale.x;
    const opDur = mat.opacity;

    // starts deep in Z (far), ends at the resting plane (~0)
    expect(z0).toBeLessThan(zDur - 1);
    // scale grows as it nears (perspective approximation)
    expect(scaleDur).toBeGreaterThan(scale0 + 0.3);
    // opacity rises across the eased phase
    expect(opDur).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger depth means deeper initial Z', () => {
    const target = makeTarget(depthPopPrimitive);
    const inst = depthPopPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('depth', 3);
    inst.seek(0);
    const shallow = mesh.position.z;

    inst.setControl('depth', 14);
    inst.seek(0);
    const deep = mesh.position.z;

    // deeper depth pushes the start farther back (more negative Z)
    expect(deep).toBeLessThan(shallow - 1);
    inst.dispose();
  });
});
