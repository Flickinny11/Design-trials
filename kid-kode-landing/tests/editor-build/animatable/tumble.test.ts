import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { tumblePrimitive } from '@/lib/prism/animatable/primitives/tumble';
import { makeTarget, runConformance } from './_conformance';

describe('tumble primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(tumblePrimitive).dispose();
  });

  it('plays: dual-axis rotation eases to upright while scale + opacity rise', () => {
    const target = makeTarget(tumblePrimitive);
    const inst = tumblePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const rotX0 = mesh.rotation.x;
    const rotY0 = mesh.rotation.y;
    const scale0 = mesh.scale.x;
    const op0 = mat.opacity;

    // mid-phase: both axes still rotating, and (with distinct spin counts)
    // rotation.x must differ from rotation.y.
    inst.seek(dur * 0.4);
    const rotXMid = mesh.rotation.x;
    const rotYMid = mesh.rotation.y;
    expect(Math.abs(rotXMid - rotYMid)).toBeGreaterThan(0.1);

    inst.seek(dur);
    const rotXEnd = mesh.rotation.x;
    const rotYEnd = mesh.rotation.y;
    const scaleEnd = mesh.scale.x;
    const opEnd = mat.opacity;

    // both axes start far from upright and settle to ~0
    expect(Math.abs(rotX0)).toBeGreaterThan(Math.abs(rotXEnd) + 0.5);
    expect(Math.abs(rotY0)).toBeGreaterThan(Math.abs(rotYEnd) + 0.5);
    // scale rises 0.5 -> ~1
    expect(scaleEnd).toBeGreaterThan(scale0 + 0.2);
    // opacity rises across the eased phase
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger spinX means larger initial X rotation', () => {
    const target = makeTarget(tumblePrimitive);
    const inst = tumblePrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('spinX', 0);
    inst.seek(0);
    const small = Math.abs(mesh.rotation.x);

    inst.setControl('spinX', 2);
    inst.seek(0);
    const large = Math.abs(mesh.rotation.x);

    expect(large).toBeGreaterThan(small + 1);
    inst.dispose();
  });
});
