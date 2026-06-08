import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { rollInPrimitive } from '@/lib/prism/animatable/primitives/roll-in';
import { makeTarget, runConformance } from './_conformance';

describe('roll-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(rollInPrimitive).dispose();
  });

  it('plays: rotation.z tracks position.x as the card rolls in', () => {
    const target = makeTarget(rollInPrimitive);
    const inst = rollInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.seek(0);
    const x0 = mesh.position.x;
    const rot0 = mesh.rotation.z;

    inst.seek(dur * 0.5);
    const xMid = mesh.position.x;
    const rotMid = mesh.rotation.z;

    inst.seek(dur);
    const xEnd = mesh.position.x;
    const rotEnd = mesh.rotation.z;

    // x travels from negative toward the origin.
    expect(x0).toBeLessThan(xMid - 0.1);
    expect(xMid).toBeLessThan(xEnd - 0.1);
    // rolling: rotation.z moves as the card translates (no-slip => clockwise/neg).
    expect(rot0).toBeGreaterThan(rotMid + 0.1);
    expect(rotMid).toBeGreaterThan(rotEnd + 0.1);

    // no-slip lock: rotation delta == -(position delta)/radius for radius=1.2.
    const radius = 1.2;
    const dx = xEnd - x0;
    const dRot = rotEnd - rot0;
    expect(dRot).toBeCloseTo(-dx / radius, 5);

    inst.dispose();
  });

  it('controls change output: tighter radius means more rotation for the same travel', () => {
    const target = makeTarget(rollInPrimitive);
    const inst = rollInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.setControl('radius', 3);
    inst.seek(0);
    const rotStartLoose = mesh.rotation.z;
    inst.seek(dur);
    const looseTotal = Math.abs(mesh.rotation.z - rotStartLoose);

    inst.setControl('radius', 0.5);
    inst.seek(0);
    const rotStartTight = mesh.rotation.z;
    inst.seek(dur);
    const tightTotal = Math.abs(mesh.rotation.z - rotStartTight);

    // Smaller radius -> the wheel spins more for the same distance travelled.
    expect(tightTotal).toBeGreaterThan(looseTotal + 0.5);

    inst.dispose();
  });
});
