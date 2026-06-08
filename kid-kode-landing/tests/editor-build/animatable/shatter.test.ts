import { describe, it, expect } from 'vitest';
import { Mesh, BufferAttribute, type Material } from 'three';
import { shatterPrimitive } from '@/lib/prism/animatable/primitives/shatter';
import { makeTarget, runConformance } from './_conformance';

describe('shatter primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(shatterPrimitive).dispose();
  });

  it('plays: vertex displacement grows and opacity fades across the timeline', () => {
    const target = makeTarget(shatterPrimitive);
    const inst = shatterPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    // Capture pristine base for a representative vertex (avoid the exact center,
    // whose cell-pivot displacement can be near-zero).
    const idx = 5;
    inst.seek(0);
    const bx = pos.getX(idx);
    const by = pos.getY(idx);
    const bz = pos.getZ(idx);
    const op0 = mat.opacity;

    inst.seek(dur);
    const dispEnd = Math.hypot(
      pos.getX(idx) - bx,
      pos.getY(idx) - by,
      pos.getZ(idx) - bz,
    );
    const opEnd = mat.opacity;

    // A mid frame sits between rest and the settled end.
    inst.seek(dur * 0.5);
    const dispMid = Math.hypot(
      pos.getX(idx) - bx,
      pos.getY(idx) - by,
      pos.getZ(idx) - bz,
    );

    // Displacement grows from ~0 (rest) through mid to the larger end value.
    expect(dispMid).toBeGreaterThan(0.05);
    expect(dispEnd).toBeGreaterThan(dispMid + 0.05);
    // Opacity fades 1 -> 0.
    expect(op0).toBeGreaterThan(0.9);
    expect(opEnd).toBeLessThan(op0 - 0.5);

    inst.dispose();
    // dispose restores base positions.
    expect(pos.getX(idx)).toBeCloseTo(bx, 5);
    expect(pos.getY(idx)).toBeCloseTo(by, 5);
  });

  it('controls change output: larger spread means larger displacement', () => {
    const target = makeTarget(shatterPrimitive);
    const inst = shatterPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
    const dur = inst.duration();

    const idx = 5;
    inst.seek(0);
    const bx = pos.getX(idx);
    const by = pos.getY(idx);
    const bz = pos.getZ(idx);

    inst.setControl('spread', 0.2);
    inst.seek(dur);
    const small = Math.hypot(pos.getX(idx) - bx, pos.getY(idx) - by, pos.getZ(idx) - bz);

    inst.setControl('spread', 4);
    inst.seek(dur);
    const large = Math.hypot(pos.getX(idx) - bx, pos.getY(idx) - by, pos.getZ(idx) - bz);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
