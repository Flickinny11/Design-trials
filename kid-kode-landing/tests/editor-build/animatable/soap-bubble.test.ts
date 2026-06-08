import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { soapBubblePrimitive } from '@/lib/prism/animatable/primitives/soap-bubble';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };

describe('soap-bubble primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(soapBubblePrimitive).dispose();
  });

  it('plays: the film time uniform advances and the sphere tumbles across the timeline', () => {
    const target = makeTarget(soapBubblePrimitive);
    const inst = soapBubblePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const { uTime } = target.userData.soapBubble as { uTime: Uniform };

    inst.seek(0);
    const time0 = uTime.value;
    const rot0 = mesh.rotation.y;

    inst.seek(2.5);
    const timeMid = uTime.value;
    const rotMid = mesh.rotation.y;

    // The driven film-shift time uniform advances with the master clock.
    expect(timeMid).toBeGreaterThan(time0 + 1);
    // The bubble visibly tumbles (CPU-observable rotation).
    expect(Math.abs(rotMid - rot0)).toBeGreaterThan(0.3);
    inst.dispose();
  });

  it('controls change output: wobble extremes drive different uniform values', () => {
    const target = makeTarget(soapBubblePrimitive);
    const inst = soapBubblePrimitive.create(target);
    const { uWobble } = target.userData.soapBubble as { uWobble: Uniform };

    inst.setControl('wobble', 0);
    inst.seek(1);
    const low = uWobble.value;

    inst.setControl('wobble', 0.08);
    inst.seek(1);
    const high = uWobble.value;

    expect(high).toBeGreaterThan(low + 0.05);
    inst.dispose();
  });
});
