import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { chainDanglePrimitive } from '@/lib/prism/animatable/primitives/chain-dangle';
import { makeTarget, runConformance } from './_conformance';

/** Collect the live (visible) chain bead meshes in index order. */
function beadsOf(object: { children: unknown[] }): Mesh[] {
  const group = (object.children as Mesh[]).find((c) => c.name === 'chain-dangle');
  if (!group) return [];
  return (group.children as Mesh[])
    .filter((m) => m.name.startsWith('chain-bead-') && m.visible)
    .sort(
      (a, b) =>
        Number(a.name.split('-').pop()) - Number(b.name.split('-').pop()),
    );
}

describe('chain-dangle primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(chainDanglePrimitive).dispose();
  });

  it('hangs a chain of discrete beads that swings under real XPBD coupling (not an easing curve)', () => {
    const target = makeTarget(chainDanglePrimitive);
    const inst = chainDanglePrimitive.create(target);

    inst.seek(0);
    const beads0 = beadsOf(target.object);
    // It built a real multi-bead chain (default ~10 beads).
    expect(beads0.length).toBeGreaterThanOrEqual(8);

    // The chain HANGS: every bead sits below the one above it (gravity pulls the
    // strand down from the pinned top), and the top bead is the highest.
    const topY0 = beads0[0].position.y;
    const tailY0 = beads0[beads0.length - 1].position.y;
    expect(topY0).toBeGreaterThan(tailY0 + 0.5); // a real vertical drop

    // The link constraints HOLD the chain together: adjacent beads stay near a
    // fixed rest separation (rigid links, not free-floating points). Measure the
    // first link gap and assert it is bounded (never blows up, never collapses).
    const dx = beads0[1].position.x - beads0[0].position.x;
    const dy = beads0[1].position.y - beads0[0].position.y;
    const dz = beads0[1].position.z - beads0[0].position.z;
    const link01 = Math.hypot(dx, dy, dz);
    expect(link01).toBeGreaterThan(0.05);
    expect(link01).toBeLessThan(0.6); // constrained, not stretched to infinity

    // It actually MOVES (a physical swing, not a static pose): sample the tail
    // bead across time and require genuine horizontal travel AND a sign change
    // in its per-frame horizontal delta (it swings one way, then the other).
    const dt = 1 / 60;
    let prevX = beads0[beads0.length - 1].position.x;
    let prevDelta = 0;
    let sawReversal = false;
    let minTailX = prevX;
    let maxTailX = prevX;
    for (let k = 1; k <= 360; k++) {
      inst.seek(k * dt);
      const tail = beadsOf(target.object);
      const cx = tail[tail.length - 1].position.x;
      const delta = cx - prevX;
      minTailX = Math.min(minTailX, cx);
      maxTailX = Math.max(maxTailX, cx);
      if (k > 4 && prevDelta > 1e-4 && delta < -1e-4) sawReversal = true; // right→left
      if (k > 4 && prevDelta < -1e-4 && delta > 1e-4) sawReversal = true; // left→right
      prevDelta = delta;
      prevX = cx;
    }
    expect(maxTailX - minTailX).toBeGreaterThan(0.15); // a real swing arc
    expect(sawReversal).toBe(true); // a genuine back-and-forth swing (momentum)

    inst.dispose();
  });

  it('gravity changes the frozen mid-swing frame (trajectory-only control is live at a pinned t)', () => {
    const target = makeTarget(chainDanglePrimitive);
    const inst = chainDanglePrimitive.create(target);

    // Pin a mid-swing engaged frame near the rig's ~0.45 frozen phase, where the
    // anchor leads and the lower beads visibly trail (the engaged "chain
    // mid-swing with beads trailing" pose).
    const PIN = 0.5;

    // Sweep gravity at the SAME pinned t: a heavier chain hangs/swings to a
    // measurably different pose than a light one. Because onParamChange →
    // markDirty, the sim re-runs to PIN and the frozen frame visibly changes.
    inst.setControl('gravity', 4);
    inst.seek(PIN);
    const lowG = beadsOf(target.object).map((m) => m.position.clone());

    inst.setControl('gravity', 22);
    inst.seek(PIN);
    const highG = beadsOf(target.object).map((m) => m.position.clone());

    expect(lowG.length).toBe(highG.length);
    // The tail bead is the most sensitive; require a clear positional difference.
    const tailLo = lowG[lowG.length - 1];
    const tailHi = highG[highG.length - 1];
    const moved = tailLo.distanceTo(tailHi);
    expect(moved).toBeGreaterThan(1e-2);

    // Stiffness, too, reshapes the frozen frame (soft links sag/stretch farther).
    inst.setControl('stiffness', 1);
    inst.seek(PIN);
    const stiff = beadsOf(target.object).map((m) => m.position.clone());
    inst.setControl('stiffness', 0.1);
    inst.seek(PIN);
    const soft = beadsOf(target.object).map((m) => m.position.clone());
    const tailStiff = stiff[stiff.length - 1];
    const tailSoft = soft[soft.length - 1];
    expect(tailStiff.distanceTo(tailSoft)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
