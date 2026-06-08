import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { parallaxLayersPrimitive } from '@/lib/prism/animatable/primitives/parallax-layers';
import { makeTarget, runConformance } from './_conformance';

/** Find the card header chrome child by name in the subject subtree. */
function findHeader(subject: Object3D): Object3D {
  let hit: Object3D | null = null;
  subject.traverse((o) => {
    if (o.name === 'card-header') hit = o;
  });
  if (!hit) throw new Error('card-header not found in subject');
  return hit;
}

describe('parallax-layers primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(parallaxLayersPrimitive).dispose();
  });

  it('plays: a chrome child shifts as the pointer moves', () => {
    const target = makeTarget(parallaxLayersPrimitive);
    const inst = parallaxLayersPrimitive.create(target);
    const header = findHeader(target.subject as Object3D);
    const base = header.position.x;

    // Centered pointer → no offset.
    (target.userData as { pointer: { x: number; y: number } }).pointer = { x: 0.5, y: 0.5 };
    inst.seek(0);
    const centered = header.position.x;

    // Pointer pushed to the right → header shifts (opposite direction by default).
    (target.userData as { pointer: { x: number; y: number } }).pointer = { x: 1.0, y: 0.5 };
    inst.seek(0);
    const shifted = header.position.x;

    expect(Math.abs(centered - base)).toBeLessThan(1e-6);
    expect(Math.abs(shifted - centered)).toBeGreaterThan(0.01);
    inst.dispose();
    // restored to base after dispose
    expect(Math.abs(header.position.x - base)).toBeLessThan(1e-6);
  });

  it('controls change output: larger strength means larger shift', () => {
    const target = makeTarget(parallaxLayersPrimitive);
    const inst = parallaxLayersPrimitive.create(target);
    const header = findHeader(target.subject as Object3D);
    const base = header.position.x;

    (target.userData as { pointer: { x: number; y: number } }).pointer = { x: 1.0, y: 0.5 };

    inst.setControl('strength', 0.1);
    inst.seek(0);
    const small = Math.abs(header.position.x - base);

    inst.setControl('strength', 1.5);
    inst.seek(0);
    const large = Math.abs(header.position.x - base);

    expect(large).toBeGreaterThan(small + 0.01);
    inst.dispose();
  });
});
