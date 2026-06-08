import { describe, it, expect } from 'vitest';
import { waveWipePrimitive } from '@/lib/prism/animatable/primitives/wave-wipe';
import { makeTarget, runConformance } from './_conformance';

describe('wave-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(waveWipePrimitive).dispose();
  });

  it('plays: live opacityNode uniforms advance across the timeline', () => {
    const target = makeTarget(waveWipePrimitive);
    const inst = waveWipePrimitive.create(target);
    const dur = inst.duration();

    // The primitive swaps the card panel's material for a node material and drives
    // the wavy mask through real uniform handles inside opacityNode. We read those
    // live `.value`s straight off the node graph — genuine CPU-observable state.
    // Snapshot the live uniform values at three frames. The opacityNode graph
    // also contains constant float() nodes (e.g. 2PI, the soft band) which do not
    // change; the TIME-DRIVEN uniforms (uProgress 0->~1.2, uPhase 0->~9.4) are the
    // entries that move. We pair values positionally (same graph -> stable order)
    // and look at the ones that advanced.
    inst.seek(0);
    const early = collectUniformValues(target);

    inst.seek(dur * 0.5);
    const mid = collectUniformValues(target);

    inst.seek(dur);
    const end = collectUniformValues(target);

    // Identify swept-uniform slots: those whose value strictly increased from the
    // early frame to the end frame. There must be at least two (progress + phase).
    const sweptSlots = early
      .map((v, i) => ({ i, e: v, m: mid[i], d: end[i] }))
      .filter((s) => s.d > s.e + 0.05);
    expect(sweptSlots.length).toBeGreaterThanOrEqual(2);

    // Every swept uniform advances monotonically early -> mid -> end.
    for (const s of sweptSlots) {
      expect(s.m).toBeGreaterThan(s.e + 0.01);
      expect(s.d).toBeGreaterThan(s.m + 0.01);
    }

    inst.dispose();
  });

  it('controls change output: amplitude extremes change a live uniform value', () => {
    const target = makeTarget(waveWipePrimitive);
    const inst = waveWipePrimitive.create(target);

    inst.setControl('amplitude', 0);
    inst.seek(0.5);
    const low = collectUniformValues(target);

    inst.setControl('amplitude', 0.3);
    inst.seek(0.5);
    const high = collectUniformValues(target);

    // The amplitude uniform (0 vs 0.3) is present in both snapshots. With amp=0 no
    // uniform carries 0.3; with amp=0.3 one does. Assert the set of live values
    // gained a ~0.3 entry it lacked before.
    const lowHasAmp = low.some((v) => Math.abs(v - 0.3) < 1e-6);
    const highHasAmp = high.some((v) => Math.abs(v - 0.3) < 1e-6);
    expect(lowHasAmp).toBe(false);
    expect(highHasAmp).toBe(true);
    inst.dispose();
  });
});

// Walk the swapped material's opacityNode graph and collect every UniformNode's
// numeric `.value`. The primitive's uProgress / uPhase / uWaves / uAmp handles are
// leaves of that graph; seek() mutates their `.value`s in place, so these are the
// real, CPU-observable per-frame values the renderer would consume.
function collectUniformValues(target: ReturnType<typeof makeTarget>): number[] {
  const mat = (target.subject as unknown as { material: Record<string, unknown> }).material;
  const root = mat.opacityNode;
  const out: number[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (node == null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    const rec = node as Record<string, unknown>;
    if (typeof rec.value === 'number') out.push(rec.value);
    for (const key of Object.keys(rec)) {
      const child = rec[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(root);
  return out;
}
