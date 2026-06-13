import { describe, it, expect } from 'vitest';
import { explodeReassembleSimPrimitive } from '@/lib/prism/animatable/primitives/explode-reassemble-sim';
import { makeTarget, runConformance } from './_conformance';
import { Sprite, InstancedBufferAttribute } from 'three';

// Mean distance of the active particle cloud from the origin (formation centre),
// read from the live geometry buffer the primitive writes each seek.
//
// Render layer (fix-round-1): the simulated motes are an instanced billboard
// THREE.Sprite (named 'explode-reassemble-sim') whose per-particle centers live
// in an 'instancePosition' InstancedBufferAttribute — NOT a THREE.Points cloud
// reading a plain 'position' attr. The InstancedBufferAttribute exposes the same
// getX/getY/getZ API, so the radius math below is unchanged; only the object
// lookup + attribute name move to the new representation. (Other Sprites in the
// scene would be decorative; we pick the one carrying the sim by its .name.)
function meanRadius(target: ReturnType<typeof makeTarget>, count: number): number {
  const sprite = target.object.children.find(
    (c) => c instanceof Sprite && c.name === 'explode-reassemble-sim',
  ) as Sprite | undefined;
  expect(sprite, 'primitive added the explode-reassemble-sim sprite').toBeTruthy();
  const pos = sprite!.geometry.getAttribute('instancePosition') as InstancedBufferAttribute;
  expect(pos, 'sprite carries the instancePosition attribute').toBeTruthy();
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    sum += Math.hypot(x, y, z);
  }
  return sum / count;
}

describe('explode-reassemble-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(explodeReassembleSimPrimitive).dispose();
  });

  it('blasts particles outward then reassembles them home (integrated velocity, not a static formation)', () => {
    const target = makeTarget(explodeReassembleSimPrimitive);
    const inst = explodeReassembleSimPrimitive.create(target);
    const count = inst.getParams().count as number;

    // Assembled at rest (before the blast fires).
    inst.seek(0.02);
    const rAssembled = meanRadius(target, count);

    // Sample the whole cycle: a genuine blast means the cloud expands well beyond
    // the home formation, then contracts back toward it (reassembly).
    const D = inst.duration();
    let rMax = rAssembled;
    let rAfterExpand = rAssembled;
    const samples = 60;
    for (let k = 1; k <= samples; k++) {
      inst.seek((k / samples) * D);
      const r = meanRadius(target, count);
      rMax = Math.max(rMax, r);
    }
    // Late in the cycle the spring should have pulled them back in.
    inst.seek(D * 0.96);
    rAfterExpand = meanRadius(target, count);

    // It actually exploded: peak spread is well beyond the assembled formation.
    expect(rMax).toBeGreaterThan(rAssembled * 1.4);
    // It actually reassembled: end-of-cycle is much tighter than the peak.
    expect(rAfterExpand).toBeLessThan(rMax * 0.7);

    inst.dispose();
  });

  it('blast power changes the frozen mid-flight frame (trajectory control is live at a pinned t)', () => {
    const target = makeTarget(explodeReassembleSimPrimitive);
    const inst = explodeReassembleSimPrimitive.create(target);
    const count = inst.getParams().count as number;

    // Pin a mid-action frame (~0.45 of duration → mid-flight / early reassembly).
    const PIN = inst.duration() * 0.45;

    inst.setControl('power', 1.5);
    inst.seek(PIN);
    const rLow = meanRadius(target, count);

    inst.setControl('power', 9);
    inst.seek(PIN);
    const rHigh = meanRadius(target, count);

    // A stronger blast flings particles further at the same pinned time → the
    // frozen frame visibly differs (proves reset-replay + markDirty work).
    expect(Math.abs(rHigh - rLow)).toBeGreaterThan(1e-2);
    expect(rHigh).toBeGreaterThan(rLow);

    inst.dispose();
  });

  it('spring-back stiffness changes the frozen frame too', () => {
    const target = makeTarget(explodeReassembleSimPrimitive);
    const inst = explodeReassembleSimPrimitive.create(target);
    const count = inst.getParams().count as number;
    const PIN = inst.duration() * 0.6; // later, where the spring dominates

    inst.setControl('springBack', 0.08);
    inst.seek(PIN);
    const rWeak = meanRadius(target, count);

    inst.setControl('springBack', 1);
    inst.seek(PIN);
    const rStiff = meanRadius(target, count);

    // A stiffer spring reels the cloud home faster → tighter at the same pin.
    expect(Math.abs(rStiff - rWeak)).toBeGreaterThan(1e-2);

    inst.dispose();
  });
});
