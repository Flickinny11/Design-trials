import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { focusRackPrimitive } from '@/lib/prism/animatable/primitives/focus-rack';
import { makeTarget, runConformance } from './_conformance';

describe('focus-rack primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(focusRackPrimitive).dispose();
  });

  it('plays: scale shrinks, opacity rises, and a bloom spike fires at the snap', () => {
    const target = makeTarget(focusRackPrimitive);
    const inst = focusRackPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number; emissiveIntensity: number };
    const dur = inst.duration();

    inst.seek(0);
    const scale0 = mesh.scale.x;
    const op0 = mat.opacity;

    inst.seek(dur);
    const scaleEnd = mesh.scale.x;
    const opEnd = mat.opacity;

    // Bokeh swell at the start; settles back toward base by the end.
    expect(scale0).toBeGreaterThan(scaleEnd + 0.05);
    // Opacity (confidence) rises as focus resolves.
    expect(opEnd).toBeGreaterThan(op0 + 0.1);

    // Emissive bloom spike near phase ~0.8 exceeds both the start and the end.
    inst.seek(dur * 0.8);
    const emSnap = mat.emissiveIntensity;
    inst.seek(0);
    const emStart = mat.emissiveIntensity;
    inst.seek(dur);
    const emEnd = mat.emissiveIntensity;
    expect(emSnap).toBeGreaterThan(emStart + 0.05);
    expect(emSnap).toBeGreaterThan(emEnd + 0.05);

    inst.dispose();
  });

  it('controls change output: larger overscale means larger bokeh swell', () => {
    const target = makeTarget(focusRackPrimitive);
    const inst = focusRackPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Early in the timeline b > 0, so overscale drives the scale directly.
    inst.setControl('overscale', 0);
    inst.seek(0);
    const small = mesh.scale.x;

    inst.setControl('overscale', 0.5);
    inst.seek(0);
    const large = mesh.scale.x;

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
