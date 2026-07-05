import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { zoomBlurPrimitive } from '@/lib/prism/animatable/primitives/zoom-blur';
import { makeTarget, runConformance } from './_conformance';

describe('zoom-blur primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(zoomBlurPrimitive).dispose();
  });

  it('plays: scale shrinks to 1 while opacity rises', () => {
    const target = makeTarget(zoomBlurPrimitive);
    const inst = zoomBlurPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const scale0 = mesh.scale.x;
    const op0 = mat.opacity;

    inst.seek(dur);
    const scaleDur = mesh.scale.x;
    const opDur = mat.opacity;

    // starts oversized (>1), ends settled at ~1
    expect(scale0).toBeGreaterThan(scaleDur + 0.3);
    expect(scaleDur).toBeCloseTo(1, 1);
    // opacity rises from the out-of-focus haze to crisp focus
    expect(opDur).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger startScale means larger initial scale', () => {
    const target = makeTarget(zoomBlurPrimitive);
    const inst = zoomBlurPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('startScale', 1.2);
    inst.seek(0);
    const small = mesh.scale.x;

    inst.setControl('startScale', 2.5);
    inst.seek(0);
    const large = mesh.scale.x;

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
