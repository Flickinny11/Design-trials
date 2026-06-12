import { describe, it, expect } from 'vitest';
import { Sprite, type BufferGeometry, type InstancedBufferAttribute } from 'three';
import type { PointsNodeMaterial } from 'three/webgpu';
import { embersPrimitive } from '@/lib/prism/animatable/primitives/embers';
import { makeTarget, runConformance } from './_conformance';

/** Find the built instanced Sprite under the target. */
function emberSprite(target: ReturnType<typeof makeTarget>): Sprite {
  let sprite: Sprite | null = null;
  target.object.traverse((o) => {
    if ((o as Sprite).isSprite) sprite = o as Sprite;
  });
  if (!sprite) throw new Error('no Sprite built');
  return sprite;
}

/** The per-ember instanced position attribute. */
function instancePositions(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = emberSprite(target).geometry as BufferGeometry;
  return geo.attributes.instancePosition as InstancedBufferAttribute;
}

/** The per-ember instanced color attribute. */
function instanceColors(target: ReturnType<typeof makeTarget>): InstancedBufferAttribute {
  const geo = emberSprite(target).geometry as BufferGeometry;
  return geo.attributes.instanceColor as InstancedBufferAttribute;
}

/** Pull one ember's y from the instanced position attribute. */
function emberY(target: ReturnType<typeof makeTarget>, index = 0): number {
  const arr = instancePositions(target).array as Float32Array;
  return arr[index * 3 + 1];
}

// Mirror of the primitive's build-time extents (positions encode phase as
// y = Y_BASE + phase * RISE_HEIGHT, so tests can recover phase from y).
const Y_BASE = -1.2;
const RISE_HEIGHT = 2.6;

describe('embers primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(embersPrimitive).dispose();
  });

  it('plays: an ember y changes across distinct seek times (looping rise)', () => {
    const target = makeTarget(embersPrimitive);
    const inst = embersPrimitive.create(target);

    // Looping primitive (duration Infinity): pick two distinct t values where
    // the per-particle phase differs, so the y position must change.
    inst.seek(0.1);
    const yEarly = emberY(target, 0);

    inst.seek(1.7);
    const yLate = emberY(target, 0);

    expect(Math.abs(yLate - yEarly)).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: faster rise reaches a different height at the same t', () => {
    const target = makeTarget(embersPrimitive);
    const inst = embersPrimitive.create(target);

    inst.setControl('rise', 0.05);
    inst.seek(2.3);
    const ySlow = emberY(target, 0);

    inst.setControl('rise', 1.2);
    inst.seek(2.3);
    const yFast = emberY(target, 0);

    // Different rise speeds put the ember at a different phase (height) at the
    // same clock time.
    expect(Math.abs(yFast - ySlow)).toBeGreaterThan(0.05);
    inst.dispose();
  });

  // ── Regression: BLACK TILE on the catalog rig (2026-06-12) ───────────────
  // The previous look layer used PointsMaterial.map (DataTexture sprite).
  // Under three/webgpu's node-material conversion THREE.Points has no
  // gl_PointCoord-driven map sampling — the sample pinned to texel (0,0) = 0,
  // and additive blending of zero rendered the tile completely black. The fix
  // is the r184-supported mechanism: an instanced THREE.Sprite carrying a
  // PointsNodeMaterial whose colorNode multiplies the per-ember instanced
  // color by a TSL radial falloff of the quad uv, and whose positionNode is
  // the instanced per-ember position. No map, no DataTexture.
  it('regression: look layer is a PointsNodeMaterial with TSL color/position nodes (no map)', () => {
    const target = makeTarget(embersPrimitive);
    const inst = embersPrimitive.create(target);

    const sprite = emberSprite(target);
    const mat = sprite.material as PointsNodeMaterial;

    expect(mat.isPointsNodeMaterial, 'material is a PointsNodeMaterial').toBe(true);
    expect(mat.colorNode, 'colorNode carries the radial-falloff look').toBeTruthy();
    expect(mat.positionNode, 'positionNode places instances').toBeTruthy();
    expect(mat.map, 'no texture map — the falloff is TSL, not a baked sprite').toBeFalsy();
    expect(mat.sizeAttenuation, 'sizeAttenuation preserved').toBe(true);
    expect(mat.transparent, 'transparent preserved').toBe(true);
    expect(mat.depthWrite, 'depthWrite stays off').toBe(false);

    // The positionNode must be fed by the SAME instanced attribute the CPU
    // loop writes (wiring check — placement reads the live buffer).
    const posAttr = instancePositions(target);
    expect(posAttr, 'instancePosition attribute exists').toBeTruthy();
    expect(posAttr.isInstancedBufferAttribute, 'positions are instanced').toBe(true);
    const positionNode = mat.positionNode as unknown as { attribute?: unknown };
    expect(positionNode.attribute, 'positionNode reads the instanced position buffer').toBe(
      posAttr,
    );

    // Per-ember color is instanced too (feeds colorNode via
    // instancedBufferAttribute — verified live by the cooling test below).
    const colAttr = instanceColors(target);
    expect(colAttr, 'instanceColor attribute exists').toBeTruthy();
    expect(colAttr.isInstancedBufferAttribute, 'colors are instanced').toBe(true);

    // Instancing is actually engaged on the draw side.
    expect(sprite.count, 'sprite.count drives instanceCount').toBeGreaterThan(0);

    inst.dispose();
  });

  // ── Regression: no per-ember cooling — color/alpha was constant ──────────
  // Every ember rendered the same flat orange across its whole rise. The fix
  // keeps a per-ember instanced color driven by phase: hot bright ignition →
  // cooled deep-red fade-out as phase→1.
  it('regression: per-ember cooling — instanced color varies with phase', () => {
    const target = makeTarget(embersPrimitive);
    const inst = embersPrimitive.create(target);

    inst.seek(2.0);
    const colAttr = instanceColors(target);
    expect(colAttr, 'sprite must carry a per-ember color attribute').toBeTruthy();

    const pos = instancePositions(target).array as Float32Array;
    const col = colAttr.array as Float32Array;
    const count = (inst.getParams().count as number) ?? 280;

    // Recover each ember's phase from its y; pick a fully-ignited young ember
    // (hot bracket) and a nearly-spent old ember (cooled bracket).
    let hotIdx = -1;
    let cooledIdx = -1;
    for (let i = 0; i < count; i++) {
      const ph = (pos[i * 3 + 1] - Y_BASE) / RISE_HEIGHT;
      if (hotIdx < 0 && ph > 0.15 && ph < 0.3) hotIdx = i;
      if (cooledIdx < 0 && ph > 0.85 && ph < 0.98) cooledIdx = i;
      if (hotIdx >= 0 && cooledIdx >= 0) break;
    }
    expect(hotIdx, 'found a young (hot-bracket) ember').toBeGreaterThanOrEqual(0);
    expect(cooledIdx, 'found an old (cooled-bracket) ember').toBeGreaterThanOrEqual(0);

    const rgb = (i: number) => [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]];
    const [hr, hg, hb] = rgb(hotIdx);
    const [cr, cg, cb] = rgb(cooledIdx);

    // Colors must differ — the bug was a constant color over the whole rise.
    expect(Math.abs(hr - cr) + Math.abs(hg - cg) + Math.abs(hb - cb)).toBeGreaterThan(0.05);
    // Cooling: the young ember is distinctly brighter than the spent one
    // (alpha fade is premultiplied into RGB under additive blending).
    expect(hr + hg + hb).toBeGreaterThan((cr + cg + cb) * 1.5);

    inst.dispose();
  });

  it('determinism: re-seeking the same t reproduces identical positions and colors', () => {
    const target = makeTarget(embersPrimitive);
    const inst = embersPrimitive.create(target);

    inst.seek(1.3);
    const posA = Float32Array.from(instancePositions(target).array as Float32Array);
    const colA = Float32Array.from(instanceColors(target).array as Float32Array);

    inst.seek(0.4); // scrub away…
    inst.seek(1.3); // …and back: pure seek must reproduce the exact frame
    expect(instancePositions(target).array as Float32Array).toEqual(posA);
    expect(instanceColors(target).array as Float32Array).toEqual(colA);

    inst.dispose();
  });

  it('regression: dispose frees the geometry (instanced buffers) and material it created', () => {
    const target = makeTarget(embersPrimitive);
    const inst = embersPrimitive.create(target);

    const sprite = emberSprite(target);
    const geometry = sprite.geometry as BufferGeometry;
    const material = sprite.material as PointsNodeMaterial;

    let geometryDisposed = false;
    let materialDisposed = false;
    geometry.addEventListener('dispose', () => {
      geometryDisposed = true;
    });
    material.addEventListener('dispose', () => {
      materialDisposed = true;
    });

    inst.dispose();
    expect(geometryDisposed, 'geometry dispose() fired (frees instanced buffers)').toBe(true);
    expect(materialDisposed, 'material dispose() fired').toBe(true);
    expect(target.object.children.includes(sprite), 'sprite removed from target').toBe(false);
  });
});
