// msdf-material.ts — TSL unit material for the Prism TextObject.
//
// The MSDF coverage (median-of-RGB signed distance + fwidth screen-space AA)
// is ALWAYS the alpha mask: every fill kind pours pigment into real glyph
// coverage; letterforms are never synthesized (INV-11 — this IS the
// texture-fill masking path). The standard property surface (color / emissive
// / emissiveIntensity / opacity / transparent) stays LIVE so the 36 existing
// text-animation primitives keep working unchanged:
//   - opacityNode MULTIPLIES coverage with materialOpacity (live mat.opacity).
//   - solid fills set NO colorNode — primitives mutate mat.color / mat.emissive
//     / mat.emissiveIntensity directly.
//   - gradient/texture fills multiply by materialColor so primitive recolors
//     still tint the textured pigment.
// The material NEVER loads URLs itself (DOM-free; textures are injected).

import { Color, DoubleSide, NoColorSpace, type Texture } from 'three';
import { MeshStandardNodeMaterial, type Node } from 'three/webgpu';
import {
  attribute,
  clamp,
  color,
  dot,
  float,
  fwidth,
  materialColor,
  materialOpacity,
  max,
  min,
  mix,
  texture,
  uv,
  vec2,
} from 'three/tsl';
import type { TextFill, TextGlowSpec, TextOutlineSpec } from '../../prism-graph/types';
import { TEXT_BLOCK_UV_ATTR } from './contract';

export interface MsdfNodeMaterialOptions {
  /** Shared MSDF atlas texture (registry-owned; never disposed here). */
  atlas: Texture;
  fill?: TextFill;
  /** Pre-loaded pigment texture for fill kind 'texture' / 'ai-texture'.
   *  Injected by the caller — absent (e.g. ai-texture still pending) the
   *  material falls back to the live solid-color surface. */
  fillTexture?: Texture;
  outline?: TextOutlineSpec;
  glow?: TextGlowSpec;
  opacity?: number;
  /** MSDF distanceRange from the atlas data (msdf-bmfont-xml `distanceField`).
   *  Carried for pixel-accurate outline mapping; the fwidth-based AA is
   *  already range-independent in screen space. */
  distanceRange?: number;
}

export function createMsdfNodeMaterial(opts: MsdfNodeMaterialOptions): MeshStandardNodeMaterial {
  const { atlas, fill, outline, glow } = opts;

  // The MSDF atlas is DATA, not color — must never be sRGB-decoded.
  atlas.colorSpace = NoColorSpace;

  const mat = new MeshStandardNodeMaterial();
  // Defaults mirror the catalog proxy glyph materials (animatable/subjects.ts
  // 'text') so the primitives' tuned looks carry over to real letterforms.
  mat.roughness = 0.28;
  mat.metalness = 0.35;
  mat.envMapIntensity = 1.15;
  mat.transparent = true;
  mat.depthWrite = false;
  mat.side = DoubleSide;
  mat.opacity = opts.opacity ?? 1;
  mat.userData.msdfDistanceRange = opts.distanceRange ?? 4;

  // @types/three (r184) types materialColor/materialOpacity as bare
  // MaterialNode (Node<unknown>); the runtime node types are vec3/float.
  // Re-typed ONCE here so the live-property multiply chains typecheck.
  const liveColor = materialColor as unknown as Node<'vec3'>;
  const liveOpacity = materialOpacity as unknown as Node<'float'>;

  // MSDF coverage: median(r,g,b) signed distance → screen-space AA fill.
  const s = texture(atlas, uv());
  const med = max(min(s.r, s.g), min(max(s.r, s.g), s.b));
  const sd = med.sub(0.5);
  const aa = max(fwidth(sd), float(1e-5));
  const fillCov = clamp(sd.div(aa).add(0.5), 0, 1);

  // Pigment expression for non-solid fills (null = live mat.color surface).
  // vec2() wrap + pinned generic: attribute() otherwise widens to
  // AttributeNode<string>, which has no fluent ops.
  const blockUv = vec2(attribute<'vec2'>(TEXT_BLOCK_UV_ATTR, 'vec2'));
  const fillRgb = (() => {
    if (fill?.kind === 'gradient') {
      // Project block uv along angleDeg (0 = left→right), re-biased to 0..1.
      const a = ((fill.angleDeg ?? 0) * Math.PI) / 180;
      const t = clamp(
        dot(blockUv.sub(vec2(0.5, 0.5)), vec2(Math.cos(a), Math.sin(a))).add(0.5),
        0,
        1,
      );
      return mix(color(fill.from), color(fill.to), t).mul(liveColor);
    }
    if ((fill?.kind === 'texture' || fill?.kind === 'ai-texture') && opts.fillTexture) {
      return texture(opts.fillTexture, blockUv).rgb.mul(liveColor);
    }
    return null;
  })();

  const outlineWidth = outline?.width ?? 0;
  if (outlineWidth > 0) {
    // Outline = a wider coverage band; the fill is mixed back over it.
    const outCov = clamp(sd.add(float(outlineWidth * 0.5)).div(aa).add(0.5), 0, 1);
    mat.opacityNode = max(fillCov, outCov).mul(liveOpacity);
    mat.colorNode = mix(color(outline?.color ?? '#000000'), fillRgb ?? liveColor, fillCov);
  } else {
    mat.opacityNode = fillCov.mul(liveOpacity);
    if (fillRgb) mat.colorNode = fillRgb;
  }

  // Live property surface (solid path + emissive defaults). Solid fills keep
  // colorNode unset so primitives drive mat.color directly.
  if (fill === undefined || fill.kind === 'solid') {
    const base = new Color(fill?.kind === 'solid' ? fill.color : '#e8e4da');
    mat.color.copy(base);
    mat.emissive.copy(base).multiplyScalar(0.18);
  } else {
    // Textured/gradient fills get the catalog's dark proxy-glyph emissive.
    mat.emissive.set('#141921');
  }
  mat.emissiveIntensity = 0.7;
  if (glow?.color !== undefined) mat.emissive.set(glow.color);
  if (glow?.intensity !== undefined) mat.emissiveIntensity = glow.intensity;

  return mat;
}
