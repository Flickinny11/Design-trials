import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { cardFoldPrimitive } from '@/lib/prism/animatable/primitives/card-fold';
import { makeTarget, runConformance } from './_conformance';

describe('card-fold primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(cardFoldPrimitive).dispose();
  });

  it('plays: scale.y grows from a thin crease and rotation.x decreases', () => {
    const target = makeTarget(cardFoldPrimitive);
    const inst = cardFoldPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const dur = inst.duration();

    inst.seek(0);
    const scaleY0 = mesh.scale.y;
    const rotX0 = mesh.rotation.x;

    inst.seek(dur);
    const scaleYEnd = mesh.scale.y;
    const rotXEnd = mesh.rotation.x;

    // unfolds: starts at a thin creased strip, ends fully open
    expect(scaleY0).toBeLessThan(0.2);
    expect(scaleYEnd).toBeGreaterThan(scaleY0 + 0.5);
    // fold-lift rotation eases back toward 0
    expect(rotX0).toBeGreaterThan(rotXEnd + 0.1);
    inst.dispose();
  });

  it('controls change output: creaseLift scales the fold-lift rotation', () => {
    const target = makeTarget(cardFoldPrimitive);
    const inst = cardFoldPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('creaseLift', 0);
    inst.seek(0);
    const liftNone = mesh.rotation.x;

    inst.setControl('creaseLift', 1);
    inst.seek(0);
    const liftFull = mesh.rotation.x;

    expect(liftFull).toBeGreaterThan(liftNone + 0.2);
    inst.dispose();
  });
});
