import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import type { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { waterDropletPrimitive } from '@/lib/prism/animatable/primitives/water-droplet';
import { makeTarget, runConformance } from './_conformance';

type Uni = { value: number };
type WaterDropletScratch = { uTime: Uni; uWobble: Uni; uFreq: Uni };

describe('water-droplet primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(waterDropletPrimitive).dispose();
  });

  it('plays: surface-tension time uniform advances across the timeline', () => {
    const target = makeTarget(waterDropletPrimitive);
    const inst = waterDropletPrimitive.create(target);
    const scratch = target.userData.waterDroplet as WaterDropletScratch;

    // Looping primitive (duration Infinity) — pick two distinct t values.
    inst.seek(0);
    const tEarly = scratch.uTime.value;

    inst.seek(1.5);
    const tMid = scratch.uTime.value;

    // The wobble clock visibly advances, so the displaced skin differs frame-to-frame.
    expect(tMid).toBeGreaterThan(tEarly + 1);
    inst.dispose();
  });

  it('controls change output: wobble amplitude + ior respond to extremes', () => {
    const target = makeTarget(waterDropletPrimitive);
    const inst = waterDropletPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as MeshPhysicalNodeMaterial;
    const scratch = target.userData.waterDroplet as WaterDropletScratch;

    // Wobble drives the displacement-amplitude uniform.
    inst.setControl('wobble', 0);
    inst.seek(0.5);
    const lowWobble = scratch.uWobble.value;

    inst.setControl('wobble', 0.1);
    inst.seek(0.5);
    const highWobble = scratch.uWobble.value;

    expect(highWobble).toBeGreaterThan(lowWobble + 0.05);

    // IOR drives the transmissive material scalar (water 1.33 .. 1.5 range).
    inst.setControl('ior', 1.2);
    inst.seek(0.5);
    const lowIor = mat.ior;

    inst.setControl('ior', 1.5);
    inst.seek(0.5);
    const highIor = mat.ior;

    expect(highIor).toBeGreaterThan(lowIor + 0.2);
    inst.dispose();
  });
});
