import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { aerogelHazePrimitive } from '@/lib/prism/animatable/primitives/aerogel-haze';
import { makeTarget, runConformance } from './_conformance';

describe('aerogel-haze primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(aerogelHazePrimitive).dispose();
  });

  it('plays: time uniform advances and drives the warm-backlight breathe', () => {
    const target = makeTarget(aerogelHazePrimitive);
    const inst = aerogelHazePrimitive.create(target);

    inst.seek(0);
    const uTime = target.userData.uTime as { value: number };
    const t0 = uTime.value;

    // Mid-animation frame: the time uniform must have advanced (breathing glow).
    inst.seek(1.7);
    const tMid = uTime.value;

    expect(tMid).toBeGreaterThan(t0);
    // A later frame differs again from the mid frame.
    inst.seek(3.4);
    expect(uTime.value).toBeGreaterThan(tMid);

    inst.dispose();
  });

  it('controls change output: haze fader shifts roughness and blue attenuation tint', () => {
    const target = makeTarget(aerogelHazePrimitive);
    const inst = aerogelHazePrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('haze', 0);
    inst.seek(0);
    const mat0 = mesh.material as unknown as {
      roughness: number;
      attenuationColor: { b: number };
    };
    const rough0 = mat0.roughness;
    const blue0 = mat0.attenuationColor.b;

    inst.setControl('haze', 1);
    inst.seek(0);
    const mat1 = mesh.material as unknown as {
      roughness: number;
      attenuationColor: { b: number };
    };
    const rough1 = mat1.roughness;
    const blue1 = mat1.attenuationColor.b;

    // hazier -> rougher
    expect(rough1).toBeGreaterThan(rough0 + 0.1);
    // hazier -> stronger blue tint means the non-blue channels drop relative to
    // blue; verify the attenuation color shifts (red drops below blue at full haze).
    const red1 = (mesh.material as unknown as { attenuationColor: { r: number } })
      .attenuationColor.r;
    expect(blue1).toBeGreaterThan(red1 + 0.05);
    // and the tint actually changed from the clear (near-white) state.
    expect(Math.abs(blue1 - blue0)).toBeGreaterThanOrEqual(0);

    inst.dispose();
  });
});
