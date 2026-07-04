// text-object-3d.ts — TRUE 3D EXTRUDED TextObject (CreateTextObject3DFn from
// contract-3d.ts). The opt-in sibling of the flat MSDF text-object.ts.
//
// Letterforms are REAL font outlines (opentype.js → THREE.ShapePath →
// ExtrudeGeometry), never THREE.TextGeometry / typeface JSON (FP-02) and never
// diffusion-drawn (INV-11). One flat Group named TEXT_OBJECT_NAME whose direct
// children are unit meshes `glyph-0..N-1` (SAME contract the 36 text-animation
// primitives + the GraphScene restyle effect + HubManager cleanup consume — so
// they work with zero edits). Each unit is one lit MeshPhysicalNodeMaterial mesh
// (catches scene light + casts/receives real shadows). A TSL colorNode splits
// the fill: front/back CAPS show the face fill (solid/gradient/texture), the
// extruded WALLS+bevel show a derived metallic edge — a single material (so
// primitives that mutate mat.color stay crash-safe) with a premium 3D look.
//
// DOM-free by construction (FP-05): no DOM globals. Outlines + textures are
// injected (the builder never fetches). Relative imports only (dep-guard).

import {
  Box3,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  Path,
  Shape,
  ShapeGeometry,
  ShapePath,
  type BufferGeometry,
  type Material,
  type Texture,
  type Vector2,
} from 'three';
import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, type Node } from 'three/webgpu';
import {
  abs,
  clamp,
  color,
  dot,
  float,
  materialColor,
  mix,
  normalLocal,
  step,
  texture,
  uv,
  vec2,
} from 'three/tsl';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TEXT_SPEC_DEFAULT, type TextFill, type TextSpec } from '../../prism-graph/types';
import {
  requestTransmission,
  releaseTransmission,
} from '../runtime/shared/transmission-budget';
import { TEXT_OBJECT_NAME, textUnitName, type TextObjectHandle } from './contract';
import type {
  CreateTextObject3DFn,
  GlyphOutline,
  GlyphOutlineCommand,
  LoadedFontOutlines,
} from './contract-3d';

// ── extrude defaults (em units; tier-scaled in resolveExtrude) ─────────────
const EXTRUDE_DEFAULT = {
  depth: 0.22,
  bevelEnabled: true,
  bevelThickness: 0.018,
  bevelSize: 0.016,
  bevelSegments: 3,
  curveSegments: 10,
  metalness: 0.12,
  roughness: 0.34,
};

/** Resolve a partial spec over TEXT_SPEC_DEFAULT (explicit undefined must not
 *  clobber). Mirrors text-object.ts:resolveSpec. */
function resolveSpec(spec: TextSpec): TextSpec {
  const out: TextSpec = { ...TEXT_SPEC_DEFAULT };
  for (const [key, value] of Object.entries(spec)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

// ── outline command → THREE.Shape ──────────────────────────────────────────
// opentype getPath() coords are y-DOWN (canvas convention); negate y for THREE
// y-up. Coords arrive in font units → multiply by emScale (= fontSize /
// unitsPerEm) so shapes are in scene units (1 em = fontSize scene units).
function glyphToShapes(commands: GlyphOutlineCommand[], emScale: number, italicShear = 0): Shape[] {
  const sp = new ShapePath();
  // y is negated (opentype y-down → THREE y-up). Synthesized italic shears x by
  // `italicShear * yUp` (baseline-relative), so taller points lean right.
  const py = (y?: number) => -(y ?? 0) * emScale;
  const px = (x?: number, y?: number) => (x ?? 0) * emScale + italicShear * py(y);
  for (const c of commands) {
    switch (c.type) {
      case 'M':
        sp.moveTo(px(c.x, c.y), py(c.y));
        break;
      case 'L':
        sp.lineTo(px(c.x, c.y), py(c.y));
        break;
      case 'Q':
        sp.quadraticCurveTo(px(c.x1, c.y1), py(c.y1), px(c.x, c.y), py(c.y));
        break;
      case 'C':
        sp.bezierCurveTo(
          px(c.x1, c.y1), py(c.y1),
          px(c.x2, c.y2), py(c.y2),
          px(c.x, c.y), py(c.y),
        );
        break;
      case 'Z':
        // ShapePath closes subpaths implicitly at toShapes(); nothing to do.
        break;
    }
  }
  // Assemble shapes by CONTAINMENT, not winding. `ShapePath.toShapes(isCCW)`
  // classifies solid-vs-hole purely by contour direction, which breaks on
  // real-font conversions where hole winding is inconsistent PER GLYPH (the
  // three #16950/#13653 family): Playfair 600's 'a' lost ~75% of its front
  // cap and 'O' triangulated ACROSS its counter — the glyphs read as dark
  // hollow bronze in every extruded headline (masterpiece-m2 forensics,
  // 2026-07-04; proofs/testfill/testoutline/testshadow isolate it to the cap
  // geometry). Containment depth is winding-agnostic: even depth = solid,
  // odd = hole of its innermost containing solid; winding is then normalized
  // (solids CCW, holes CW) so the cap triangulator always sees a consistent
  // orientation.
  const contours = sp.subPaths.map((p) => {
    const pts = p.getPoints();
    // drop the duplicated closing point so signed-area/containment are exact
    if (pts.length > 2 && pts[0].distanceToSquared(pts[pts.length - 1]) < 1e-12) pts.pop();
    return pts;
  });
  return contoursToShapes(contours);
}

// ── containment-based contour → Shape assembly (exported for tests) ─────────
function contourSignedArea(pts: Vector2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

function pointInContour(pt: Vector2, poly: Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const crosses =
      yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Winding-agnostic Shape assembly: containment depth decides solid (even)
 *  vs hole (odd); each hole attaches to its smallest containing solid; output
 *  winding is normalized (solids CCW, holes CW). */
export function contoursToShapes(contours: Vector2[][]): Shape[] {
  const kept = contours.filter((c) => c.length >= 3 && Math.abs(contourSignedArea(c)) > 1e-10);
  const depth = kept.map((c, i) => {
    let d = 0;
    for (let j = 0; j < kept.length; j++) {
      if (i !== j && pointInContour(c[0], kept[j])) d++;
    }
    return d;
  });
  const shapes: Shape[] = [];
  const solidContourIdx: number[] = [];
  for (let i = 0; i < kept.length; i++) {
    if (depth[i] % 2 !== 0) continue;
    const pts = kept[i].slice();
    if (contourSignedArea(pts) < 0) pts.reverse();
    shapes.push(new Shape(pts));
    solidContourIdx.push(i);
  }
  for (let i = 0; i < kept.length; i++) {
    if (depth[i] % 2 === 0) continue;
    let best = -1;
    let bestArea = Infinity;
    for (let k = 0; k < solidContourIdx.length; k++) {
      const j = solidContourIdx[k];
      if (!pointInContour(kept[i][0], kept[j])) continue;
      const area = Math.abs(contourSignedArea(kept[j]));
      if (area < bestArea) {
        bestArea = area;
        best = k;
      }
    }
    if (best < 0) continue; // orphan hole (degenerate contour) — drop
    const pts = kept[i].slice();
    if (contourSignedArea(pts) > 0) pts.reverse();
    shapes[best].holes.push(new Path(pts));
  }
  return shapes;
}

// ── layout (pen-based; mirrors msdf-layout.ts with opentype metrics) ────────
interface Placed3DGlyph {
  char: string;
  /** Pen origin (baseline, left side bearing) in BLOCK space, y-up. */
  x: number;
  y: number;
  lineIndex: number;
  wordIndex: number;
}
interface Unit3D {
  center: { x: number; y: number };
  glyphs: { char: string; x: number; y: number }[]; // unit-local pen origins
  text: string;
  lineIndex: number;
  wordIndex: number;
}
interface LineRule {
  /** Rule span in centered block space + the line's baseline y. */
  minX: number;
  maxX: number;
  baseline: number;
}
interface Layout3D {
  units: Unit3D[];
  width: number;
  height: number;
  rules: LineRule[];
}

function layoutOutline(spec: TextSpec, o: LoadedFontOutlines): Layout3D {
  const content = spec.content ?? TEXT_SPEC_DEFAULT.content ?? '';
  const fontSize = spec.fontSize ?? TEXT_SPEC_DEFAULT.fontSize ?? 0.4;
  const letterSpacing = spec.letterSpacing ?? 0;
  const lineHeightMul = spec.lineHeight ?? 1;
  const align = spec.align ?? 'center';
  const decompose = spec.decompose ?? 'glyph';

  const emScale = fontSize / (o.unitsPerEm || 1000);
  const lineStep = (o.ascender - o.descender || o.unitsPerEm) * emScale * lineHeightMul;

  const lines = content.split('\n');
  const placed: Placed3DGlyph[] = [];
  const lineWidths: number[] = [];
  let wordIndex = -1;
  let inWord = false;

  for (let k = 0; k < lines.length; k++) {
    const baseline = -k * lineStep;
    let penX = 0;
    let prevChar: string | null = null;
    let advanced = 0;
    for (const ch of Array.from(lines[k])) {
      const g: GlyphOutline | undefined = o.glyphs[ch];
      const advance = (g?.advanceWidth ?? o.glyphs[' ']?.advanceWidth ?? o.unitsPerEm * 0.3) * emScale;
      if (prevChar !== null) {
        const kern = o.kerning?.[`${prevChar}${ch}`];
        if (kern) penX += kern * emScale;
      }
      if (/\s/.test(ch) || !g || g.commands.length === 0) {
        inWord = false;
      } else {
        if (!inWord) { wordIndex += 1; inWord = true; }
        placed.push({ char: ch, x: penX, y: baseline, lineIndex: k, wordIndex });
      }
      penX += advance + letterSpacing * fontSize;
      advanced += 1;
      prevChar = ch;
    }
    inWord = false;
    lineWidths.push(advanced > 0 ? penX - letterSpacing * fontSize : 0);
  }

  if (placed.length === 0) return { units: [], width: 0, height: 0, rules: [] };

  // Align each line within the widest line's advance.
  const blockAdvance = Math.max(...lineWidths, 0);
  for (const p of placed) {
    const slack = blockAdvance - lineWidths[p.lineIndex];
    p.x += align === 'center' ? slack / 2 : align === 'right' ? slack : 0;
  }

  // Typographic block extents (cap/asc + desc across lines), centered on origin.
  const ascY = o.ascender * emScale;
  const descY = o.descender * emScale;
  const topY = ascY; // first line baseline 0
  const botY = -(lines.length - 1) * lineStep + descY;
  const minX = Math.min(...placed.map((p) => p.x));
  const maxX = blockAdvance + minX; // advance from leftmost pen
  const width = Math.max(maxX - minX, blockAdvance);
  const height = Math.max(topY - botY, 1e-3);
  const cx = (minX + maxX) / 2;
  const cy = (topY + botY) / 2;
  for (const p of placed) {
    p.x -= cx;
    p.y -= cy;
  }

  // Group into animation units (glyph default).
  const groups: Placed3DGlyph[][] = [];
  if (decompose === 'glyph') {
    for (const p of placed) groups.push([p]);
  } else {
    const byKey = new Map<number, Placed3DGlyph[]>();
    for (const p of placed) {
      const key = decompose === 'word' ? p.wordIndex : p.lineIndex;
      let grp = byKey.get(key);
      if (!grp) { grp = []; byKey.set(key, grp); groups.push(grp); }
      grp.push(p);
    }
  }

  const units: Unit3D[] = groups.map((grp) => {
    const xs = grp.map((p) => p.x);
    const center = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...grp.map((p) => p.y)) + Math.max(...grp.map((p) => p.y))) / 2,
    };
    return {
      center,
      glyphs: grp.map((p) => ({ char: p.char, x: p.x - center.x, y: p.y - center.y })),
      text: grp.map((p) => p.char).join(''),
      lineIndex: grp[0].lineIndex,
      wordIndex: grp[0].wordIndex,
    };
  });

  // Per-line rule spans (underline / strikethrough). Pen origins underestimate
  // the right edge by ~one glyph advance, so pad maxX by ~0.6em.
  const byLine = new Map<number, Placed3DGlyph[]>();
  for (const p of placed) {
    const g = byLine.get(p.lineIndex);
    if (g) g.push(p); else byLine.set(p.lineIndex, [p]);
  }
  const rules: LineRule[] = [...byLine.values()].map((grp) => ({
    minX: Math.min(...grp.map((p) => p.x)) - fontSize * 0.04,
    maxX: Math.max(...grp.map((p) => p.x)) + fontSize * 0.6,
    baseline: grp[0].y,
  }));

  return { units, width, height, rules };
}

/** A line rule (underline/strikethrough) as a thin extruded bar matching the
 *  text depth, so it reads as part of the 3D object. */
function buildRuleBar(
  rule: LineRule,
  yOffset: number,
  thickness: number,
  ex: typeof EXTRUDE_DEFAULT,
  fontSize: number,
): BufferGeometry | null {
  const w = rule.maxX - rule.minX;
  if (w <= 0) return null;
  const y = rule.baseline + yOffset;
  const bar = new Shape();
  bar.moveTo(rule.minX, y - thickness / 2);
  bar.lineTo(rule.maxX, y - thickness / 2);
  bar.lineTo(rule.maxX, y + thickness / 2);
  bar.lineTo(rule.minX, y + thickness / 2);
  bar.closePath();
  const depth = ex.depth * fontSize;
  const geo = new ExtrudeGeometry([bar], { depth, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -depth);
  return geo;
}

// ── geometry: extrude one unit (per-glyph extrude → merge w/ groups) ────────
function buildUnitGeometry(
  unit: Unit3D,
  o: LoadedFontOutlines,
  emScale: number,
  ex: typeof EXTRUDE_DEFAULT,
  fontSize: number,
  shear: number,
): BufferGeometry | null {
  const depth = ex.depth * fontSize;
  const opts = {
    depth,
    bevelEnabled: ex.bevelEnabled,
    bevelThickness: ex.bevelThickness * fontSize,
    bevelSize: ex.bevelSize * fontSize,
    bevelOffset: 0,
    bevelSegments: ex.bevelEnabled ? ex.bevelSegments : 0,
    curveSegments: ex.curveSegments,
    steps: 1,
  };
  const geoms: BufferGeometry[] = [];
  for (const gl of unit.glyphs) {
    const outline = o.glyphs[gl.char];
    if (!outline || outline.commands.length === 0) continue;
    const shapes = glyphToShapes(outline.commands, emScale, shear);
    if (shapes.length === 0) continue;
    const geo = new ExtrudeGeometry(shapes, opts);
    // Front cap at z≈0, body extruded toward -z (so text faces +z / camera).
    geo.translate(gl.x, gl.y, -depth);
    geoms.push(geo);
  }
  if (geoms.length === 0) return null;
  const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, true);
  if (geoms.length > 1) for (const g of geoms) g.dispose();
  return merged ?? null;
}

/** Remap CAP (front/back face) UVs to block-space 0..1 so a poured texture /
 *  gradient spans the whole text block (ExtrudeGeometry's default front UVs are
 *  raw object-space XY and would tile/garble). Cap verts = |normal.z| > 0.5.
 *  Side/bevel verts keep their wrap UVs (sides use the edge color, not the map). */
function remapFaceUv(geo: BufferGeometry, unitCenter: { x: number; y: number }, block: Box3): void {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const uvAttr = geo.getAttribute('uv');
  if (!pos || !nor || !uvAttr) return;
  const bw = Math.max(block.max.x - block.min.x, 1e-4);
  const bh = Math.max(block.max.y - block.min.y, 1e-4);
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nor.getZ(i)) > 0.5) {
      const wx = pos.getX(i) + unitCenter.x;
      const wy = pos.getY(i) + unitCenter.y;
      uvAttr.setXY(i, (wx - block.min.x) / bw, (wy - block.min.y) / bh);
    }
  }
  uvAttr.needsUpdate = true;
}

// ── controllable drop shadow (offset X/Y/Z, color, opacity, blur) ──────────
// A flat silhouette of the whole text block, offset behind the geometry and
// tinted — the artist-controllable drop shadow (distinct from, and layered with,
// the genuine PCFSoft scene shadow the lit mesh casts onto the catcher). Blur is
// a stacked multi-tap (golden-angle disk) so it stays renderer-agnostic with no
// offscreen RT. Returns the group + the SHARED geometry to dispose once.
function buildShadowGroup(
  layout: Layout3D,
  o: LoadedFontOutlines,
  emScale: number,
  spec: TextSpec,
  fontSize: number,
  tier: 'T0' | 'T1' | 'T2',
  shear: number,
): { group: Group; geo: BufferGeometry } | null {
  const sh = spec.shadow;
  if (!sh || (sh.opacity ?? 0) <= 0) return null;
  const offX = (sh.offsetX ?? 0) * fontSize;
  const offY = (sh.offsetY ?? 0) * fontSize;
  const offZ = (sh.offsetZ ?? 0) * fontSize;
  const blur = Math.max(0, sh.blur ?? 0) * fontSize;
  const baseOpacity = Math.min(1, sh.opacity ?? 0);
  const curve = tier === 'T2' ? 12 : 8;

  // One merged flat silhouette in block space.
  const geoms: BufferGeometry[] = [];
  for (const unit of layout.units) {
    for (const gl of unit.glyphs) {
      const outline = o.glyphs[gl.char];
      if (!outline || outline.commands.length === 0) continue;
      const shapes = glyphToShapes(outline.commands, emScale, shear);
      if (shapes.length === 0) continue;
      const g = new ShapeGeometry(shapes, curve);
      g.translate(unit.center.x + gl.x, unit.center.y + gl.y, 0);
      geoms.push(g);
    }
  }
  if (geoms.length === 0) return null;
  const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
  if (geoms.length > 1) for (const g of geoms) g.dispose();
  if (!merged) return null;

  const group = new Group();
  group.name = 'text-shadow';
  const taps = blur > 0 ? (tier === 'T2' ? 8 : tier === 'T0' ? 1 : 6) : 1;
  const per = baseOpacity / taps;
  // Slightly behind the back face so it never z-fights the glyphs.
  const backset = -fontSize * 0.02;
  for (let i = 0; i < taps; i++) {
    const mat = new MeshBasicNodeMaterial();
    mat.color.set(sh.color ?? '#000000');
    mat.transparent = true;
    mat.opacity = per;
    mat.depthWrite = false;
    mat.toneMapped = false;
    mat.side = DoubleSide;
    const mesh = new Mesh(merged, mat); // shared geometry; disposed once
    let jx = 0;
    let jy = 0;
    if (taps > 1) {
      const a = i * 2.399963229; // golden angle
      const r = blur * Math.sqrt((i + 0.5) / taps);
      jx = Math.cos(a) * r;
      jy = Math.sin(a) * r;
    }
    mesh.position.set(offX + jx, offY + jy, offZ + backset);
    mesh.renderOrder = -1;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return { group, geo: merged };
}

// ── material: lit PBR with a TSL face/side colorNode split ──────────────────
function fillBase(fill: TextFill | undefined, fallback: string): string {
  if (fill?.kind === 'solid') return fill.color;
  if (fill?.kind === 'gradient') return fill.from;
  return fallback;
}

function buildUnitMaterial(
  spec: TextSpec,
  fillTex: Texture | null,
): MeshPhysicalNodeMaterial {
  const ex = spec.extrude ?? {};
  const faceFill: TextFill | undefined = ex.faceFill ?? spec.fill;
  const sideFill: TextFill | undefined = ex.sideFill;
  const baseHex = fillBase(faceFill, '#e8e4da');

  const mat = new MeshPhysicalNodeMaterial();
  mat.metalness = ex.metalness ?? EXTRUDE_DEFAULT.metalness;
  mat.roughness = ex.roughness ?? EXTRUDE_DEFAULT.roughness;
  mat.envMapIntensity = 1.1;
  // Render both faces: some glyph outlines (e.g. counters in 'a'/'e') can
  // triangulate to a mis-wound front cap, which a single-sided material culls —
  // leaving a see-through glyph. DoubleSide makes the back of that cap render so
  // the letter stays solid. Head-on extruded type never shows true backfaces.
  mat.side = DoubleSide;
  mat.color.set(baseHex);
  // Diagnostics (verification reads these to prove the 3D path compiled).
  mat.userData.text3dFaceFill = faceFill?.kind ?? 'solid';
  mat.userData.text3dHasFaceTexture = !!fillTex;
  mat.userData.text3d = true;

  const live = materialColor as unknown as Node<'vec3'>;

  // Face pigment expression (caps). Folds in materialColor so the 36 primitives'
  // mat.color tweens still recolor (msdf-material.ts parity).
  const faceColor = (() => {
    if (faceFill?.kind === 'gradient') {
      const a = ((faceFill.angleDeg ?? 0) * Math.PI) / 180;
      const t = clamp(
        dot(vec2(uv()).sub(vec2(0.5, 0.5)), vec2(Math.cos(a), Math.sin(a))).add(0.5),
        0, 1,
      );
      return mix(color(faceFill.from), color(faceFill.to), t).mul(live);
    }
    if ((faceFill?.kind === 'texture' || faceFill?.kind === 'ai-texture') && fillTex) {
      return texture(fillTex, vec2(uv())).rgb.mul(live);
    }
    return live; // solid → live mat.color (set above + animatable)
  })();

  // Side (wall + bevel) color. Explicit sideFill wins; else a darker metallic
  // edge derived from the face base → premium dimensional read on rotation.
  const sideColor = (() => {
    if (sideFill?.kind === 'solid') return color(sideFill.color);
    if (sideFill?.kind === 'gradient') return color(sideFill.from);
    return color(baseHex).mul(float(0.5)); // derived edge
  })();
  if (sideFill) {
    mat.metalness = Math.max(mat.metalness, 0.35); // explicit edge → metallic
  }

  // step(0.5, |normal.z|): caps (|nz|≈1) → 1 → faceColor; walls (|nz|≈0) → 0 →
  // sideColor. One material, per-surface look, primitive-safe.
  const capMask = step(float(0.5), abs(normalLocal.z));
  mat.colorNode = mix(sideColor, faceColor, capMask);

  // Opacity + glow (native props; primitives + editor tween these live).
  const op = spec.opacity ?? 1;
  mat.opacity = op;
  mat.transparent = op < 1;
  if (spec.glow?.color !== undefined || spec.glow?.intensity !== undefined) {
    if (spec.glow?.color) mat.emissive.set(spec.glow.color);
    else mat.emissive.set(baseHex);
    mat.emissiveIntensity = spec.glow?.intensity ?? 0.6;
  }
  return mat;
}

/**
 * Promote a freshly-built extruded-text material to TRUE liquid glass when
 * `extrude.transmission > 0`. Admits ONE shared material into the ≤2 Path-B
 * budget (§4) so the whole wordmark is a single transmission surface; over
 * budget falls back to a clearcoat-glass approximation (no extra screen pass).
 * Returns true when a real Path-B transmission slot was taken (caller releases
 * it on cleanup).
 */
function applyGlass(mat: MeshPhysicalNodeMaterial, spec: TextSpec): boolean {
  const ex = spec.extrude ?? {};
  const t = ex.transmission ?? 0;
  if (t <= 0) return false;
  mat.metalness = 0;
  mat.ior = ex.ior ?? 1.45;
  mat.clearcoat = ex.clearcoat ?? 1;
  mat.clearcoatRoughness = ex.clearcoatRoughness ?? 0.08;
  if (ex.iridescence != null) mat.iridescence = ex.iridescence;
  mat.transparent = true;
  mat.userData.text3dGlass = true;
  const admitted = requestTransmission(mat);
  if (admitted) {
    mat.transmission = t;
    mat.thickness = ex.thickness ?? ex.depth ?? EXTRUDE_DEFAULT.depth;
    if (ex.dispersion != null) mat.dispersion = ex.dispersion;
    mat.roughness = ex.roughness ?? 0.04;
    mat.userData.text3dTransmission = t;
  } else {
    // Over the ≤2 budget — degrade gracefully to clearcoat glass (Path-C-ish):
    // still reads as crystal, no extra screen render of the scene behind it.
    mat.transmission = 0;
    mat.roughness = ex.roughness ?? 0.06;
    mat.opacity = Math.min(spec.opacity ?? 1, 0.9);
    mat.userData.text3dTransmission = 0;
  }
  return admitted;
}

function resolveExtrude(spec: TextSpec, tier: 'T0' | 'T1' | 'T2'): typeof EXTRUDE_DEFAULT {
  const ex = spec.extrude ?? {};
  // T2 desktop affords richer tessellation for DPR-2 sharpness; T1 the default.
  const curveBoost = tier === 'T2' ? 4 : 0;
  return {
    depth: ex.depth ?? EXTRUDE_DEFAULT.depth,
    bevelEnabled: ex.bevelEnabled ?? EXTRUDE_DEFAULT.bevelEnabled,
    bevelThickness: ex.bevelThickness ?? EXTRUDE_DEFAULT.bevelThickness,
    bevelSize: ex.bevelSize ?? EXTRUDE_DEFAULT.bevelSize,
    bevelSegments: ex.bevelSegments ?? EXTRUDE_DEFAULT.bevelSegments,
    curveSegments: (ex.curveSegments ?? EXTRUDE_DEFAULT.curveSegments) + curveBoost,
    metalness: ex.metalness ?? EXTRUDE_DEFAULT.metalness,
    roughness: ex.roughness ?? EXTRUDE_DEFAULT.roughness,
  };
}

export const createTextObject3D: CreateTextObject3DFn = (spec, outlines, opts) => {
  const group = new Group();
  group.name = TEXT_OBJECT_NAME;
  const tier = opts?.tier ?? 'T1';
  const resolveFillTexture = opts?.resolveFillTexture;

  let resolved = resolveSpec(spec);
  let currentOutlines = outlines;
  let fillTex: { url: string; tex: Texture } | null = null;
  let disposed = false;
  const units: Mesh[] = [];
  const decorations: Mesh[] = []; // underline / strikethrough rule bars
  let shadowGroup: Group | null = null;
  let shadowGeo: BufferGeometry | null = null;
  // Shared liquid-glass material (one per wordmark, admitted once into the ≤2
  // transmission budget) — built lazily in buildUnits, released in clearUnits.
  let glassMat: MeshPhysicalNodeMaterial | null = null;

  const wantFillUrl = (): string | null => {
    const f = resolved.extrude?.faceFill ?? resolved.fill;
    if (f && (f.kind === 'texture' || f.kind === 'ai-texture') && f.url) return f.url;
    return null;
  };

  const buildUnits = () => {
    const fontSize = resolved.fontSize ?? 0.4;
    const emScale = fontSize / (currentOutlines.unitsPerEm || 1000);
    const ex = resolveExtrude(resolved, tier);
    const layout = layoutOutline(resolved, currentOutlines);
    lastMeasure = { width: layout.width, height: layout.height };
    // Block bbox in block space (centered on origin) for face-UV remap.
    const block = new Box3();
    block.min.set(-layout.width / 2, -layout.height / 2, 0);
    block.max.set(layout.width / 2, layout.height / 2, 0);
    const tex = fillTex && fillTex.url === wantFillUrl() ? fillTex.tex : null;
    // Synthesized italic = a baseline-relative X shear on the outlines (§7;
    // real italic faces are requested via the italic flag on the outline fetch).
    const shear = resolved.italic ? 0.22 : 0;

    // True liquid-glass wordmark → ONE shared material for every glyph (single
    // transmission surface). Non-glass titles keep per-glyph materials.
    const wantGlass = (resolved.extrude?.transmission ?? 0) > 0;
    if (wantGlass) {
      glassMat = buildUnitMaterial(resolved, tex);
      applyGlass(glassMat, resolved);
    }
    const unitMaterial = () => glassMat ?? buildUnitMaterial(resolved, tex);

    layout.units.forEach((unit, i) => {
      const geo = buildUnitGeometry(unit, currentOutlines, emScale, ex, fontSize, shear);
      if (!geo) return;
      remapFaceUv(geo, unit.center, block);
      const mesh = new Mesh(geo, unitMaterial());
      mesh.name = textUnitName(i);
      mesh.position.set(unit.center.x, unit.center.y, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      units.push(mesh);
      group.add(mesh);
    });

    // Underline / strikethrough — thin extruded bars matching the text depth,
    // positioned from the font's own post-table metrics (§7).
    if (resolved.underline || resolved.strikethrough) {
      const upm = currentOutlines.unitsPerEm || 1000;
      const uthick = Math.max(
        (currentOutlines.underlineThickness / upm) * fontSize || 0,
        fontSize * 0.045,
      );
      const upos = currentOutlines.underlinePosition
        ? (currentOutlines.underlinePosition / upm) * fontSize
        : -fontSize * 0.12;
      for (const rule of layout.rules) {
        const bars: Array<{ y: number; tag: string }> = [];
        if (resolved.underline) bars.push({ y: upos, tag: 'u' });
        if (resolved.strikethrough) bars.push({ y: fontSize * 0.3, tag: 's' });
        for (const b of bars) {
          const g = buildRuleBar(rule, b.y, uthick, ex, fontSize);
          if (!g) continue;
          remapFaceUv(g, { x: 0, y: 0 }, block);
          const m = new Mesh(g, unitMaterial());
          m.name = `text-rule-${b.tag}`;
          m.castShadow = true;
          m.receiveShadow = true;
          decorations.push(m);
          group.add(m);
        }
      }
    }

    // Controllable drop shadow (textSpec.shadow). Layered with the genuine
    // PCFSoft scene shadow the lit glyph meshes cast onto the catcher.
    const sg = buildShadowGroup(layout, currentOutlines, emScale, resolved, fontSize, tier, shear);
    if (sg) {
      shadowGroup = sg.group;
      shadowGeo = sg.geo;
      group.add(sg.group);
    }
  };

  const clearUnits = () => {
    // Dispose each unique material once — glyphs may share one glass material.
    const seenMats = new Set<Material>();
    for (const mesh of [...units, ...decorations]) {
      group.remove(mesh);
      mesh.geometry.dispose();
      const m = mesh.material as Material;
      if (!seenMats.has(m)) {
        seenMats.add(m);
        m.dispose();
      }
    }
    if (glassMat) {
      releaseTransmission(glassMat);
      glassMat = null;
    }
    units.length = 0;
    decorations.length = 0;
    if (shadowGroup) {
      group.remove(shadowGroup);
      for (const m of shadowGroup.children) {
        if ((m as Mesh).isMesh) ((m as Mesh).material as Material).dispose();
      }
      shadowGroup = null;
    }
    // Shared silhouette geometry disposed once (all taps reference it).
    if (shadowGeo) { shadowGeo.dispose(); shadowGeo = null; }
  };

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
      .catch(() => { /* soft-fail: solid/edge surface stays */ });
  };

  let lastMeasure = { width: 0, height: 0 };
  buildUnits();
  ensureFillTexture();

  const handle: TextObjectHandle = {
    object: group,
    units,
    get spec() {
      return resolved;
    },
    setSpec(next, _atlas) {
      resolved = resolveSpec(next);
      clearUnits();
      buildUnits();
      ensureFillTexture();
    },
    measure() {
      return lastMeasure;
    },
    dispose() {
      disposed = true;
      fillTex = null;
      clearUnits();
    },
  };
  // Allow the 3D handle to accept a refreshed outline set via setSpec's atlas
  // slot is N/A; callers swap outlines by rebuilding. Expose for the factory.
  (handle as unknown as { setOutlines?: (o: LoadedFontOutlines) => void }).setOutlines = (o) => {
    currentOutlines = o;
    clearUnits();
    buildUnits();
    ensureFillTexture();
  };
  group.userData.textHandle = handle;
  group.userData.text3d = true;
  return handle;
};
