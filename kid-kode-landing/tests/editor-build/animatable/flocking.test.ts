import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { flockingPrimitive } from '@/lib/prism/animatable/primitives/flocking';
import { makeTarget, runConformance } from './_conformance';

/** Grab the Points position attribute the primitive built into target.object. */
function positionAttr(object: { children: unknown[] }): BufferAttribute {
  const pts = (object.children as unknown[]).find(
    (c): c is Points => c instanceof Points,
  );
  if (!pts) throw new Error('flocking did not build a THREE.Points');
  return pts.geometry.getAttribute('position') as BufferAttribute;
}

/** Lateral spread (std-dev of y) of the band at the current frame. */
function spreadY(attr: BufferAttribute): number {
  const a = attr.array as Float32Array;
  const n = attr.count;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += a[i * 3 + 1];
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i * 3 + 1] - mean;
    v += d * d;
  }
  return Math.sqrt(v / n);
}

describe('flocking primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flockingPrimitive).dispose();
  });

  it('plays: particle positions migrate coherently across time', () => {
    const target = makeTarget(flockingPrimitive);
    const inst = flockingPrimitive.create(target);
    const attr = positionAttr(target.object);
    const arr = attr.array as Float32Array;

    inst.seek(0);
    const x0 = arr[30]; // 10th particle's x
    const y0 = arr[31];

    inst.seek(1.7);
    const xMid = arr[30];
    const yMid = arr[31];

    // Looping/Infinite primitive: a mid frame differs from t=0.
    const moved = Math.abs(xMid - x0) + Math.abs(yMid - y0);
    expect(moved).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('controls change output: alignment governs band coherence (spread)', () => {
    const target = makeTarget(flockingPrimitive);
    const inst = flockingPrimitive.create(target);
    const attr = positionAttr(target.object);

    // High alignment => particles hug the shared flow => tighter band.
    inst.setControl('alignment', 1);
    inst.seek(0.4);
    const tight = spreadY(attr);

    // Low alignment => full lane offsets retained => looser, wider band.
    inst.setControl('alignment', 0);
    inst.seek(0.4);
    const loose = spreadY(attr);

    expect(loose).toBeGreaterThan(tight + 0.05);
    inst.dispose();
  });
});
