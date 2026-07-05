import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { causticRingsPrimitive } from '@/lib/prism/animatable/primitives/caustic-rings';
import { makeTarget, runConformance } from './_conformance';

// caustic-rings swaps the plane's material to a MeshStandardNodeMaterial whose
// emissiveNode is a TSL graph driven by four uniforms: uTime, uSpeed, uRingFreq,
// uSharp. seek(t) advances uTime; setControl writes uRingFreq/etc. Headless has
// no GPU, so we observe CPU-side by walking the node graph and reading the live
// UniformNode .value handles that the primitive mutates.

interface UniformLike { value: number; isUniformNode?: boolean }

function collectUniforms(mesh: Mesh): UniformLike[] {
  const mat = mesh.material as unknown as { emissiveNode?: unknown };
  const root = mat.emissiveNode;
  const found: UniformLike[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || seen.has(node) || depth > 60) return;
    seen.add(node);
    const obj = node as Record<string, unknown> & { isUniformNode?: boolean; value?: unknown };
    if (obj.isUniformNode && typeof obj.value === 'number') {
      found.push(obj as unknown as UniformLike);
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (Array.isArray(v)) for (const e of v) visit(e, depth + 1);
      else if (v && typeof v === 'object') visit(v, depth + 1);
    }
  };
  visit(root, 0);
  return found;
}

// Find a uniform whose live value equals `target` (set moments earlier by seek
// or setControl). Distinct probe values avoid collisions with other uniforms.
function uniformWithValue(mesh: Mesh, target: number): number | undefined {
  return collectUniforms(mesh).find((u) => u.value === target)?.value;
}

describe('caustic-rings primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(causticRingsPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(causticRingsPrimitive);
    const inst = causticRingsPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Material was swapped to a NodeMaterial with an emissive node graph.
    const mat = mesh.material as unknown as { emissiveNode?: unknown; isNodeMaterial?: boolean };
    expect(mat.emissiveNode).toBeDefined();

    // Seek to two distinctive times that cannot equal any control default
    // (1.4 / 22 / 3) — the matching uniform is uTime.
    inst.seek(0.137);
    const early = uniformWithValue(mesh, 0.137);

    inst.seek(2.581);
    const mid = uniformWithValue(mesh, 2.581);

    expect(early).toBe(0.137);
    expect(mid).toBe(2.581);
    expect(mid).not.toBe(early);
    inst.dispose();
  });

  it('controls: ringFreq extremes drive a different uniform value', () => {
    const target = makeTarget(causticRingsPrimitive);
    const inst = causticRingsPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('ringFreq', 9);
    inst.seek(0.5);
    const low = uniformWithValue(mesh, 9);

    inst.setControl('ringFreq', 39);
    inst.seek(0.5);
    const high = uniformWithValue(mesh, 39);

    expect(low).toBe(9);
    expect(high).toBe(39);
    expect((high as number)).toBeGreaterThan((low as number) + 10);
    inst.dispose();
  });

  it('dispose restores the original material', () => {
    const target = makeTarget(causticRingsPrimitive);
    const before = (target.subject as Mesh).material;
    const inst = causticRingsPrimitive.create(target);
    expect((target.subject as Mesh).material).not.toBe(before);
    inst.dispose();
    expect((target.subject as Mesh).material).toBe(before);
  });
});
