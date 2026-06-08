import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { zoomOutInPrimitive } from '@/lib/prism/animatable/primitives/zoom-out-in';
import { makeTarget, runConformance } from './_conformance';

describe('zoom-out-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(zoomOutInPrimitive).dispose();
  });

  it('plays: scale shrinks from oversized toward 1, dips near/under 1, opacity rises', () => {
    const target = makeTarget(zoomOutInPrimitive);
    const inst = zoomOutInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const scale0 = mesh.scale.x;
    const op0 = mat.opacity;

    // Early frame: still well above rest as the zoom rushes inward.
    inst.seek(dur * 0.1);
    const scaleEarly = mesh.scale.x;

    // Sample late in the timeline to catch the sub-unity undershoot.
    inst.seek(dur * 0.85);
    const scaleLate = mesh.scale.x;

    inst.seek(dur);
    const scaleEnd = mesh.scale.x;
    const opEnd = mat.opacity;

    // Starts oversized (default startScale 3), decreases across the phase.
    expect(scale0).toBeGreaterThan(scaleEarly + 0.3);
    expect(scaleEarly).toBeGreaterThan(scaleEnd);
    // Undershoot: passes near/under rest before settling.
    expect(scaleLate).toBeLessThan(1);
    // Settles exactly at rest scale 1 at the end.
    expect(scaleEnd).toBeCloseTo(1, 3);
    // Opacity rises across the eased phase.
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger startScale means larger initial scale', () => {
    const target = makeTarget(zoomOutInPrimitive);
    const inst = zoomOutInPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('startScale', 1.5);
    inst.seek(0);
    const small = mesh.scale.x;

    inst.setControl('startScale', 5);
    inst.seek(0);
    const large = mesh.scale.x;

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
