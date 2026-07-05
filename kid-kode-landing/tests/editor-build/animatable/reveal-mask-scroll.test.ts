import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { revealMaskScrollPrimitive } from '@/lib/prism/animatable/primitives/reveal-mask-scroll';
import { makeTarget, runConformance } from './_conformance';

describe('reveal-mask-scroll primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(revealMaskScrollPrimitive).dispose();
  });

  it('plays: scale grows and opacity rises as scroll crosses the window', () => {
    const target = makeTarget(revealMaskScrollPrimitive);
    const inst = revealMaskScrollPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };

    // Below the start of the reveal window: clipped sliver, transparent.
    target.userData.scroll = 0;
    inst.seek(0);
    const scaleEarly = mesh.scale.y;
    const opEarly = mat.opacity;

    // Past the end of the window: full scale, fully opaque.
    target.userData.scroll = 1;
    inst.seek(0);
    const scaleLate = mesh.scale.y;
    const opLate = mat.opacity;

    expect(scaleLate).toBeGreaterThan(scaleEarly + 0.3);
    expect(opLate).toBeGreaterThan(opEarly + 0.3);
    inst.dispose();
  });

  it('controls change output: the chosen axis scales (x vs y)', () => {
    const target = makeTarget(revealMaskScrollPrimitive);
    const inst = revealMaskScrollPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Mid-window scroll so the reveal is partway (sliver < scale < full).
    target.userData.scroll = 0;

    inst.setControl('axis', 'x');
    inst.seek(0);
    const xScaleClipped = mesh.scale.x;
    const yScaleWhenX = mesh.scale.y;

    inst.setControl('axis', 'y');
    inst.seek(0);
    const yScaleClipped = mesh.scale.y;
    const xScaleWhenY = mesh.scale.x;

    // With axis=x the X axis is the clipped one (y stays at base ~1);
    // with axis=y the Y axis is the clipped one (x stays at base ~1).
    expect(xScaleClipped).toBeLessThan(yScaleWhenX - 0.3);
    expect(yScaleClipped).toBeLessThan(xScaleWhenY - 0.3);
    inst.dispose();
  });
});
