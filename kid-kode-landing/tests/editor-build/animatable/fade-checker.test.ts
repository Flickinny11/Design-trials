import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { fadeCheckerPrimitive } from '@/lib/prism/animatable/primitives/fade-checker';
import { makeTarget, runConformance } from './_conformance';

// The primitive swaps in a MeshStandardNodeMaterial and drives a uProgress
// uniform (plus uCells / uSoft) inside seek(). Those uniform handles live in the
// opacityNode graph, so we walk that graph to read their numeric .value on CPU
// (headless, no GPU render) and assert concrete changes across seek + controls.

describe('fade-checker primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fadeCheckerPrimitive).dispose();
  });

  it('plays: progress uniform advances 0 -> 1 across the timeline', () => {
    const target = makeTarget(fadeCheckerPrimitive);
    const inst = fadeCheckerPrimitive.create(target);
    const mesh = target.subject as Mesh;
    // The primitive swapped in a NodeMaterial with an opacityNode.
    const mat = mesh.material as unknown as { opacityNode?: unknown };
    expect(mat.opacityNode, 'opacityNode installed').toBeTruthy();

    // Reach the uProgress uniform via the opacityNode graph: it is the only
    // uniform whose .value moves with seek. Walk the node tree to find uniforms.
    const uniforms = collectUniforms(mat.opacityNode);
    expect(uniforms.length, 'uniforms present in opacityNode graph').toBeGreaterThan(0);

    const dur = inst.duration();
    inst.seek(0);
    const early = snapshot(uniforms);
    inst.seek(dur);
    const late = snapshot(uniforms);

    // At least one uniform's value must change between the first and last frame
    // (uProgress goes 0 -> 1).
    const changed = early.some((v, i) => Math.abs(v - late[i]) > 0.5);
    expect(changed, 'a progress uniform advances across the timeline').toBe(true);

    // Specifically: some uniform is ~0 early and ~1 late.
    const wentToOne = late.some((v, i) => early[i] < 0.01 && v > 0.99);
    expect(wentToOne, 'progress uniform reaches 1 at the end').toBe(true);
    inst.dispose();
  });

  it('controls change output: cells knob changes the cells uniform', () => {
    const target = makeTarget(fadeCheckerPrimitive);
    const inst = fadeCheckerPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as unknown as { opacityNode?: unknown };
    const uniforms = collectUniforms(mat.opacityNode);

    inst.setControl('cells', 4);
    inst.seek(0);
    const low = snapshot(uniforms);

    inst.setControl('cells', 16);
    inst.seek(0);
    const high = snapshot(uniforms);

    // The cells uniform (value 4 then 16) must produce a difference of ~12.
    const maxDelta = Math.max(...high.map((v, i) => Math.abs(v - low[i])));
    expect(maxDelta, 'cells uniform reflects the control extremes').toBeGreaterThan(10);
    inst.dispose();
  });
});

// ── helpers ───────────────────────────────────────────────────────────────
// TSL uniform nodes carry a `.value` getter/setter and an `isUniformNode` flag.
// We walk the opacityNode graph collecting every uniform-like node so tests can
// observe the numeric .value the primitive's seek mutates.
function collectUniforms(root: unknown): Array<{ value: number }> {
  const found: Array<{ value: number }> = [];
  const seen = new Set<unknown>();
  const visit = (n: unknown) => {
    if (!n || typeof n !== 'object' || seen.has(n)) return;
    seen.add(n);
    const obj = n as Record<string, unknown>;
    if (obj.isUniformNode === true && typeof obj.value === 'number') {
      found.push(obj as unknown as { value: number });
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object') visit(v);
      else if (Array.isArray(v)) v.forEach(visit);
    }
  };
  visit(root);
  return found;
}

function snapshot(uniforms: Array<{ value: number }>): number[] {
  return uniforms.map((u) => u.value);
}
