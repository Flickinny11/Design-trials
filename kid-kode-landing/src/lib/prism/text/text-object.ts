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

import { BufferAttribute, BufferGeometry, Group, Mesh, type Material, type Texture } from 'three';
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

export const createTextObject: CreateTextObjectFn = (spec, atlas, opts) => {
  const group = new Group();
  group.name = TEXT_OBJECT_NAME;

  // P1 hue-fidelity: lit-ness is fixed at build (the node's resolved
  // receivesLighting); setSpec rebuilds reuse it.
  const lit = opts?.lit !== false;
  const resolveFillTexture = opts?.resolveFillTexture;
  let currentAtlas = atlas;
  let resolved = resolveSpec(spec);
  // Pigment texture for `texture`/`ai-texture` fills. Loader-cache-owned
  // (never disposed here); rebuilt-into units when the async load lands and
  // the spec still wants that url.
  let fillTex: { url: string; tex: Texture } | null = null;
  let disposed = false;
  const wantFillUrl = (): string | null => {
    const f = resolved.fill;
    if (f && (f.kind === 'texture' || f.kind === 'ai-texture') && f.url) return f.url;
    return null;
  };
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
          fillTexture:
            fillTex && fillTex.url === wantFillUrl() ? fillTex.tex : undefined,
          outline: resolved.outline,
          glow: resolved.glow,
          opacity: resolved.opacity,
          distanceRange: currentAtlas.data.distanceField?.distanceRange,
          lit,
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

  // Kick (or re-kick) the async pigment-texture resolve for the current fill;
  // rebuild in place when it lands, unless the spec moved on or we disposed.
  const ensureFillTexture = () => {
    const url = wantFillUrl();
    if (!url || !resolveFillTexture) return;
    if (fillTex && fillTex.url === url) return;
    void resolveFillTexture(url)
      .then((tex) => {
        if (disposed || wantFillUrl() !== url) return;
        fillTex = { url, tex };
        clearUnits();
        buildUnits();
      })
      .catch(() => { /* soft-fail: live solid surface stays */ });
  };

  buildUnits();
  ensureFillTexture();

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
      ensureFillTexture();
    },
    measure() {
      return { width: layout.width, height: layout.height };
    },
    dispose() {
      disposed = true;
      // fillTex is loader-cache-owned — never disposed here.
      fillTex = null;
      clearUnits();
    },
  };
  group.userData.textHandle = handle;
  return handle;
};
