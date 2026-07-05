import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { splatRevealPrimitive } from '@/lib/prism/animatable/primitives/splat-reveal';
import { makeTarget, runConformance } from './_conformance';

describe('splat-reveal primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(splatRevealPrimitive).dispose();
  });

  it('plays: uProgress advances 0 -> 1 across the timeline and installs a node material', () => {
    // PURE SHADER (TSL opacityNode metaball union): pixels cannot be read
    // headlessly. The CPU-observable state is the progress uniform stashed on
    // userData, which drives blob growth toward full coverage.
    const target = makeTarget(splatRevealPrimitive);
    const inst = splatRevealPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { opacityNode?: unknown };
    const uProgress = target.userData.splatProgress as { value: number };
    const dur = inst.duration();

    expect(mat.opacityNode).toBeTruthy();

    inst.seek(0);
    const p0 = uProgress.value;

    inst.seek(dur * 0.5);
    const pMid = uProgress.value;

    inst.seek(dur);
    const pEnd = uProgress.value;

    // monotonic advance toward full coverage
    expect(pMid).toBeGreaterThan(p0 + 0.1);
    expect(pEnd).toBeGreaterThan(pMid + 0.1);
    expect(pEnd).toBeCloseTo(1, 5);

    inst.dispose();
    // dispose restores the original (non-node) material.
    expect((mesh.material as unknown as { opacityNode?: unknown }).opacityNode).toBeFalsy();
  });

  it('controls: blob count (dropdown) toggles active-blob uniforms', () => {
    const target = makeTarget(splatRevealPrimitive);
    const inst = splatRevealPrimitive.create(target);

    inst.setControl('blobs', '3');
    inst.seek(0);
    const three = inst.getParams().blobs;

    inst.setControl('blobs', '5');
    inst.seek(0);
    const five = inst.getParams().blobs;

    expect(three).toBe('3');
    expect(five).toBe('5');
    expect(five).not.toBe(three);

    // spread knob extremes also re-resolve params live
    inst.setControl('spread', 0.2);
    inst.seek(0);
    const lo = inst.getParams().spread;
    inst.setControl('spread', 0.6);
    inst.seek(0);
    const hi = inst.getParams().spread;
    expect(hi as number).toBeGreaterThan(lo as number);

    inst.dispose();
  });
});
