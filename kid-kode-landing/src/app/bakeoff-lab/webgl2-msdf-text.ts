// W-BAKE lab-only WebGL2 MSDF text factory.
//
// WHY THIS EXISTS (measurement-integrity fix, 2026-07-10): the product's
// default text factory (`three-msdf-text-webgpu`) only compiles on the
// WebGPU backend, and `createText()` deliberately returns an invisible
// placeholder Group on WebGL2 canvases (see shared/text.ts). The bakeoff
// capture rig MUST run the WebGL2 fallback (headless WebGPU screenshots
// come out blank/dithered — W-2D). Net effect: every contestant's text —
// including correct `ctx.fontAtlas.createText(content, opts)` calls — was
// structurally invisible to the design judge. That is an instrument blind
// spot, not a model failure.
//
// This factory renders the SAME BMFont atlas, the SAME glyph metrics, and
// the SAME call contract through a TSL median-of-RGB MSDF material that
// compiles on WebGL2. It is injected ONLY by the /bakeoff-lab dev route via
// `createFontAtlas({ msdfTextFactory })` — zero production-path changes.
// Fidelity caveat (disclosed in the report): screen-space AA here is a
// smoothstep band rather than the package's fwidth-based AA, so very small
// glyphs read slightly softer than the true WebGPU renderer; presence,
// content, scale, color, and placement are faithful. `maxWidthPx` wrapping
// is not implemented (contestant calls in the corpus use short labels).

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  type Object3D,
  type Texture,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { texture as tslTexture, uv as tslUV, smoothstep, max as tslMax, min as tslMin, float, vec4 } from 'three/tsl';
import type { BMFontJSON } from 'three-msdf-text-webgpu';
import type { TextOpts } from '@/lib/prism/runtime/shared/text';

interface BMChar {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  xoffset: number;
  yoffset: number;
  xadvance: number;
}

interface BMFontLike {
  info?: { size?: number };
  common?: { lineHeight?: number; base?: number; scaleW?: number; scaleH?: number };
  chars: BMChar[];
}

export function webgl2MSDFTextFactory(
  content: string,
  opts: TextOpts | undefined,
  atlas: Texture,
  data: BMFontJSON,
): Object3D {
  const font = data as unknown as BMFontLike;
  const chars = new Map<number, BMChar>();
  for (const c of font.chars ?? []) chars.set(c.id, c);
  const fontPx = font.info?.size ?? 42;
  const lineHeightPx = font.common?.lineHeight ?? fontPx * 1.2;
  const basePx = font.common?.base ?? fontPx * 0.8;
  const image = atlas.image as { width?: number; height?: number } | undefined;
  const scaleW = font.common?.scaleW ?? image?.width ?? 512;
  const scaleH = font.common?.scaleH ?? image?.height ?? 512;

  // fontSize = world-space em height (same convention the runtime's labels
  // use); glyph pixel metrics scale by fontSize / atlas font size.
  const fontSize = opts?.fontSize ?? 0.2;
  const s = fontSize / fontPx;
  const letterSpacingPx = opts?.letterSpacingPx ?? 0;

  const lines = String(content ?? '').split('\n');
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const lineWidths = lines.map((line) => {
    let w = 0;
    for (const ch of line) {
      const g = chars.get(ch.codePointAt(0) ?? 0);
      if (g) w += (g.xadvance + letterSpacingPx) * s;
    }
    return w;
  });
  const align = opts?.align ?? 'left';

  let quad = 0;
  for (let li = 0; li < lines.length; li += 1) {
    const line = lines[li];
    let cursorX = align === 'center' ? -lineWidths[li] / 2 : align === 'right' ? -lineWidths[li] : 0;
    const lineTopY = -li * lineHeightPx * s;
    for (const ch of line) {
      const g = chars.get(ch.codePointAt(0) ?? 0);
      if (!g) continue;
      if (g.width > 0 && g.height > 0) {
        const x0 = cursorX + g.xoffset * s;
        const x1 = x0 + g.width * s;
        // Baseline-anchored: BMFont yoffset is measured down from the line
        // top; the visual baseline sits `base` px below the line top.
        const y1 = lineTopY + (basePx - g.yoffset) * s;
        const y0 = y1 - g.height * s;
        const u0 = g.x / scaleW;
        const u1 = (g.x + g.width) / scaleW;
        // TextureLoader defaults flipY=true → BMFont's top-origin rows flip.
        const v0 = 1 - (g.y + g.height) / scaleH;
        const v1 = 1 - g.y / scaleH;
        positions.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0);
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
        const b = quad * 4;
        indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
        quad += 1;
      }
      cursorX += (g.xadvance + letterSpacingPx) * s;
    }
  }

  if (quad === 0) {
    const empty = new Group();
    empty.name = `text:${content}`;
    return empty;
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  const sampled = tslTexture(atlas, tslUV());
  // Median-of-RGB reconstructs the multi-channel signed distance field.
  const median = tslMax(
    tslMin(sampled.r, sampled.g),
    tslMin(tslMax(sampled.r, sampled.g), sampled.b),
  );
  const alpha = smoothstep(float(0.44), float(0.56), median);
  const tint = new Color(opts?.color ?? '#ffffff');
  const material = new MeshBasicNodeMaterial();
  material.colorNode = vec4(float(tint.r), float(tint.g), float(tint.b), alpha);
  material.transparent = true;
  material.depthWrite = false;
  material.side = DoubleSide;

  const mesh = new Mesh(geo, material);
  mesh.name = `text:${content}`;
  mesh.userData.cleanup = () => {
    geo.dispose();
    material.dispose();
  };
  return mesh;
}
