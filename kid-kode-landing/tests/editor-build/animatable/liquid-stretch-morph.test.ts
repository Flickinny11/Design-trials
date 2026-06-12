import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { liquidStretchMorphPrimitive } from '@/lib/prism/animatable/primitives/liquid-stretch-morph';
import { makeTarget, runConformance } from './_conformance';

// Timeline geometry shared with the implementation (see liquid-stretch-morph.ts):
// each leg is `duration` seconds; flight occupies 0..FLIGHT_END of a leg, the
// arrival gel wobble fills the rest. Tests address specific leg phases via these.
const FLIGHT_END = 0.62;

describe('liquid-stretch-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(liquidStretchMorphPrimitive).dispose();
  });

  it('plays: travels A→B stretching long-and-thin mid-flight (volume preserved), then loops back', () => {
    const target = makeTarget(liquidStretchMorphPrimitive);
    const inst = liquidStretchMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const legDur = inst.getParams().duration as number;
    const baseX = mesh.position.x;
    const baseSX = mesh.scale.x;
    const baseSY = mesh.scale.y;

    // t=0 — parked at anchor A, well left of the rest pose, undeformed.
    inst.seek(0);
    const anchorA = mesh.position.x;
    expect(anchorA).toBeLessThan(baseX - 0.5);
    expect(mesh.scale.x).toBeCloseTo(baseSX, 3);
    expect(mesh.scale.y).toBeCloseTo(baseSY, 3);

    // Mid-flight (f = 0.75 of the flight window) — pulled like taffy: LONG along
    // the travel axis, THIN across it, and 2D volume preserved (sx·sy == base).
    inst.seek(legDur * FLIGHT_END * 0.75);
    const midX = mesh.position.x;
    expect(midX).toBeGreaterThan(anchorA + 0.1); // left A, …
    expect(midX).toBeLessThan(2 * baseX - anchorA - 0.1); // …has not reached B
    expect(mesh.scale.x).toBeGreaterThan(baseSX * 1.15); // long
    expect(mesh.scale.y).toBeLessThan(baseSY * 0.9); // thin
    expect(mesh.scale.x * mesh.scale.y).toBeCloseTo(baseSX * baseSY, 5); // taffy conserves area

    // Impact (q = FLIGHT_END) — arrived at anchor B carrying peak elongation.
    inst.seek(legDur * FLIGHT_END);
    const anchorB = mesh.position.x;
    expect(anchorB).toBeGreaterThan(baseX + 0.5);
    expect(anchorB).toBeCloseTo(-anchorA + 2 * baseX, 2); // B mirrors A about the rest pose
    expect(mesh.scale.x).toBeGreaterThan(baseSX * 1.3); // still elongated at the snap

    // Gel wobble (w = 0.15 of the arrival window) — the default elasticOut ring
    // swings the deviation NEGATIVE: the stretch axes exchange (short along
    // travel, tall across — volume-preserving squash). Position holds at B.
    inst.seek(legDur * (FLIGHT_END + 0.15 * (1 - FLIGHT_END)));
    expect(mesh.position.x).toBeCloseTo(anchorB, 5);
    expect(mesh.scale.x).toBeLessThan(baseSX * 0.95); // exchanged: now short…
    expect(mesh.scale.y).toBeGreaterThan(baseSY * 1.05); // …and tall
    expect(mesh.scale.x * mesh.scale.y).toBeCloseTo(baseSX * baseSY, 5);

    // Leg end (q→1) — wobble fully settled at B, undeformed.
    inst.seek(legDur * 0.999);
    expect(mesh.position.x).toBeCloseTo(anchorB, 3);
    expect(mesh.scale.x).toBeCloseTo(baseSX, 1);

    // Second leg impact — travelled BACK to anchor A (the A→B→A loop).
    inst.seek(legDur * (1 + FLIGHT_END));
    expect(mesh.position.x).toBeCloseTo(anchorA, 2);

    // Full cycle wrap — back at A, parked, undeformed.
    inst.seek(legDur * 2);
    expect(mesh.position.x).toBeCloseTo(anchorA, 5);
    expect(mesh.scale.x).toBeCloseTo(baseSX, 3);

    inst.dispose();
  });

  it('controls change output: travel widens the anchors, stretch deepens the taffy', () => {
    const target = makeTarget(liquidStretchMorphPrimitive);
    const inst = liquidStretchMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const legDur = inst.getParams().duration as number;
    const baseX = mesh.position.x;
    const baseSX = mesh.scale.x;
    const impactT = legDur * FLIGHT_END;
    const midFlightT = legDur * FLIGHT_END * 0.75;

    // travel min → max: anchor B moves dramatically outward.
    inst.setControl('travel', 0.4);
    inst.seek(impactT);
    const nearB = Math.abs(mesh.position.x - baseX);
    inst.setControl('travel', 2.5);
    inst.seek(impactT);
    const farB = Math.abs(mesh.position.x - baseX);
    expect(farB).toBeGreaterThan(nearB + 0.5);

    // stretch min → max: mid-flight elongation deepens.
    inst.setControl('stretch', 0.1);
    inst.seek(midFlightT);
    const subtle = mesh.scale.x / baseSX;
    inst.setControl('stretch', 1.0);
    inst.seek(midFlightT);
    const extreme = mesh.scale.x / baseSX;
    expect(extreme).toBeGreaterThan(subtle + 0.3);

    inst.dispose();
  });

  it('dispose restores position and scale exactly', () => {
    const target = makeTarget(liquidStretchMorphPrimitive);
    const inst = liquidStretchMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const baseX = mesh.position.x;
    const baseSX = mesh.scale.x;
    const baseSY = mesh.scale.y;
    const baseSZ = mesh.scale.z;

    // Park late in the flight (f = 0.9) where both position and deformation
    // clearly deviate from base (at f = 0.75 the taffy pull crosses the rest
    // pose almost exactly, so position alone would not discriminate there).
    const legDur = inst.getParams().duration as number;
    inst.seek(legDur * FLIGHT_END * 0.9);
    expect(Math.abs(mesh.position.x - baseX)).toBeGreaterThan(0.01);
    expect(Math.abs(mesh.scale.x - baseSX)).toBeGreaterThan(0.01);

    inst.dispose();
    expect(mesh.position.x).toBeCloseTo(baseX, 6);
    expect(mesh.scale.x).toBeCloseTo(baseSX, 6);
    expect(mesh.scale.y).toBeCloseTo(baseSY, 6);
    expect(mesh.scale.z).toBeCloseTo(baseSZ, 6);
  });
});
