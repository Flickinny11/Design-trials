import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { holoGlassPrimitive } from '@/lib/prism/animatable/primitives/holo-glass';
import { makeTarget, runConformance } from './_conformance';

// Read the holo-glass material's live time uniform (CPU-observable state).
function timeValue(mesh: Mesh): number {
  const mat = mesh.material as unknown as { emissiveNode: unknown };
  // The uniform is closed over in the primitive; we observe via rotation +
  // uniform value indirectly. The primitive tracks uTime.value, which the
  // node-material chain references — but the simplest CPU-observable handle is
  // the panel rotation the primitive also drives in seek().
  void mat;
  return mesh.rotation.y;
}

describe('holo-glass primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(holoGlassPrimitive).dispose();
  });

  it('plays: the panel sheen drifts (rotation changes across the timeline)', () => {
    const target = makeTarget(holoGlassPrimitive);
    const inst = holoGlassPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.seek(0);
    const early = timeValue(mesh);

    inst.seek(1.2);
    const mid = timeValue(mesh);

    inst.seek(3.0);
    const late = timeValue(mesh);

    // A mid-animation frame differs from t=0 ...
    expect(Math.abs(mid - early)).toBeGreaterThan(0.01);
    // ... and from a later frame (continuous, looping motion).
    expect(Math.abs(late - mid)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: sheen extremes resolve to distinct params', () => {
    const target = makeTarget(holoGlassPrimitive);
    const inst = holoGlassPrimitive.create(target);

    inst.setControl('sheen', 0);
    inst.seek(0.5);
    const low = inst.getParams().sheen as number;

    inst.setControl('sheen', 1);
    inst.seek(0.5);
    const high = inst.getParams().sheen as number;

    expect(high).toBeGreaterThan(low + 0.5);

    // bands knob (numeric) likewise routes through to resolved params.
    inst.setControl('bands', 1);
    const bandsLow = inst.getParams().bands as number;
    inst.setControl('bands', 6);
    const bandsHigh = inst.getParams().bands as number;
    expect(bandsHigh).toBeGreaterThan(bandsLow + 1);

    inst.dispose();
  });
});
