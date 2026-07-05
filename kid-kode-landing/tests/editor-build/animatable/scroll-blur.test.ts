import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { scrollBlurPrimitive } from '@/lib/prism/animatable/primitives/scroll-blur';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-blur primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollBlurPrimitive).dispose();
  });

  it('plays: scale shrinks and opacity rises as scroll reaches the focal point', () => {
    const target = makeTarget(scrollBlurPrimitive);
    // Focal point at 0.5, modest width so 0.5 is sharp and 0.0 is defocused.
    const inst = scrollBlurPrimitive.create(target, { focal: 0.5, width: 0.2, overscale: 0.3, minOpacity: 0.1 });
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };

    // Far from focus (scroll=0): defocused — overscaled and low opacity.
    target.userData.scroll = 0;
    inst.seek(0);
    const scaleBlur = mesh.scale.x;
    const opBlur = mat.opacity;

    // At focus (scroll=0.5): sharp — scale ~1 and opacity ~1.
    target.userData.scroll = 0.5;
    inst.seek(0);
    const scaleSharp = mesh.scale.x;
    const opSharp = mat.opacity;

    // Defocused frame is visibly larger and dimmer than the focused frame.
    expect(scaleBlur).toBeGreaterThan(scaleSharp + 0.05);
    expect(opSharp).toBeGreaterThan(opBlur + 0.3);
    inst.dispose();
  });

  it('controls change output: larger defocus scale means larger blur overscale', () => {
    const target = makeTarget(scrollBlurPrimitive);
    const inst = scrollBlurPrimitive.create(target, { focal: 0.5, width: 0.2 });
    const mesh = target.subject as Mesh;

    // Stay fully defocused (scroll far from focal) so overscale dominates.
    target.userData.scroll = 0;

    inst.setControl('overscale', 0);
    inst.seek(0);
    const small = mesh.scale.x;

    inst.setControl('overscale', 0.4);
    inst.seek(0);
    const large = mesh.scale.x;

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
