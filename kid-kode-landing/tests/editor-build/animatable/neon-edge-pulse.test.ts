import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { neonEdgePulsePrimitive } from '@/lib/prism/animatable/primitives/neon-edge-pulse';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
type Handles = {
  uTime: Uniform;
  uSpeed: Uniform;
  uThickness: Uniform;
  uBaseGlow: Uniform;
  uPulseGlow: Uniform;
};

/** CPU mirror of the shader pulse: 0.5 + 0.5*sin(uTime*speed). */
const pulseAt = (h: Handles) => 0.5 + 0.5 * Math.sin(h.uTime.value * h.uSpeed.value);

describe('neon-edge-pulse primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(neonEdgePulsePrimitive).dispose();
  });

  it('plays: the time uniform advances and the pulse value changes across the loop', () => {
    const target = makeTarget(neonEdgePulsePrimitive);
    const inst = neonEdgePulsePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const h = target.userData.neonEdgePulse as Handles;

    // Looping primitive → duration Infinity; pick distinct sample times.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const time0 = h.uTime.value;
    const pulse0 = pulseAt(h);

    // Mid frame: uTime advances and the pulse differs from the start.
    inst.seek(0.5);
    const timeMid = h.uTime.value;
    const pulseMid = pulseAt(h);

    // Later frame: a third distinct sample.
    inst.seek(1.3);
    const pulseLate = pulseAt(h);

    // Concrete numeric change on the uniform's .value.
    expect(timeMid).toBeGreaterThan(time0);
    // Visible motion: mid-frame pulse differs from t=0, and from a later frame.
    expect(Math.abs(pulseMid - pulse0)).toBeGreaterThan(0.05);
    expect(Math.abs(pulseLate - pulseMid)).toBeGreaterThan(0.05);

    // The swapped material carries an emissiveNode (the neon border).
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeTruthy();
    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { emissiveNode?: unknown }).emissiveNode).toBeFalsy();
  });

  it('controls: thickness extremes drive the live uniform to different values', () => {
    const target = makeTarget(neonEdgePulsePrimitive);
    const inst = neonEdgePulsePrimitive.create(target);
    const h = target.userData.neonEdgePulse as Handles;

    inst.setControl('thickness', 0.02);
    inst.seek(0.2);
    const thin = h.uThickness.value;

    inst.setControl('thickness', 0.2);
    inst.seek(0.2);
    const thick = h.uThickness.value;

    expect(inst.getParams().thickness).toBe(0.2);
    expect(thick).toBeGreaterThan(thin + 0.1);
    inst.dispose();
  });
});
