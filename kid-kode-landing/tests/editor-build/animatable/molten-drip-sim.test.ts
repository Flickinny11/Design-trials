import { describe, it, expect } from 'vitest';
import { Matrix4, Vector3, Quaternion, type InstancedMesh } from 'three';
import { moltenDripSimPrimitive } from '@/lib/prism/animatable/primitives/molten-drip-sim';
import { makeTarget, runConformance } from './_conformance';

// Decode the live lobe positions/radii from the InstancedMesh the primitive
// builds into target.object (headless has no GPU, but the instance matrices are
// pure CPU state — the same state the renderer would draw).
function readLobes(mesh: InstancedMesh) {
  const m = new Matrix4();
  const pos = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  const out: { i: number; y: number; r: number }[] = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    m.decompose(pos, q, s);
    if (s.x < 1e-4) continue; // parked / hidden lobe
    out.push({ i, y: pos.y, r: s.x });
  }
  return out;
}

function findMesh(target: ReturnType<typeof makeTarget>): InstancedMesh {
  const mesh = target.object.children.find((c) => c.name === 'molten-drip-sim');
  if (!mesh) throw new Error('molten-drip-sim mesh not found');
  return mesh as InstancedMesh;
}

describe('molten-drip-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(moltenDripSimPrimitive).dispose();
  });

  it('drips: a droplet pinches off and free-falls well below the column (a real physical event, not a stretch)', () => {
    const target = makeTarget(moltenDripSimPrimitive);
    const inst = moltenDripSimPrimitive.create(target);
    const mesh = findMesh(target);

    const D = inst.duration();
    const dt = 1 / 120;

    // At t=0 the column hangs in a compact stack from the reservoir.
    inst.seek(0);
    const start = readLobes(mesh);
    const startBottom = Math.min(...start.map((l) => l.y));

    // Across the cycle a detached droplet must fall MARKEDLY below where the
    // resting column ever reaches — that can only happen via pinch-off + free
    // fall (a stretched-but-still-attached chain stays near its rest span).
    let deepestFall = startBottom;
    let sawNeck = false; // some lobe thinned well past the fattest (a neck/waist)
    let sawSeparation = false; // a clear vertical GAP → a droplet pinched off
    for (let k = 1; k <= Math.ceil(D * 120) + 80; k++) {
      inst.seek(k * dt);
      const L = readLobes(mesh);
      const bottom = Math.min(...L.map((l) => l.y));
      deepestFall = Math.min(deepestFall, bottom);
      const maxR = Math.max(...L.map((l) => l.r));
      const minR = Math.min(...L.map((l) => l.r));
      if (minR < maxR * 0.5) sawNeck = true;
      // Largest vertical gap between adjacent (sorted) lobes; a big gap means a
      // droplet has detached and is falling away from the still-hanging neck.
      const ys = L.map((l) => l.y).sort((a, b) => b - a);
      let maxGap = 0;
      for (let j = 1; j < ys.length; j++) maxGap = Math.max(maxGap, ys[j - 1] - ys[j]);
      if (maxGap > 0.5) sawSeparation = true;
    }

    // It genuinely necked (the filament thinned to a thin waist mid-cycle).
    expect(sawNeck).toBe(true);
    // A droplet physically pinched off and separated (a real gap opened up).
    expect(sawSeparation).toBe(true);
    // A droplet fell far below the starting column bottom — pinch-off + free fall.
    expect(deepestFall).toBeLessThan(startBottom - 0.7);

    inst.dispose();
  });

  it('gravity changes the frozen frame at a mid-action pin (control is live; reset-replay)', () => {
    const target = makeTarget(moltenDripSimPrimitive);
    const inst = moltenDripSimPrimitive.create(target);
    const mesh = findMesh(target);
    const D = inst.duration();

    // Mid-action pin where a droplet is detaching/falling: heavier gravity has
    // pulled the falling lobe markedly lower than light gravity at the SAME t.
    const PIN = 0.5 * D;

    inst.setControl('gravity', 2.0);
    inst.seek(PIN);
    const lowG = Math.min(...readLobes(mesh).map((l) => l.y));

    inst.setControl('gravity', 11.0);
    inst.seek(PIN);
    const highG = Math.min(...readLobes(mesh).map((l) => l.y));

    expect(Math.abs(highG - lowG)).toBeGreaterThan(1e-2);

    inst.dispose();
  });

  it('heat drives the emissive glow live at a pinned frame', () => {
    const target = makeTarget(moltenDripSimPrimitive);
    const inst = moltenDripSimPrimitive.create(target);
    const mesh = findMesh(target);
    const D = inst.duration();
    const PIN = 0.45 * D;

    inst.setControl('heat', 0.05);
    inst.seek(PIN);
    const cool = (mesh.material as unknown as { emissiveIntensity: number }).emissiveIntensity;

    inst.setControl('heat', 0.95);
    inst.seek(PIN);
    const hot = (mesh.material as unknown as { emissiveIntensity: number }).emissiveIntensity;

    expect(hot).toBeGreaterThan(cool + 0.5);

    inst.dispose();
  });
});
