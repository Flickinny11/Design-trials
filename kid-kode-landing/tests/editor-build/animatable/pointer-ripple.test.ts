import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { pointerRipplePrimitive } from '@/lib/prism/animatable/primitives/pointer-ripple';
import { makeTarget, runConformance } from './_conformance';

/** Pull a numeric `.value` off a node-material uniform by inspecting the swapped
 *  material's TSL graph. The primitive stores its drive uniforms on emissiveNode,
 *  but the most robust CPU-observable handles are exposed via the material's
 *  uniform objects — we read them through the material the primitive mounted. */

describe('pointer-ripple primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerRipplePrimitive).dispose();
  });

  it('plays: time uniform advances and pointer re-centers across seeks', () => {
    const target = makeTarget(pointerRipplePrimitive);
    const mesh = target.subject as Mesh;
    const inst = pointerRipplePrimitive.create(target);

    // The swapped material is a NodeMaterial; reach its emissiveNode graph and
    // confirm the time uniform tracks seek and pointer tracks userData.
    const mat = mesh.material as unknown as Record<string, unknown>;
    expect(mat.emissiveNode).toBeTruthy();

    const uniforms = collectUniforms(mat.emissiveNode);
    expect(uniforms.length).toBeGreaterThan(0);

    // A scalar uniform (uTime) must advance between an early frame and a later one.
    target.userData.pointer = { x: 0.1, y: 0.2 };
    inst.seek(0);
    const scalars0 = uniforms.map((u) => readUniformValue(u)).filter((v) => typeof v === 'number') as number[];

    target.userData.pointer = { x: 0.85, y: 0.7 };
    inst.seek(1.5);
    const scalarsMid = uniforms.map((u) => readUniformValue(u)).filter((v) => typeof v === 'number') as number[];

    const advanced = scalars0.some((v, i) => Math.abs(scalarsMid[i] - v) > 1e-6);
    expect(advanced).toBe(true);

    // The pointer uniform must re-center to the new pointer.
    const recentered = uniforms.some((u) => {
      const val = (u as { value?: { x?: number; y?: number } }).value;
      return val && Math.abs((val.x ?? 0) - 0.85) < 1e-6 && Math.abs((val.y ?? 0) - 0.7) < 1e-6;
    });
    expect(recentered).toBe(true);
    inst.dispose();
  });

  it('controls + playback: uniforms reflect seek time, pointer, and freq extremes', () => {
    // To observe the internal uniforms deterministically on CPU, we reconstruct
    // the primitive and capture its uniform handles via a probe target whose
    // material we read directly after construction.
    const target = makeTarget(pointerRipplePrimitive);
    const mesh = target.subject as Mesh;
    const inst = pointerRipplePrimitive.create(target);
    const mat = mesh.material as unknown as Record<string, unknown>;
    expect(mat.emissiveNode).toBeTruthy();

    // Locate the uniform nodes carried in the emissiveNode TSL chain by reading
    // values through the public seek path: seek mutates uTime/uPointer/uFreq.
    // We expose them by collecting all UniformNode instances reachable from the
    // material's emissiveNode.
    const uniforms = collectUniforms(mat.emissiveNode);
    expect(uniforms.length).toBeGreaterThan(0);

    const valueAt = () => uniforms.map((u) => readUniformValue(u));

    // PLAYS: advance time -> a time-like scalar uniform must change.
    target.userData.pointer = { x: 0.2, y: 0.3 };
    inst.seek(0);
    const snap0 = valueAt();

    target.userData.pointer = { x: 0.9, y: 0.8 };
    inst.seek(2.0);
    const snapMid = valueAt();

    // Some scalar uniform (uTime) must differ between the two frames, AND a
    // vector uniform (uPointer) must reflect the new pointer.
    const scalarChanged = snap0.some(
      (v, i) => typeof v === 'number' && typeof snapMid[i] === 'number' && Math.abs((snapMid[i] as number) - (v as number)) > 1e-6,
    );
    expect(scalarChanged).toBe(true);

    const pointerTracked = uniforms.some((u) => {
      const val = (u as { value?: { x?: number; y?: number } }).value;
      return val && Math.abs((val.x ?? 0) - 0.9) < 1e-6 && Math.abs((val.y ?? 0) - 0.8) < 1e-6;
    });
    expect(pointerTracked).toBe(true);

    // CONTROLS: freq extremes must drive its uniform to two different values.
    inst.setControl('freq', 8);
    inst.seek(0.1);
    const freqLow = uniforms.map((u) => readUniformValue(u));
    inst.setControl('freq', 40);
    inst.seek(0.1);
    const freqHigh = uniforms.map((u) => readUniformValue(u));

    const someUniformWentTo8 = freqLow.some((v) => v === 8);
    const someUniformWentTo40 = freqHigh.some((v) => v === 40);
    expect(someUniformWentTo8).toBe(true);
    expect(someUniformWentTo40).toBe(true);

    inst.dispose();
  });
});

/** Walk a TSL node graph and collect UniformNode-like nodes (objects with a
 *  mutable `.value`). Bounded traversal over `.value`-less structural fields. */
function collectUniforms(root: unknown): unknown[] {
  const found: unknown[] = [];
  const seen = new Set<unknown>();
  const stack: unknown[] = [root];
  let guard = 0;
  while (stack.length && guard++ < 5000) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    const rec = node as Record<string, unknown>;
    // A UniformNode exposes a `.value` that is a number or a Vector-like object.
    if ('value' in rec && rec.isUniformNode) {
      found.push(node);
    }
    for (const k of Object.keys(rec)) {
      const child = rec[k];
      if (child && typeof child === 'object') stack.push(child);
      else if (Array.isArray(child)) for (const c of child) stack.push(c);
    }
  }
  return found;
}

function readUniformValue(u: unknown): number | { x?: number; y?: number } | undefined {
  const v = (u as { value?: unknown }).value;
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') return v as { x?: number; y?: number };
  return undefined;
}
