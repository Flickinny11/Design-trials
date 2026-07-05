import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import { moltenDripSimPrimitive } from '@/lib/prism/animatable/primitives/molten-drip-sim';
import { makeTarget, runConformance } from './_conformance';

// RENDER PATH (fix-round-1): the lobes are no longer a THREE.Points/InstancedMesh.
// They are ONE instanced THREE.Sprite (PointsNodeMaterial, TSL) whose per-bead
// state lives in InstancedBufferAttributes: `instancePosition` (xyz centre),
// `instanceRadius` (profile radius, the old per-lobe scale), and `instanceColor`
// (premultiplied warm glow). Headless has no GPU, but these attribute arrays are
// pure CPU state — the same state the renderer would draw. We decode them
// instead of getMatrixAt()/scale, leaving every physics assertion unchanged.
//
// Parked/hidden beads are written to y = FLOOR_Y - 1000 with radius 0.0001
// (the new HIDDEN park value); the old skip read scale s.x < 1e-4. We mirror that
// skip on the radius attribute with a generous threshold (< 0.01) that cleanly
// separates the park value (1e-4) from the smallest live bead (≈0.05).
const PARKED_RADIUS = 0.01;

function findMesh(target: ReturnType<typeof makeTarget>): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite && o.name === 'molten-drip-sim') sprite = o as Sprite;
  });
  if (!sprite) throw new Error('molten-drip-sim sprite not found');
  return sprite;
}

function attrArray(mesh: Sprite, name: string): Float32Array {
  const geo = mesh.geometry as BufferGeometry;
  return (geo.attributes[name] as InstancedBufferAttribute).array as Float32Array;
}

// Decode the live lobe positions/radii from the instanced Sprite the primitive
// builds. radius (instanceRadius) is the new analog of the old per-lobe scale.
function readLobes(mesh: Sprite) {
  const positions = attrArray(mesh, 'instancePosition');
  const radii = attrArray(mesh, 'instanceRadius');
  const out: { i: number; y: number; r: number }[] = [];
  for (let i = 0; i < mesh.count; i++) {
    const r = radii[i];
    if (r < PARKED_RADIUS) continue; // parked / hidden lobe
    out.push({ i, y: positions[i * 3 + 1], r });
  }
  return out;
}

// The emissive glow now lives per-bead in the premultiplied `instanceColor`
// attribute (heat scales every bead's luminance via the `glow` factor in
// write()), replacing the old material.emissiveIntensity scalar. The brightest
// bead's channel-sum is the live glow readout the renderer would composite.
function maxGlow(mesh: Sprite): number {
  const col = attrArray(mesh, 'instanceColor');
  const radii = attrArray(mesh, 'instanceRadius');
  let best = 0;
  for (let i = 0; i < mesh.count; i++) {
    if (radii[i] < PARKED_RADIUS) continue; // skip parked beads (color 0)
    const lum = col[i * 3] + col[i * 3 + 1] + col[i * 3 + 2];
    if (lum > best) best = lum;
  }
  return best;
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
    const cool = maxGlow(mesh);

    inst.setControl('heat', 0.95);
    inst.seek(PIN);
    const hot = maxGlow(mesh);

    expect(hot).toBeGreaterThan(cool + 0.5);

    inst.dispose();
  });
});
