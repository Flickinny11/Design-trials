import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { unfoldPrimitive } from '@/lib/prism/animatable/primitives/unfold';
import { makeTarget, runConformance } from './_conformance';

describe('unfold primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(unfoldPrimitive).dispose();
  });

  it('plays: scale.x overshoots >1 mid-phase, wobble damps, opacity rises', () => {
    const target = makeTarget(unfoldPrimitive);
    const inst = unfoldPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const sx0 = mesh.scale.x;
    const op0 = mat.opacity;

    // Mid/late phase where backOut overshoots past 1 (peak near t/dur ~0.7).
    inst.seek(dur * 0.7);
    const sxMid = mesh.scale.x;
    const rotMid = Math.abs(mesh.rotation.y);

    inst.seek(dur);
    const sxEnd = mesh.scale.x;
    const opEnd = mat.opacity;
    const rotEnd = Math.abs(mesh.rotation.y);

    // starts narrow, overshoots past full width mid-phase
    expect(sx0).toBeLessThan(0.2);
    expect(sxMid).toBeGreaterThan(1.0);
    // settles back to ~full width
    expect(sxEnd).toBeGreaterThan(0.95);
    expect(sxEnd).toBeLessThan(1.05);
    // mid frame distinct from both start and end
    expect(sxMid).toBeGreaterThan(sx0 + 0.3);
    // wobble damps out toward the end
    expect(rotEnd).toBeLessThan(rotMid);
    // opacity rises
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger wobble means larger mid-phase rotation', () => {
    const target = makeTarget(unfoldPrimitive);
    const inst = unfoldPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.setControl('wobble', 0.0);
    inst.seek(dur * 0.25);
    const small = Math.abs(mesh.rotation.y);

    inst.setControl('wobble', 0.4);
    inst.seek(dur * 0.25);
    const large = Math.abs(mesh.rotation.y);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
