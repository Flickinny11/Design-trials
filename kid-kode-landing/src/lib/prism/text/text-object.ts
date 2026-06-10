// text-object.ts — the built scene object for renderMode:'text'
// (CreateTextObjectFn / TextObjectHandle from contract.ts).
//
// One flat Group named TEXT_OBJECT_NAME whose direct children are unit meshes
// `glyph-0..N-1` — the SAME naming contract the 36 text-animation primitives
// already traverse. Each unit gets its OWN geometry + material instance
// (per-glyph recolor). setSpec rebuilds geometry from cached atlas metrics in
// place (same Group identity; no image artifact re-render — criterion 26).
// The atlas texture is SHARED (registry-owned): never disposed here, and
// tagged `userData.prismShared` so dispose paths elsewhere can skip it.

import { BufferAttribute, BufferGeometry, Group, Mesh, type Material } from 'three';
import { TEXT_SPEC_DEFAULT, type TextSpec } from '../../prism-graph/types';
import {
  TEXT_BLOCK_UV_ATTR,
  TEXT_OBJECT_NAME,
  textUnitName,
  type CreateTextObjectFn,
  type LoadedFontAtlas,
  type TextLayoutUnit,
  type TextObjectHandle,
} from './contract';
import { layoutText } from './msdf-layout';
import { createMsdfNodeMaterial } from './msdf-material';

/** Resolve a partial spec over TEXT_SPEC_DEFAULT (explicit `undefined` fields
 *  must not clobber defaults). */
function resolveSpec(spec: TextSpec): TextSpec {
  const out: TextSpec = { ...TEXT_SPEC_DEFAULT };
  for (const [key, value] of Object.entries(spec)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** Indexed two-triangles-per-quad geometry: position(z=0) / normal(+z) / uv /
 *  aBlockUv, all in unit-local space (the mesh sits at the unit's center). */
function buildUnitGeometry(unit: TextLayoutUnit): BufferGeometry {
  const n = unit.quads.length;
  const pos = new Float32Array(n * 12);
  const nor = new Float32Array(n * 12);
  const uvs = new Float32Array(n * 8);
  const blk = new Float32Array(n * 8);
  const idx = n * 4 > 65535 ? new Uint32Array(n * 6) : new Uint16Array(n * 6);

  for (let q = 0; q < n; q++) {
    const { rect, uv, blockUv } = unit.quads[q];
    // Corner order: (minX,minY) (maxX,minY) (maxX,maxY) (minX,maxY) — CCW, +z.
    const xs = [rect[0], rect[2], rect[2], rect[0]];
    const ys = [rect[1], rect[1], rect[3], rect[3]];
    const us = [uv[0], uv[2], uv[2], uv[0]];
    const vs = [uv[1], uv[1], uv[3], uv[3]];
    const bus = [blockUv[0], blockUv[2], blockUv[2], blockUv[0]];
    const bvs = [blockUv[1], blockUv[1], blockUv[3], blockUv[3]];
    for (let v = 0; v < 4; v++) {
      const p3 = (q * 4 + v) * 3;
      const p2 = (q * 4 + v) * 2;
      pos[p3] = xs[v];
      pos[p3 + 1] = ys[v];
      pos[p3 + 2] = 0;
      nor[p3 + 2] = 1;
      uvs[p2] = us[v];
      uvs[p2 + 1] = vs[v];
      blk[p2] = bus[v];
      blk[p2 + 1] = bvs[v];
    }
    const o = q * 4;
    idx.set([o, o + 1, o + 2, o, o + 2, o + 3], q * 6);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new BufferAttribute(nor, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setAttribute(TEXT_BLOCK_UV_ATTR, new BufferAttribute(blk, 2));
  geometry.setIndex(new BufferAttribute(idx, 1));
  return geometry;
}

export const createTextObject: CreateTextObjectFn = (spec, atlas) => {
  const group = new Group();
  group.name = TEXT_OBJECT_NAME;

  let currentAtlas = atlas;
  let resolved = resolveSpec(spec);
  let layout = layoutText(resolved, currentAtlas.data);
  const units: Mesh[] = [];

  const markShared = (a: LoadedFontAtlas) => {
    a.texture.userData.prismShared = true;
  };
  markShared(currentAtlas);

  const buildUnits = () => {
    layout.units.forEach((unit, i) => {
      const mesh = new Mesh(
        buildUnitGeometry(unit),
        createMsdfNodeMaterial({
          atlas: currentAtlas.texture,
          fill: resolved.fill,
          outline: resolved.outline,
          glow: resolved.glow,
          opacity: resolved.opacity,
          distanceRange: currentAtlas.data.distanceField?.distanceRange,
        }),
      );
      mesh.name = textUnitName(i);
      mesh.position.set(unit.center.x, unit.center.y, 0);
      units.push(mesh);
      group.add(mesh);
    });
  };

  const clearUnits = () => {
    for (const mesh of units) {
      group.remove(mesh);
      mesh.geometry.dispose();
      // Material dispose never reaches the shared atlas texture.
      (mesh.material as Material).dispose();
    }
    units.length = 0;
  };

  buildUnits();

  const handle: TextObjectHandle = {
    object: group,
    units,
    get spec() {
      return resolved;
    },
    setSpec(next, newAtlas) {
      if (newAtlas) {
        currentAtlas = newAtlas;
        markShared(currentAtlas);
      }
      resolved = resolveSpec(next);
      layout = layoutText(resolved, currentAtlas.data);
      clearUnits();
      buildUnits();
    },
    measure() {
      return { width: layout.width, height: layout.height };
    },
    dispose() {
      clearUnits();
    },
  };
  group.userData.textHandle = handle;
  return handle;
};
