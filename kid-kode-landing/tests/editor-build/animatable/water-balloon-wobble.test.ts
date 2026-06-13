import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { waterBalloonWobblePrimitive } from '@/lib/prism/animatable/primitives/water-balloon-wobble';
import { makeTarget, runConformance } from './_conformance';

// The shell the primitive generates is a child of target.object named
// 'water-balloon-wobble'. Pull its geometry to inspect the simulated skin.
function shellOf(target: ReturnType<typeof makeTarget>) {
  const mesh = target.object.getObjectByName('water-balloon-wobble') as Mesh;
  return mesh;
}

// Max radial deviation of the shell vertices from the rest radius (≈0.78):
// 0 = perfectly round, >0 = dented / bulging. A genuine soft body deforms.
function maxDeviation(mesh: Mesh): number {
  const pos = mesh.geometry.getAttribute('position');
  let maxDev = 0;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
    maxDev = Math.max(maxDev, Math.abs(r - 0.78));
  }
  return maxDev;
}

describe('water-balloon-wobble primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(waterBalloonWobblePrimitive).dispose();
  });

  it('dents under a poke then wobbles back toward round (real soft-body motion, not static)', () => {
    const target = makeTarget(waterBalloonWobblePrimitive);
    const inst = waterBalloonWobblePrimitive.create(target);
    const mesh = shellOf(target);
    expect(mesh).toBeTruthy();

    // Sample deviation across the first poke cycle.
    const dt = 1 / 60;
    const devs: number[] = [];
    for (let k = 0; k <= 150; k++) {
      inst.seek(k * dt);
      devs.push(maxDeviation(mesh));
    }

    // It genuinely deforms — the skin dents well off the rest sphere.
    const peakDev = Math.max(...devs);
    expect(peakDev).toBeGreaterThan(0.04);

    // It WOBBLES: after dropping into a dent, the deviation later eases back
    // (recovery) — a sign-change in the per-frame deviation delta proves the
    // skin both caves and springs back rather than monotonically collapsing.
    let sawRise = false;
    let sawFall = false;
    for (let k = 2; k < devs.length; k++) {
      const d = devs[k] - devs[k - 1];
      if (d > 1e-4) sawRise = true;
      if (sawRise && d < -1e-4) sawFall = true;
    }
    expect(sawRise).toBe(true); // dent forms / grows
    expect(sawFall).toBe(true); // pressure springs it back → wobble

    // All vertices stay finite (no blow-up).
    const pos = mesh.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      expect(Number.isFinite(pos.getX(i))).toBe(true);
      expect(Number.isFinite(pos.getY(i))).toBe(true);
      expect(Number.isFinite(pos.getZ(i))).toBe(true);
    }

    inst.dispose();
  });

  it('pressure control is live at a frozen pin (reset-replay → frozen frame changes)', () => {
    const target = makeTarget(waterBalloonWobblePrimitive);
    const inst = waterBalloonWobblePrimitive.create(target);
    const mesh = shellOf(target);

    // Pin a representative MID-WOBBLE frame (mid-dent, mid-recovery).
    const PIN = 1.6;

    const snapshot = (): Float32Array => {
      const pos = mesh.geometry.getAttribute('position');
      const out = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        out[i * 3] = pos.getX(i);
        out[i * 3 + 1] = pos.getY(i);
        out[i * 3 + 2] = pos.getZ(i);
      }
      return out;
    };
    const diff = (a: Float32Array, b: Float32Array): number => {
      let s = 0;
      for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
      return s / a.length;
    };

    // Low pressure: it stays caved longer at the pin.
    inst.setControl('pressure', 0.4);
    inst.seek(PIN);
    const soft = snapshot();

    // High pressure: it has sprung back much harder by the same pin.
    inst.setControl('pressure', 6);
    inst.seek(PIN);
    const stiff = snapshot();

    // markDirty re-ran the whole sim to the SAME t → the frozen frame differs.
    expect(diff(soft, stiff)).toBeGreaterThan(1e-3);

    // Poke control is also live at the pin (different dent depth → different frame).
    inst.setControl('poke', 0.05);
    inst.seek(PIN);
    const weakPoke = snapshot();
    inst.setControl('poke', 1);
    inst.seek(PIN);
    const hardPoke = snapshot();
    expect(diff(weakPoke, hardPoke)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
