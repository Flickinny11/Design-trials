import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { liquidStretchMorphPrimitive } from '@/lib/prism/animatable/primitives/liquid-stretch-morph';
import { makeTarget, runConformance } from './_conformance';

// Timeline geometry shared with the implementation (see liquid-stretch-morph.ts):
// each leg is `duration` seconds; ANTICIPATION occupies 0..ANT_END (gather-squash
// at the anchor), FLIGHT ANT_END..FLIGHT_END (truncated-sine taffy pull, velocity
// peak at f = 0.6, residual 0.5 carried into arrival), and the gel wobble fills
// the rest. Tests address specific leg phases via these.
const ANT_END = 0.16;
const FLIGHT_END = 0.72;

// Capture-rig facts the design is built against (shared-tile-renderer.ts):
// control sweeps run PAUSED at pinned t = 1 s, sweeps leave each earlier
// control at its MAX for later sweeps, and the 4:3 detail frame has a world
// half-width of ≈ 1.553 at the card plane (fov 40 camera at z = 3.2).
const PIN_T = 1;
const FRAME_HALF_W = 1.553;
const CARD_HALF_W = 0.87; // catalog card is 1.74 wide

describe('liquid-stretch-morph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(liquidStretchMorphPrimitive).dispose();
  });

  it('plays: anticipation squash, A→B taffy flight (long-and-thin, volume preserved), gel wobble, loop back', () => {
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
    expect(anchorA).toBeLessThan(baseX - 0.4);
    expect(mesh.scale.x).toBeCloseTo(baseSX, 3);
    expect(mesh.scale.y).toBeCloseTo(baseSY, 3);

    // Anticipation mid (a = 0.5) — gather-squash at the anchor before launch:
    // SHORT along travel, TALL across, position still parked, area preserved.
    inst.seek(legDur * (ANT_END / 2));
    expect(mesh.position.x).toBeCloseTo(anchorA, 5);
    expect(mesh.scale.x).toBeLessThan(baseSX * 0.95);
    expect(mesh.scale.y).toBeGreaterThan(baseSY * 1.03);
    expect(mesh.scale.x * mesh.scale.y).toBeCloseTo(baseSX * baseSY, 5);

    // Mid-flight (f = 0.6, the velocity peak) — pulled like taffy: LONG along
    // the travel axis, THIN across it, and 2D volume preserved (sx·sy == base).
    inst.seek(legDur * (ANT_END + 0.6 * (FLIGHT_END - ANT_END)));
    const midX = mesh.position.x;
    expect(midX).toBeGreaterThan(anchorA + 0.1); // left A, …
    expect(midX).toBeLessThan(2 * baseX - anchorA - 0.1); // …has not reached B
    expect(mesh.scale.x).toBeGreaterThan(baseSX * 1.25); // long (1 + 0.35·1 at peak)
    expect(mesh.scale.y).toBeLessThan(baseSY * 0.85); // thin
    expect(mesh.scale.x * mesh.scale.y).toBeCloseTo(baseSX * baseSY, 5); // taffy conserves area

    // Impact (q = FLIGHT_END) — arrived at anchor B still carrying the residual
    // elongation (1 + stretch·sinΦ = 1 + 0.35·0.5 at defaults).
    inst.seek(legDur * FLIGHT_END);
    const anchorB = mesh.position.x;
    expect(anchorB).toBeGreaterThan(baseX + 0.4);
    expect(anchorB).toBeCloseTo(-anchorA + 2 * baseX, 2); // B mirrors A about the rest pose
    expect(mesh.scale.x).toBeGreaterThan(baseSX * 1.1); // still elongated at the snap

    // Gel wobble (w = 0.1 of the arrival window) — the default elasticOut ring
    // swings the deviation NEGATIVE: the stretch axes exchange (short along
    // travel, tall across — volume-preserving squash). Position holds at B.
    inst.seek(legDur * (FLIGHT_END + 0.1 * (1 - FLIGHT_END)));
    expect(mesh.position.x).toBeCloseTo(anchorB, 5);
    expect(mesh.scale.x).toBeLessThan(baseSX * 0.99); // exchanged: now short…
    expect(mesh.scale.y).toBeGreaterThan(baseSY * 1.01); // …and tall
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

  // REGRESSION (advocate must-fix 2026-06-12): the capture rig judges every
  // control PAUSED at pinned t = 1 s. With the old timeline t = 1 s fell in the
  // ARRIVAL hold (anchor-parked, velocity-stretch disengaged) so `stretch`
  // measured DEAD (changedFrac 0.0024). The pin must be an ENGAGED state:
  // mid-flight, near peak velocity, card near the tile centre.
  it('t = 1 s (the capture pin) is mid-flight and engaged at default params', () => {
    const target = makeTarget(liquidStretchMorphPrimitive);
    const inst = liquidStretchMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const baseX = mesh.position.x;
    const baseSX = mesh.scale.x;
    const baseSY = mesh.scale.y;

    inst.seek(0);
    const anchorA = mesh.position.x;
    const half = baseX - anchorA;

    inst.seek(PIN_T);
    // Strictly between the anchors and near centre — never parked at an anchor.
    expect(mesh.position.x).toBeGreaterThan(baseX + 0.02);
    expect(mesh.position.x).toBeLessThan(baseX + half * 0.6);
    // Velocity-stretch engaged: ≈ 96% of peak velocity at the pin → sAlong
    // ≈ 1 + 0.35·0.96 at the default stretch.
    expect(mesh.scale.x).toBeGreaterThan(baseSX * 1.25);
    expect(mesh.scale.y).toBeLessThan(baseSY * 0.8);
    expect(mesh.scale.x * mesh.scale.y).toBeCloseTo(baseSX * baseSY, 5);

    inst.dispose();
  });

  it('stretch sweep at the pin (t = 1 s) produces a large deformation delta', () => {
    const target = makeTarget(liquidStretchMorphPrimitive);
    const inst = liquidStretchMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const baseSX = mesh.scale.x;

    inst.setControl('stretch', 0.1);
    inst.seek(PIN_T);
    const subtle = mesh.scale.x / baseSX;
    const subtleX = mesh.position.x;
    inst.setControl('stretch', 0.55);
    inst.seek(PIN_T);
    const extreme = mesh.scale.x / baseSX;
    // ~1.10 → ~1.53: the frozen frame visibly deforms across the sweep.
    expect(extreme).toBeGreaterThan(subtle + 0.3);
    // Position is stretch-independent — the sweep deforms a centred card.
    expect(mesh.position.x).toBeCloseTo(subtleX, 5);

    inst.dispose();
  });

  // REGRESSION (advocate must-fix 2026-06-12): the rig sweeps controls in
  // schema order WITHOUT resetting, so the stretch sweep runs with `travel`
  // left at whatever the previous sweep ended on. `stretch` is now FIRST in
  // the schema (sweeps with everything else at defaults), and even at the
  // worst inherited combination (travel = max, stretch = max) the card must
  // stay essentially inside the tile frame at the pin — the old build sat
  // ~85% off-frame.
  it('schema order puts stretch first; the pin frame stays composed even at travel max', () => {
    const ids = liquidStretchMorphPrimitive.schema.map((c) => c.id);
    expect(ids.indexOf('stretch')).toBeLessThan(ids.indexOf('travel'));
    expect(ids.indexOf('travel')).toBeLessThan(ids.indexOf('duration'));

    const target = makeTarget(liquidStretchMorphPrimitive);
    const inst = liquidStretchMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const baseSX = mesh.scale.x;

    // Defaults at the pin: the whole stretched card fits the frame.
    inst.setControl('stretch', 0.55); // stretch sweep high (defaults elsewhere)
    inst.seek(PIN_T);
    let halfW = CARD_HALF_W * (mesh.scale.x / baseSX);
    expect(Math.abs(mesh.position.x) + halfW).toBeLessThan(FRAME_HALF_W);

    // Worst inherited case (travel max from its own sweep, stretch max): the
    // card centre stays near the tile centre and ≥ 90% of the card is visible.
    inst.setControl('travel', 0.9);
    inst.seek(PIN_T);
    expect(Math.abs(mesh.position.x)).toBeLessThan(0.35);
    halfW = CARD_HALF_W * (mesh.scale.x / baseSX);
    const left = mesh.position.x - halfW;
    const right = mesh.position.x + halfW;
    const visible =
      (Math.min(right, FRAME_HALF_W) - Math.max(left, -FRAME_HALF_W)) / (2 * halfW);
    expect(visible).toBeGreaterThan(0.9);

    inst.dispose();
  });

  it('controls change output: travel widens the anchors and deepens the speed-coupled taffy', () => {
    const target = makeTarget(liquidStretchMorphPrimitive);
    const inst = liquidStretchMorphPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const legDur = inst.getParams().duration as number;
    const baseX = mesh.position.x;
    const baseSX = mesh.scale.x;
    const impactT = legDur * FLIGHT_END;
    const pinT = PIN_T;

    // travel min → max: anchor B moves clearly outward.
    inst.setControl('travel', 0.3);
    inst.seek(impactT);
    const nearB = Math.abs(mesh.position.x - baseX);
    inst.setControl('travel', 0.9);
    inst.seek(impactT);
    const farB = Math.abs(mesh.position.x - baseX);
    expect(farB).toBeGreaterThan(nearB + 0.4);

    // travel also scales the speed-coupled deformation at the pin (faster
    // taffy stretches more), so the travel sweep is alive there too.
    inst.setControl('travel', 0.3);
    inst.seek(pinT);
    const slowStretch = mesh.scale.x / baseSX;
    const slowX = mesh.position.x;
    inst.setControl('travel', 0.9);
    inst.seek(pinT);
    expect(mesh.scale.x / baseSX).toBeGreaterThan(slowStretch + 0.1);
    expect(mesh.position.x).toBeGreaterThan(slowX + 0.05);

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

    // Park at the capture pin (mid-flight) where both position and deformation
    // clearly deviate from base.
    inst.seek(PIN_T);
    expect(Math.abs(mesh.position.x - baseX)).toBeGreaterThan(0.01);
    expect(Math.abs(mesh.scale.x - baseSX)).toBeGreaterThan(0.01);

    inst.dispose();
    expect(mesh.position.x).toBeCloseTo(baseX, 6);
    expect(mesh.scale.x).toBeCloseTo(baseSX, 6);
    expect(mesh.scale.y).toBeCloseTo(baseSY, 6);
    expect(mesh.scale.z).toBeCloseTo(baseSZ, 6);
  });
});
