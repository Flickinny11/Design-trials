import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { metallicSheenPrimitive } from '@/lib/prism/animatable/primitives/metallic-sheen';
import { makeTarget, runConformance } from './_conformance';

type SheenUniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uWidth: { value: number };
  uBright: { value: number };
};

function sheenOf(target: ReturnType<typeof makeTarget>): SheenUniforms {
  const mesh = target.subject as Mesh;
  const mat = mesh.material as unknown as { userData: { sheen: SheenUniforms } };
  return mat.userData.sheen;
}

describe('metallic-sheen primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(metallicSheenPrimitive).dispose();
  });

  it('plays: the time uniform advances and drives the raking band position', () => {
    const target = makeTarget(metallicSheenPrimitive);
    const inst = metallicSheenPrimitive.create(target);
    const u = sheenOf(target);

    inst.seek(0);
    const t0 = u.uTime.value;
    // band line position at t0 (mirrors the TSL: fract(time*speed*0.25))
    const speed = u.uSpeed.value;
    const pos0 = (t0 * speed * 0.25) % 1;

    inst.seek(1.7);
    const tMid = u.uTime.value;
    const posMid = (tMid * speed * 0.25) % 1;

    // looping (Infinity duration): the time uniform advanced...
    expect(tMid).toBeGreaterThan(t0);
    // ...and the derived raking-line position moved.
    expect(Math.abs(posMid - pos0)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: width and brightness uniforms respond to setControl', () => {
    const target = makeTarget(metallicSheenPrimitive);
    const inst = metallicSheenPrimitive.create(target);
    const u = sheenOf(target);

    inst.setControl('width', 0.02);
    inst.seek(0.5);
    const narrow = u.uWidth.value;

    inst.setControl('width', 0.4);
    inst.seek(0.5);
    const wide = u.uWidth.value;

    expect(wide).toBeGreaterThan(narrow + 0.1);

    inst.setControl('brightness', 0);
    inst.seek(0.5);
    const dim = u.uBright.value;

    inst.setControl('brightness', 3);
    inst.seek(0.5);
    const bright = u.uBright.value;

    expect(bright).toBeGreaterThan(dim + 1);
    inst.dispose();
  });
});
