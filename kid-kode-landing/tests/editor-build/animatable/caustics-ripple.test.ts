import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { causticsRipplePrimitive } from '@/lib/prism/animatable/primitives/caustics-ripple';
import { makeTarget, runConformance } from './_conformance';

// The swapped node material carries uniform handles whose `.value` is
// CPU-observable (no renderer needed). The primitive stashes them on
// target.userData (shared scratch space) so we can assert on the driven state.
type Uni = { value: number };
type RippleUniforms = { uTime: Uni; uRingFreq: Uni; uScale: Uni; uSpeed: Uni };

function uniforms(target: { userData: Record<string, unknown> }): RippleUniforms {
  return target.userData.causticsRippleUniforms as RippleUniforms;
}

describe('caustics-ripple primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(causticsRipplePrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline (looping)', () => {
    const target = makeTarget(causticsRipplePrimitive);
    const inst = causticsRipplePrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Looping/stateful primitive: duration is Infinity, motion lives in uTime.
    expect(inst.duration()).toBe(Infinity);

    // The node material is swapped in (GPU path wired).
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeTruthy();

    const u = uniforms(target);
    inst.seek(0);
    const early = u.uTime.value;

    inst.seek(2.5);
    const mid = u.uTime.value;

    // A mid-animation frame differs from t=0 — concrete numeric motion.
    expect(mid).not.toBe(early);
    expect(mid).toBeGreaterThan(early);
    expect(mid).toBeCloseTo(2.5, 5);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { colorNode?: unknown }).colorNode).toBeFalsy();
  });

  it('controls change output: ringFreq extremes drive a different uniform value', () => {
    const target = makeTarget(causticsRipplePrimitive);
    const inst = causticsRipplePrimitive.create(target);
    const u = uniforms(target);

    inst.setControl('ringFreq', 1);
    inst.seek(0);
    const low = u.uRingFreq.value;

    inst.setControl('ringFreq', 40);
    inst.seek(0);
    const high = u.uRingFreq.value;

    expect(low).toBe(1);
    expect(high).toBe(40);
    expect(high).toBeGreaterThan(low + 10);

    inst.dispose();
  });
});
